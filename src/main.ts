import { CarEnv } from "./gym";
import { Optimizer, RMSProp, MLP, Parameter, reduceSum } from "./autograd";
import { world } from "./world";
import { zip } from "./commons";
import { drawChart, drawGraph } from "./chart";

type Transition = { state: number[], action: number, reward: number, nextState: number[], done: boolean }

const LR = 0.05
const GAMMA = 0.98
const BUFFER_LIMIT = 10000
const BATCH_SIZE = 128
const EPOCHS = 20
const EPS_END = 0.001
const EPS_START = 0.7
const EPS_DECAY = 60
const N_ACTIONS = 3;
const MIN_TRAIN_MEM = 100;
const SPEED = 180;
const STEER_ANGLE = Math.PI / 50;
const SENSOR_LENGTH = 70;

const smoothL1 = (yp: Parameter, y: Parameter) => {
  const diff = yp.sub(y);
  const absDiff = diff.abs();
  return absDiff.getValue() < 1 ? diff.mul(diff).mul(0.5) : absDiff.sub(0.5);
}

const train = (q: MLP, qTarget: MLP, buffer: Transition[], opt: Optimizer) => {
  const losses = [];
  for(let e = 0; e < EPOCHS; e++) {
    const batch = Array.from({ length: BATCH_SIZE }).map(() => buffer[Math.floor(Math.random() * buffer.length)])
    const preds = batch.map(s => q.forward(s.state)).map((q, i) => q[batch[i].action]);
    const target = batch.map((s) => qTarget.forward(s.nextState).reduce((a, v) => a.getValue() > v.getValue() ? a : v).mul(GAMMA).mul(s.done ? 0 : 1).add(s.reward));
    const loss = reduceSum(zip(preds, target).map(([q, t]) => smoothL1(q, t))).div(BATCH_SIZE);
    q.zero_grad();
    loss.backward();
    opt.step();
    losses.push(loss.getValue());
  }
  return losses.reduce((a, v) => a + v) / losses.length;
}
const getEps = (step: number) => EPS_END + (EPS_START - EPS_END) * Math.exp(-1. * (1.1 ** step) / EPS_DECAY);
const selectAction = (net: MLP, state: number[], step: number) => {
  const eps_threshold = getEps(step);
  return Math.random() > eps_threshold ? net.forward(state).reduce((i, _, j, a) => a[i].getValue() > a[j].getValue() ? i : j, 0) : Math.floor(Math.random() * N_ACTIONS);
}

const main = async () => {
  const gameCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const netCanvas = document.getElementById('net-canvas') as HTMLCanvasElement;
  const lossCanvas = document.getElementById('loss-canvas') as HTMLCanvasElement;
  const env = new CarEnv(world, SENSOR_LENGTH, SPEED, STEER_ANGLE);
  const shape = [env.state().length, 5, N_ACTIONS];
  const q = new MLP(shape);
  const qTarget = new MLP(shape);
  const memory: Transition[] = [];
  const optim = new RMSProp(q.parameters(), LR);
  const losses = [];
  for(let nEpisodes = 0; ; nEpisodes++) {
    let game = { state: env.reset(), reward: 0, done: false };
    let score = 0;
    while(!game.done) {
      const act = selectAction(q, game.state, nEpisodes);
      const nextGame = env.step(act);
      memory.push({ state: game.state, reward: nextGame.reward, action: act, nextState: nextGame.state, done: nextGame.done });
      if(memory.length > BUFFER_LIMIT) memory.shift();
      game = nextGame;

      score += nextGame.reward;
      document.getElementById('status')!.innerText = `Episode: ${nEpisodes.toString()}, Score: ${score.toFixed(2)}, EPS: ${getEps(nEpisodes).toFixed(2)}, MemSZ: ${memory.length}`;
      env.render(gameCanvas);
      await new Promise(requestAnimationFrame);
    }
    if(memory.length > MIN_TRAIN_MEM) {
      const loss = train(q, qTarget, memory, optim);
      losses.push(loss);
    }
    drawGraph(netCanvas, q, game.state);
    drawChart(lossCanvas, losses);
    if(nEpisodes % 10 === 0) {
      const bp = q.parameters();
      qTarget.parameters().forEach((p, i) => p.setValue(bp[i].getValue()));
    }
  }
}
main();
