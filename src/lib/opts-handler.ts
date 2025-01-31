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

import { Decoder } from 'decoders';
import { nullish } from '@/src/lib/index';

declare const __parsed: unique symbol;
export type Parsed = { [__parsed]: true };
export type Unparse<T> = Omit<T, typeof __parsed>;

export interface OptionsHandlerImpl<Opts extends OptionsHandlerOpts> {
  decoder: Decoder<Opts['Parseable']>,
  refine: (input: Opts['Decoded'], field: string | undefined) => Unparse<Opts['Parsed']>,
  concat(configs: Opts['Parsed'][]): Unparse<Opts['Parsed']>,
  empty: Unparse<Opts['Parsed']>,
}

export interface OptionsHandlerOpts {
  Parsed: Parsed & unknown,
  Parseable: unknown,
  Decoded: unknown,
}

export type DecoderType<T> = T extends Decoder<infer U> ? U : never;

export class MonoidalOptionsHandler<Opts extends OptionsHandlerOpts> {
  public readonly empty: Opts['Parsed'];
  public readonly decoder: Decoder<Opts['Parseable']>;

  constructor(private readonly impl: OptionsHandlerImpl<Opts>) {
    this.empty = assertParsed(impl.empty);
    this.decoder = impl.decoder;
  }

  declare readonly parsed: Opts['Parsed'];

  public parse(input: Opts['Parseable'], field?: string): Opts['Parsed'] {
    const decoded = this.impl.decoder.verify(input);
    return assertParsed(this.impl.refine(decoded, field));
  }

  public parseWithin<Field extends string>(obj: Partial<Record<Field, Opts['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Opts['Parsed'] {
    const decoded = this.impl.decoder.verify(obj?.[field.split('.').at(-1) as Field]);
    return assertParsed(this.impl.refine(decoded, field));
  }

  public concat(...configs: Opts['Parsed'][]): Opts['Parsed'] {
    return assertParsed(this.impl.concat(configs));
  }

  public concatParse(configs: Opts['Parsed'][], raw: Opts['Parseable'], field?: string): Opts['Parsed'] {
    return this.concat(...configs, this.parse(raw, field));
  }

  public concatParseWithin<Field extends string>(configs: Opts['Parsed'][], obj: Partial<Record<Field, Opts['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Opts['Parsed'] {
    return this.concat(...configs, this.parseWithin(obj, field));
  }

  // public parseConcat<Field extends string>(configs: Opts['ValidatedType'][], raw: Record<Field, Opts['ParseableType']>, field: Field | `${string}.${Field}`): Opts['ValidatedType'] {
  //   return this.concat([...configs, this.parse(raw, field)]);
  // }
}

const assertParsed = <T>(input: T): Parsed => input as T & Parsed;
