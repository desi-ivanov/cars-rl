import { CarEnv } from "./gym";
import { Optimizer, RMSProp, MLP, Parameter, reduceSum } from "./autograd";
import { world } from "./world";
import { zip } from "./commons";

type Transition = { state: number[], action: number, reward: number, nextState: number[], done: boolean }

const LR = 0.01
const GAMMA = 0.98
const BUFFER_LIMIT = 10000
const BATCH_SIZE = 64
const EPOCHS = 20
const EPS_END = 0.001
const EPS_START = 0.2
const EPS_DECAY = 200
const N_ACTIONS = 3;
const MIN_TRAIN_MEM = 1000;
const SPEED = 180;
const STEER_ANGLE = Math.PI / 50;
const SENSOR_LENGTH = 70;

const smoothL1 = (yp: Parameter, y: Parameter) => {
  const diff = yp.sub(y);
  const absDiff = diff.abs();
  return absDiff.getValue() < 1 ? diff.mul(diff).mul(0.5) : absDiff.sub(0.5);
}

const train = (q: MLP, qTarget: MLP, buffer: Transition[], opt: Optimizer) => {
  for(let e = 0; e < EPOCHS; e++) {
    const batch = Array.from({ length: BATCH_SIZE }).map(() => buffer[Math.floor(Math.random() * buffer.length)])
    const preds = batch.map(s => q.forward(s.state)).map((q, i) => q[batch[i].action]);
    const target = batch.map((s) => qTarget.forward(s.nextState).reduce((a, v) => a.getValue() > v.getValue() ? a : v).mul(GAMMA).mul(s.done ? 0 : 1).add(s.reward));
    const loss = reduceSum(zip(preds, target).map(([q, t]) => smoothL1(q, t))).div(BATCH_SIZE);
    q.zero_grad();
    loss.backward();
    opt.step();
  }
}

const selectAction = (net: MLP, state: number[], step: number) => {
  const eps_threshold = EPS_END + (EPS_START - EPS_END) * Math.exp(-1. * step / EPS_DECAY);
  return Math.random() > eps_threshold ? net.forward(state).reduce((i, _, j, a) => a[i].getValue() > a[j].getValue() ? i : j, 0) : Math.floor(Math.random() * N_ACTIONS);
}

const main = async () => {
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const env = new CarEnv(world, SENSOR_LENGTH, SPEED, STEER_ANGLE);
  const shape = [env.state().length, 5, 5, N_ACTIONS];
  const q = new MLP(shape);
  const qTarget = new MLP(shape);
  const memory: Transition[] = [];
  const optim = new RMSProp(q.parameters(), LR);

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
      document.getElementById('status')!.innerText = `Episode: ${nEpisodes.toString()}, Score: ${score.toFixed(2)}`;
      env.render(canvas);
      await new Promise(requestAnimationFrame);
    }
    if(memory.length > MIN_TRAIN_MEM) {
      train(q, qTarget, memory, optim);
    }
    if(nEpisodes % 10 === 0) {
      const bp = q.parameters();
      qTarget.parameters().forEach((p, i) => p.setValue(bp[i].getValue()));
    }
  }
}
main();
