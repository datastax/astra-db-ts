import { spinner } from 'zx';

export interface Step<Ctx = Record<string, any>, R extends Record<string, any> | void = void> {
  (ctx: Ctx): Promise<R>,
}

interface StepOption {
  readonly spinner?: string,
}

export class Steps<Ctx extends Record<string, any> & never> {
  private readonly _steps: Step<Ctx, Record<string, any>>[] = [];

  public if(condition: boolean, step: Step<Ctx>, opts?: StepOption): Steps<Ctx> {
    if (condition) {
      return this.do(step, opts) as any;
    }
    return this as any;
  }

  public do<R extends Record<string, any> | void>(step: Step<Ctx, R>, opts?: StepOption): Steps<Ctx & Exclude<R, void>> {
    const wrappedStep = (ctx: Ctx) => step(ctx).then(r => r ?? {});

    this._steps.push(
      this._maybeWrapWithSpinner(wrappedStep, opts)
    );

    return this as any;
  }

  public doAll(steps: Step<Ctx>[], stepOptions: StepOption): Steps<Ctx> {
    const parallelStep = (ctx: Ctx) =>
      Promise.all(steps.map(step => step(ctx)))
        .then(_ => ({}));

    this._steps.push(
      this._maybeWrapWithSpinner(parallelStep, stepOptions)
    );

    return this;
  }

  public async run(): Promise<Ctx> {
    const ctx: Ctx = {} as Ctx;

    for (const step of this._steps) {
      Object.assign(ctx, await step(ctx));
    }

    return ctx;
  }

  private _maybeWrapWithSpinner<T extends Record<string, any>>(step: Step<Ctx, T>, opts?: StepOption): Step<Ctx, T> {
    if (opts?.spinner) {
      return async (ctx: Ctx) => spinner(opts.spinner!, () => step(ctx));
    }
    return step;
  }
}
