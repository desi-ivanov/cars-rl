import { Car } from "./car";
import { Line, Vec, World } from "./commons";

interface GymEnv<T, U> {
  reset(): T;
  step(action: U): { state: T, reward: number, done: boolean };
  render(canvas: HTMLCanvasElement): void;
}

export const drawLine = (ctx: CanvasRenderingContext2D, line: Line, color = "#000") => {
  ctx.beginPath();
  ctx.moveTo(line.p1.x, line.p1.y);
  ctx.lineTo(line.p2.x, line.p2.y);
  ctx.strokeStyle = color;
  ctx.stroke();
}

export const defined = <T>(x: T | null | undefined): x is T => x !== null && x !== undefined;

export const distance = (p1: Vec, p2: Vec): number => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

export const intersection = (l1: Line, l2: Line): Vec | null => {
  const denom = (l1.p1.x - l1.p2.x) * (l2.p1.y - l2.p2.y) - (l1.p1.y - l1.p2.y) * (l2.p1.x - l2.p2.x);
  if(denom === 0) return null;
  const x = ((l1.p1.x * l1.p2.y - l1.p1.y * l1.p2.x) * (l2.p1.x - l2.p2.x) - (l1.p1.x - l1.p2.x) * (l2.p1.x * l2.p2.y - l2.p1.y * l2.p2.x)) / denom;
  const y = ((l1.p1.x * l1.p2.y - l1.p1.y * l1.p2.x) * (l2.p1.y - l2.p2.y) - (l1.p1.y - l1.p2.y) * (l2.p1.x * l2.p2.y - l2.p1.y * l2.p2.x)) / denom;
  if(x < Math.min(l1.p1.x, l1.p2.x) || x > Math.max(l1.p1.x, l1.p2.x) || x < Math.min(l2.p1.x, l2.p2.x) || x > Math.max(l2.p1.x, l2.p2.x)) return null;
  if(y < Math.min(l1.p1.y, l1.p2.y) || y > Math.max(l1.p1.y, l1.p2.y) || y < Math.min(l2.p1.y, l2.p2.y) || y > Math.max(l2.p1.y, l2.p2.y)) return null;
  return { x, y };
}

export class CarEnv implements GymEnv<number[], number> {
  private lastTime = performance.now();
  private car!: Car;
  private rewardsGrid: boolean[][] = [];

  constructor(
    private readonly world: World,
    private readonly sensorLength: number,
    private readonly speed: number,
    private readonly steerAngle: number,
    private readonly gridCellSize: number = 80
  ) {
    this.reset();
  }

  reset() {
    this.car = new Car(this.sensorLength, this.speed, this.steerAngle);
    this.rewardsGrid = Array.from({ length: Math.ceil(this.world.width / this.gridCellSize) }, () => Array.from({ length: Math.ceil(this.world.height / this.gridCellSize) }, () => false));
    return this.state();
  }

  sensorIntersections = (): (Vec | null)[] => 
    this.car.sensorsLines()
      .map(sensor =>
        this.world.walls.map(wall => intersection(sensor, wall))
          .filter(defined)
          .reduce((a, v) => !a ? v : distance(this.car.center, v) < distance(this.car.center, a) ? v : a, null as Vec | null)
      )

  sensorInputs = (): number[] => this.sensorIntersections().map(itx => itx === null ? 0 : 1 - (distance(this.car.center, itx) / this.sensorLength));

  render = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d");
    if(!ctx) return;
    ctx.clearRect(0, 0, this.world.width, this.world.height);
    this.world.walls.forEach(s => drawLine(ctx, s));
    this.car.shapeLines().forEach(s => drawLine(ctx, s));
  }

  isColliding = (): boolean => this.car.shapeLines().some(line => this.world.walls.some(wall => intersection(line, wall) != null));

  state = (): number[] => this.sensorInputs();

  step = (action: number) => {
    const now = performance.now();
    const dt = Math.min(0.01, (now - this.lastTime) / 1000);
    if(!this.isColliding()) {
      this.car.update(dt, action);
    }
    this.lastTime = now;
    const gameOver = this.isColliding();

    let pathReward = 0.01;
    const cellX = Math.floor(this.car.center.x / this.gridCellSize);
    const cellY = Math.floor(this.car.center.y / this.gridCellSize);
    if(!this.rewardsGrid[cellY][cellX]) {
      this.rewardsGrid[cellY][cellX] = true;
      pathReward = 1;
    }
    return { state: this.state(), reward: gameOver ? -10 : pathReward, done: gameOver };
  }
}