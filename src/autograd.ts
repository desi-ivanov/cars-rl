export class Parameter {
  private grad: number
  constructor(
    private value: number,
    public readonly children: Parameter[] = [],
    private readonly gradfn: () => void = () => { },
  ) {
    this.grad = 0
  }
  add = (other: Parameter | number) => {
    const otherPar = other instanceof Parameter ? other : new Parameter(other)
    const out = new Parameter(
      this.value + otherPar.value,
      [this, otherPar],
      () => {
        this.grad += out.grad
        otherPar.grad += out.grad
      },
    );
    return out;
  }

  sub = (other: Parameter | number) => this.add((other instanceof Parameter ? other : new Parameter(other)).neg())
  neg = () => this.mul(-1)
  abs = () => {
    const out = new Parameter(
      Math.abs(this.value),
      [this],
      () => {
        this.grad += (this.value > 0 ? 1 : -1) * out.grad;
      }
    );
    return out;
  }
  mul = (other: Parameter | number) => {
    const otherPar = other instanceof Parameter ? other : new Parameter(other)
    const out = new Parameter(
      this.value * otherPar.value,
      [this, otherPar],
      () => {
        this.grad += otherPar.value * out.grad
        otherPar.grad += this.value * out.grad
      },
    );
    return out;
  }
  pow = (exp: number) => {
    const out = new Parameter(
      this.value ** exp,
      [this],
      () => {
        this.grad += exp * this.value ** (exp - 1) * out.grad;
      }
    );
    return out;
  }
  div = (other: Parameter | number) => this.mul((other instanceof Parameter ? other : new Parameter(other)).pow(-1));
  sigmoid = () => {
    const out = new Parameter(
      1 / (1 + Math.exp(-this.value)),
      [this],
      () => {
        this.grad += out.grad * (out.value * (1 - out.value))
      }
    )
    return out;
  }
  getValue = () => this.value
  setValue = (value: number) => { this.value = value }
  getGrad = () => this.grad
  setGrad = (grad: number) => { this.grad = grad }
  backward = () => {
    const topo: Parameter[] = [];
    const visited = new Set<Parameter>();
    function buildTopo(v: Parameter) {
      if(!visited.has(v)) {
        visited.add(v)
        v.children.forEach(c => buildTopo(c));
        topo.push(v)
      }
    }
    buildTopo(this)
    topo.reverse();

    this.grad = 1;
    for(const param of topo) {
      param.gradfn();
    }
  }
}

class Perceptron  {
  w: Parameter[];
  b: Parameter;
  constructor(input_size: number, initializer: () => number) {
    this.w = Array.from({ length: input_size }, () => new Parameter(initializer()));
    this.b = new Parameter(initializer());
  }
  parameters = () => this.w.concat(this.b);
  forward = (x: Parameter[]): Parameter[] => [reduceSum(x.map((v, i) => v.mul(this.w[i]))).add(this.b)]
}

class RandNormal {
  static sample = (mean = 0, std = 1) => mean + std * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

export class Linear  {
  w: Perceptron[];
  b: Parameter | undefined;
  in_channels: number;
  constructor(in_channels: number, out_channels: number, initializer = RandNormal.sample.bind(RandNormal)) {
    this.in_channels = in_channels
    this.w = Array.from({ length: out_channels }, () => new Perceptron(in_channels, initializer));
  }
  parameters = () => this.w.flatMap(p => p.parameters());
  forward = (x: Parameter[]): Parameter[] => this.w.map(p => p.forward(x)[0]);
}

export class MLP  {
  layers: Linear[];
  constructor(shape: number[], private readonly act: (x: Parameter) => Parameter = x => x.sigmoid()) {
    this.layers = shape.slice(1).map((n, i) => new Linear(shape[i], n));
  }
  forward = (xs: number[]) => this.layers.reduce((acc, layer) => layer.forward(acc).map(this.act.bind(this)), xs.map(x => new Parameter(x)));
  parameters = () => this.layers.flatMap(l => l.parameters());
  zero_grad = () => this.parameters().forEach(param => param.setGrad(0))
}

export class RMSProp {
  private readonly v: number[];
  constructor(
    private readonly parameters: Parameter[],
    private readonly learningRate: number,
    private readonly beta: number = 0.9,
    private readonly epsilon: number = 1e-8
  ) { this.v = this.parameters.map(_ => 0) }
  step = () => {
    this.parameters.forEach((p, i) => {
      this.v[i] = this.beta * this.v[i] + (1 - this.beta) * p.getGrad() ** 2
      p.setValue(p.getValue() - this.learningRate * p.getGrad() / (this.v[i] ** 0.5 + this.epsilon))
    })
  }
}

export type Optimizer = { step: () => void }

export const reduceSum = (xs: Parameter[]) => xs.reduce((a, v) => a.add(v));

