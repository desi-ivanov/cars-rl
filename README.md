# cars-rl

Reinforcement Leanring (DQN) from scratch with zero dependencies applied to a simple car driving game. 
[Check it out here](https://desi-ivanov.github.io/cars-rl/)!

https://github.com/desi-ivanov/cars-rl/assets/20824840/a7390984-4c6d-476c-8092-6f8d5fa3c033

# Details




The agent has 3 inputs which define the vicinity of walls to the sides of the car, each in the range of [0, 1]. At each step the reward is:
- 1 if the car reaches a new point on the map (the map is divided into a grid of 10x10 cells)
- 0.01 if the car does not crash
- -10 if the car crashes

# References

This project is heavily based on:
- [cars-ai](https://github.com/desi-ivanov/cars-ai)
- [tsgrad](https://github.com/desi-ivanov/tsgrad)

# License

MIT
