import 'zx/globals';

type OptType = string | boolean | string[] | number;
type OptTypeSpecifier = 'string' | 'boolean' | 'string[]' | 'number' | string[];

type RealOptsConfig = Record<string, {
  flags: string[],
  type: OptTypeSpecifier,
  default?: OptType,
}>;

type BackingOptsConfig = Record<string, {
  type: OptTypeSpecifier,
  default?: OptType,
}>;

type FauxOptsConfig<Opts extends Record<string, any>> = {
  flags: string[],
  type: OptTypeSpecifier,
  use: (opt: any, opts: Opts) => void,
}[];

type TypeOfOpt<Specifier extends OptTypeSpecifier> =
  Specifier extends 'string'
    ? string :
  Specifier extends 'boolean'
    ? boolean :
  Specifier extends 'string[]'
    ? string[] :
  Specifier extends 'number'
    ? number :
  Specifier extends (infer U)[]
    ? U
    : never;

type TypeOfRealOpts<T extends RealOptsConfig> = {
  -readonly [K in keyof T]: TypeOfOpt<T[K]['type']>;
}

type TypeOfBackingOpts<T extends BackingOptsConfig> = {
  -readonly [K in keyof T]: TypeOfOpt<T[K]['type']>;
}

export type TypeOfOpts<RealOpts extends RealOptsConfig, BackingOpts extends BackingOptsConfig> = TypeOfRealOpts<RealOpts> & TypeOfBackingOpts<BackingOpts>;

interface NormalizedOpt {
  kind: 'real' | 'backing' | 'faux',
  flags: string[],
  type: OptTypeSpecifier,
  default?: OptType,
  use?: (opt: any, opts: any) => void,
}

export class Opts<const Real extends RealOptsConfig, const Backing extends BackingOptsConfig> {
  private _options: Record<string, NormalizedOpt> = {};

  constructor(private _file: string) {}

  public real<const NewReal extends RealOptsConfig>(options: NewReal): Opts<NewReal & Omit<Real, keyof NewReal>, Backing> {
    for (const [key, opts] of Object.entries(options)) {
      this._options[key] = { kind: 'real', ...opts };
    }
    return this as any;
  }

  public backing<const NewBacking extends BackingOptsConfig>(options: NewBacking): Opts<Real, NewBacking & Omit<Backing, keyof NewBacking>> {
    for (const [key, opts] of Object.entries(options)) {
      this._options[key] = { kind: 'backing', flags: [], ...opts };
    }
    return this as any;
  }

  public faux(options: FauxOptsConfig<TypeOfOpts<Real, Backing>>): Opts<Real, Backing> {
    for (const opts of options) {
      this._options[Math.random()] = { kind: 'faux', ...opts };
    }
    return this;
  }

  public parse(rawArgs = process.argv.slice(2)): TypeOfOpts<Real, Backing> {
    const parsedOpts = {} as TypeOfOpts<Real, Backing>;
    const reverseLUT = Object.fromEntries(Object.entries(this._options).flatMap(([key, { flags }]) => flags.map(flag => [flag, key])));

    for (let rawArg = rawArgs.shift(); rawArg !== undefined; rawArg = rawArgs.shift()) {
      const optName = reverseLUT[rawArg] ?? this._throwUnknownArgument(rawArg);
      const { type } = this._options[optName];

      switch (true) {
        case type === 'string[]': {
          const value = rawArgs.shift();

          if (value === undefined) {
            throw new Error(`Missing string value for argument: ${rawArg}`);
          }

          ((<string[]>parsedOpts[optName]) ??= []).push(value);
          break;
        }

        case type === 'string': {
          const value = rawArgs.shift();

          if (value === undefined) {
            throw new Error(`Missing string value for argument: ${rawArg}`);
          }

          (<string>parsedOpts[optName]) = value;
          break;
        }

        case type === 'number': {
          const value = rawArgs.shift();

          if (value === undefined) {
            throw new Error(`Missing numerical value for argument: ${rawArg}`);
          }

          if (isNaN(Number(value))) {
            throw new Error(`Invalid numerical value for argument: ${rawArg}`);
          }

          (<number>parsedOpts[optName]) = Number(value);
          break;
        }

        case type === 'boolean' && ['true', 'false'].includes(rawArgs[0]?.toLowerCase()):
          (<boolean>parsedOpts[optName]) = rawArgs[0].toLowerCase() === 'true';
          break;

        case type === 'boolean':
          (<boolean>parsedOpts[optName]) = true;
          break;

        case Array.isArray(type):
          const value = rawArgs.shift();

          if (value === undefined) {
            throw new Error(`Missing value for argument: ${rawArg}`);
          }

          (<unknown>parsedOpts[optName]) = value;
          break;
      }
    }

    for (const [key, cfg] of Object.entries(this._options)) {
      if (!(key in parsedOpts) && 'default' in cfg && cfg.kind !== 'faux') {
        (<unknown>parsedOpts[key]) = cfg.default;
      }
    }

    for (const [key, cfg] of Object.entries(this._options)) {
      cfg?.use?.(parsedOpts[key], parsedOpts);
    }

    for (const [key, cfg] of Object.entries(this._options)) {
      if (!(key in parsedOpts) && cfg.kind !== 'faux') {
        throw new Error(`Missing required argument: ${key}`);
      }
    }

    return parsedOpts;
  }

  private _throwUnknownArgument(arg: string): never {
    if (['-h', '-help', '--help'].includes(arg)) {
      const docFile = `scripts/docs/${this._file}.md`;

      for (const program of ['glow', 'mdcat', 'mdless', 'bat', 'cat']) {
        if (which.sync(program, { nothrow: true })) {
          $.sync({ stdio: 'inherit' })`${program} ${docFile}`;
          process.exit(0);
        }
      }

      console.log(`See ${docFile} for more information on how to use this script.`);
      process.exit(0);

    }

    console.error(`Invalid option '${arg}'`);
    console.error();
    console.error('Available options:');

    for (const opts of Object.values(this._options)) if (opts.kind !== 'backing') {
      console.error(`${opts.flags.join(', ')} :: ${opts.type}` + (('default' in opts) ? ' = ' + opts.default : ''));
    }

    console.error();
    console.error(`Use 'scripts/${arg} -help' to see all available options/flags & examples of general usage for ${arg}`);
    process.exit(1);
  }
}
