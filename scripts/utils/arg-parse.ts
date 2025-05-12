import { which } from 'zx';

type ArgParseOptions = Record<string, [args: string[], type: 'string' | 'boolean', opts?: AdditionalArgParseOptions | string | boolean]>;

type AdditionalArgParseOptions =
  | { default?: undefined, listen?: (value: string | boolean | undefined) => void }
  | { default: string | boolean, listen?: (value: string | boolean) => void }

type ArgsType<T extends ArgParseOptions> = {
  [key in keyof T]: T[key] extends [args: string[], type: 'string', ifNotPresent?: unknown] ? string : boolean;
}

export class Args<const T extends ArgParseOptions> {
  constructor(private readonly _options: T) {}

  public parse(): ArgsType<T> {
    const rawArgs = process.argv.slice(2);
    const parsedArgs = {} as ArgsType<any>;
    const reverseLUT = Object.fromEntries(Object.entries(this._options).flatMap(([key, [args]]) => args.map(arg => [arg, key])));

    for (let rawArg = rawArgs.shift(); rawArg !== undefined; rawArg = rawArgs.shift()) {
      const argName = reverseLUT[rawArg] ?? this._throwUnknownArgument(rawArg);
      const [, type] = this._options[argName];

      switch (true) {
        case type === 'string':
          const value = rawArgs.shift();

          if (value === undefined) {
            throw new Error(`Missing value for argument: ${rawArg}`);
          }

          parsedArgs[argName] = value;
          break;

        case type === 'boolean' && ['true', 'false'].includes(rawArgs[0].toLowerCase()):
          parsedArgs[argName] = rawArgs[0].toLowerCase() === 'true';
          break;

        case type === 'boolean':
          parsedArgs[argName] = true;
          break;
      }
    }

    for (const [key, [,, opts]] of Object.entries(this._options)) {
      if (getDefault(opts) !== undefined && !(key in parsedArgs)) {
        parsedArgs[key] = getDefault(opts)!;
      }

      if (getListen(opts)) {
        getListen(opts)!(parsedArgs[key]);
      }
    }

    return parsedArgs;
  }

  private async _throwUnknownArgument(arg: string) {
    if (['-h', '-help', '--help'].includes(arg)) {
      const docFile = $.sync`echo "$(dirname ${__dirname})/docs/${arg}.md"`;

      for (const program of ['glow', 'mdcat', 'mdless', 'bat', 'cat']) {
        if (which.sync(program, { nothrow: true })) {
          console.log($.sync`${program} docFile`);
          process.exit(0);
        }
      }

      console.log(`See ${docFile} for more information on how to use this script.`);
      process.exit(0);
    }

    console.error(`Invalid option '${arg}'`);
    console.error();
    console.error('Available options:');

    for (const [args, type, opts] of Object.values(this._options)) {
      console.error(`${args.join(', ')} :: ${type}` + (getDefault(opts) !== undefined ? ' = ' + getDefault(opts) : ''));
    }

    console.error();
    console.error(`Use 'scripts/${arg} -help' to see all available options/flags & examples of general usage for ${arg}`);
    process.exit(1);
  }
}

function getDefault(opts?: AdditionalArgParseOptions | string | boolean) {
  if (opts === undefined) {
    return undefined;
  }

  if (typeof opts === 'string' || typeof opts === 'boolean') {
    return opts;
  }

  return opts.default;
}

function getListen(opts?: AdditionalArgParseOptions | string | boolean) {
  if (opts && typeof opts === 'object') {
    return opts.listen;
  }

  return undefined;
}
