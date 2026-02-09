import 'zx/globals';
import { chalk } from 'zx';

type OptType = string | boolean | string[] | number;
type OptTypeSpecifier = 'string' | 'boolean' | 'string[]' | 'number' | string[];

type TypeOfOpt<Specifier extends OptTypeSpecifier> =
  Specifier extends 'string'
    ? string :
  Specifier extends 'boolean'
    ? boolean :
  Specifier extends 'string[]'
    ? string[] :
  Specifier extends 'number'
    ? number :
  Specifier extends (infer U extends string)[]
    ? U
    : never;

type BasicOpt<Type> = {
  flags: string[],
  default?: Type,
};

type WithBasicOpt<Opts extends Record<string, any>, Key extends string, Opt extends Partial<BasicOpt<any>>, Type> =
  Args<Opts & Record<Key, Type | ('default' extends keyof Opt ? Opt['default'] : never)>>;

type EnumOpt<Opt extends { choices: Record<string, string[]> }> = {
  choices: Record<string, string[]>,
  default?: keyof Opt['choices'] & string,
};

type WithEnumOpt<Opts extends Record<string, any>, Key extends string, Opt extends EnumOpt<any>> =
  Args<Opts & Record<Key, (keyof Opt['choices'] & string)>>

type FakeOpt<Opt extends { type: OptTypeSpecifier }> = {
  flags: string[],
  type: Opt['type'],
  use: (v: TypeOfOpt<Opt['type']>, opts: Record<string, any>) => void,
}

const $NoDefault = Symbol('NoDefault');

interface NormalizedOption {
  key: string,
  flags: string[],
  type: OptTypeSpecifier,
  default: OptType | undefined | typeof $NoDefault,
  isFake?: boolean,
  setValue: (flag: string, value: any, opts: Record<string, any>) => void,
}

export class Args<Opts extends Record<string, any> = {}> {
  private _options: NormalizedOption[] = [];

  constructor(private _file: string) {}

  public boolean<const Key extends string, const Opt extends BasicOpt<boolean>>(key: Key, opt: Opt): WithBasicOpt<Opts, Key, { default: boolean }, boolean> {
    this._options.push({
      key,
      type: 'boolean',
      flags: opt.flags,
      default: 'default' in opt ? opt.default : false,
      setValue: (_, val, opts) => {
        this._setOpt(key, this._coerceOpt(key, val, 'boolean'), opts);
      },
    });
    return this as any;
  }

  public string<const Key extends string, const Opt extends BasicOpt<string>>(key: Key, opt: Opt): WithBasicOpt<Opts, Key, Opt, string> {
    this._options.push({
      key,
      flags: opt.flags,
      type: 'string',
      default: 'default' in opt ? opt.default : $NoDefault,
      setValue: (_, val, opts) => {
        this._setOpt(key, val, opts);
      },
    });

    return this as any;
  }

  public number<const Key extends string, const Opt extends BasicOpt<number>>(key: Key, opt: Opt): WithBasicOpt<Opts, Key, Opt, number> {
    this._options.push({
      key,
      flags: opt.flags,
      type: 'number',
      default: 'default' in opt ? opt.default : $NoDefault,
      setValue: (_, val, opts) => {
        this._setOpt(key, this._coerceOpt(key, val, 'number'), opts);
      },
    });

    return this as any;
  }

  public stringArray<const Key extends string, const Opt extends BasicOpt<string[]>>(key: Key, opt: Opt): WithBasicOpt<Opts, Key, { default: string[] }, string[]> {
    this._options.push({
      key,
      flags: opt.flags,
      type: 'string[]',
      default: 'default' in opt ? opt.default : [],
      setValue: (_, val, opts) => {
        this._setOpt(key, this._coerceOpt(key, val, 'string[]'), opts);
      },
    });

    return this as any;
  }

  public stringEnum<const Key extends string, const Opt extends { choices: Record<string, string[]> } & EnumOpt<Opt>>(key: Key, opt: Opt): WithEnumOpt<Opts, Key, Opt> {
    this._options.push({
      key,
      flags: Object.values(opt.choices).flat(),
      type: 'boolean',
      default: 'default' in opt ? opt.default : $NoDefault,
      setValue: (flag, _, opts) => {
        const [choice] = Object.entries(opt.choices).find(([_, flags]) => flags.includes(flag))!;
        this._setOpt(key, choice, opts);
      },
    });

    return this as any;
  }

  public fake<const Opt extends { type: OptTypeSpecifier } & FakeOpt<Opt>>(opt: Opt): this {
    this._options.push({
      key: Math.random().toString(36),
      flags: opt.flags,
      type: opt.type,
      default: $NoDefault,
      isFake: true,
      setValue: (flag, val, opts) => {
        opt.use(this._coerceOpt(flag, val, opt.type) as any, opts);
      },
    });

    return this;
  }

  public parse(rawArgs = process.argv.slice(2)): Opts {
    const parsedOpts = {} as Opts;

    const flagToCfgLUT = Object.fromEntries(
      this._options.flatMap((cfg) => cfg.flags.map(flag => [flag, cfg])),
    );

    for (const cfg of this._options) {
      if (cfg.default !== $NoDefault) {
        this._setOpt(cfg.key, cfg.default!, parsedOpts);
      }
    }

    for (let opt = this._readOpt(rawArgs, flagToCfgLUT); opt !== null; opt = this._readOpt(rawArgs, flagToCfgLUT)) {
      const cfg = flagToCfgLUT[opt.flag];
      cfg.setValue(opt.flag, opt.value, parsedOpts);
    }
    
    return parsedOpts;
  }

  private _readOpt(rawArgs: string[], flagToCfgLUT: Record<string, NormalizedOption>): { flag: string, value: string } | null {
    if (!rawArgs.length) {
      return null;
    }

    const flag = rawArgs.shift()!;
    const cfg = flagToCfgLUT[flag];

    if (!cfg) {
      this._errorUnknownArgument(flag);
    }

    const isExplicitBoolean = (rawArgs.length > 0 && ['true', 'false'].includes(rawArgs[0].toLowerCase()));

    if (cfg.type === 'boolean' && !isExplicitBoolean) {
      return { flag, value: 'true' };
    }

    if (!rawArgs.length) {
      console.log(chalk.red(`Missing value for flag '${flag}'`));
      process.exit(1);
    }

    return { flag, value: rawArgs.shift()! };
  }

  private _setOpt(key: string, value: OptType, opts: Record<string, any>) {
    switch (true) {
      case Array.isArray(value):
        (opts[key] ??= []).push(...value);
        break;
      default:
        opts[key] = value;
        break;
    }
  }

  private _coerceOpt(key: string, value: string, type: OptTypeSpecifier): OptType {
    switch (true) {
      case type === 'string':
        return value;
      case type === 'boolean':
        return value.toLowerCase() === 'true';
      case type === 'string[]':
        return [value];
      case type === 'number':
        if (isNaN(Number(value))) {
          console.error(`Invalid value '${value}' for flag '${key}'—expected a number`);
          process.exit(1);
        }
        return Number(value);
      case Array.isArray(type):
        if (!type.includes(value)) {
          console.error(`Invalid value '${value}' for flag '${key}'—expected one of: ${type.map(v => `'${v}'`).join(', ')}`);
          process.exit(1);
        }
        return value;
    }

    throw new Error(`Unknown type '${type}' for flag '${key}'`); // shouldn't happen
  }

  private _errorUnknownArgument(arg: string): never {
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
    console.error('Available flags:');

    for (const opts of Object.values(this._options)) {
      console.error(`${opts.flags.join(', ')} :: ${opts.type}` + ((opts.default !== $NoDefault) ? ' = ' + opts.default : ''));
    }

    console.error();
    console.error(`Use 'scripts/${arg} -help' to see all available options/flags & examples of general usage for ${arg}`);
    process.exit(1);
  }
}
