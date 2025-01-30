// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Normalize } from '@/src/db';
import { Decoder } from 'decoders';
import { nullish } from '@/src/lib/index';

// type SomeFunc = (...args: any[]) => any;
//
// type GeneralizeFns<T extends SomeDoc> = {
//   [K in keyof T]: T[K] extends SomeFunc ? SomeFunc : T[K];
// };

export type Roughly<T> = T extends Record<string, any> ? Normalize<{
  [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K]
}> : T;

export interface ConfigHandlerImpl<Opts extends OptionsHandlerOpts> {
  decoder: Decoder<Roughly<Opts['Parseable']>>,
  transform: (input: Opts['Parsed'], field: string) => Opts['Transformed'],
  concat(configs: Opts['Transformed'][]): Opts['Transformed'],
  empty: Opts['Transformed'],
}

export interface OptionsHandlerOpts {
  Transformed: unknown,
  Parseable: unknown,
  Parsed: unknown,
}

export type DecoderType<T> = T extends Decoder<infer U> ? U : never;

export class OptionsHandler<Opts extends OptionsHandlerOpts> {
  public readonly empty: Opts['Transformed'];
  public readonly decoder: Decoder<Roughly<Opts['Parseable']>>;

  constructor(private readonly impl: ConfigHandlerImpl<Opts>) {
    this.empty = impl.empty;
    this.decoder = impl.decoder;
  }

  declare readonly transformed: Opts['Transformed'];

  public parse(input: Opts['Parseable'], field: string): Opts['Transformed'] {
    const decoded = this.impl.decoder.verify(input);
    return this.impl.transform(decoded, field);
  }

  public parseWithin<Field extends string>(obj: Partial<Record<Field, Opts['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Opts['Transformed'] {
    const decoded = this.impl.decoder.verify(obj?.[field.split('.').at(-1) as Field]);
    return this.impl.transform(decoded, field);
  }

  public concat(...configs: Opts['Transformed'][]): Opts['Transformed'] {
    return this.impl.concat(configs);
  }

  public concatParse<Field extends string>(configs: Opts['Transformed'][], raw: Record<Field, Opts['Parseable']>, field: Field | `${string}.${Field}`): Opts['Transformed'] {
    return this.concat(...configs, this.parse(raw, field));
  }

  public concatParseWithin<Field extends string>(configs: Opts['Transformed'][], obj: Partial<Record<Field, Opts['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Opts['Transformed'] {
    return this.concat(...configs, this.parseWithin(obj, field));
  }

  // public parseConcat<Field extends string>(configs: Opts['ValidatedType'][], raw: Record<Field, Opts['ParseableType']>, field: Field | `${string}.${Field}`): Opts['ValidatedType'] {
  //   return this.concat([...configs, this.parse(raw, field)]);
  // }
}
