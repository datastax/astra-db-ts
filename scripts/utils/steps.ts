export interface Step {
  run(): Promise<void>,
}

export class Steps {
  constructor(private readonly _steps: Step[][]) {}

  public async run() {
    for (const step of this._steps) {
      if (Array.isArray(step)) {
        await Promise.all(step.map(s => s.run()));
      }
    }
  }
}
