export type Vec = { x: number, y: number }
export type Line = { p1: Vec, p2: Vec }
export type Sensor = { angle: number, size: number }
export type World = { walls: Line[], width: number, height: number }

export const zip = <T, U>(xs: T[], ys: U[]): [T, U][] => xs.map((x, i) => [x, ys[i]]);
