import { spinner } from 'zx';

export interface Step<Ctx = Record<string, any>, R extends Record<string, any> | void = void> {
  (ctx: Ctx): Promise<R>,
}

interface StepOption {
  readonly spinner?: string,
}

export class Steps<Ctx extends Record<string, any>> {
  private readonly _steps: Step<Ctx, Record<string, any>>[] = [];

  public if(condition: boolean, step: Step<Ctx>, opts?: StepOption): Steps<Ctx> {
    if (condition) {
      return this.one(step, opts) as any;
    }
    return this as any;
  }

  public one<R extends Record<string, any> | void>(step: Step<Ctx, R>, opts?: StepOption): Steps<Ctx & Exclude<R, void>> {
    this._steps.push(this._maybeWrapWithSpinner((ctx) => step(ctx).then(r => r ?? {}), opts));
    return this as any;
  }

  public all(...steps: (Step<Ctx> | StepOption)[]): Steps<Ctx> {
    const stepOptions = typeof steps.at(-1) !== 'function' ? steps.pop() as StepOption : undefined;
    const step = (ctx: Ctx) => Promise.all(steps.map(step => (step as Step<Ctx>)(ctx))).then(_ => ({}));
    this._steps.push(this._maybeWrapWithSpinner(step, stepOptions));
    return this;
  }

  public async run() {
    const ctx: Ctx = {} as Ctx;

    for (const step of this._steps) {
      Object.assign(ctx, await step(ctx));
    }
  }

  private _maybeWrapWithSpinner<T extends Record<string, any>>(step: Step<Ctx, T>, opts?: StepOption): Step<Ctx, T> {
    if (opts?.spinner) {
      return async (ctx: Ctx) => spinner(opts.spinner!, () => step(ctx));
    }
    return step;
  }
}
