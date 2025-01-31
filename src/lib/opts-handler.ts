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

/**
 * @internal
 */
export type Parsed<Brand> = { [__parsed]: Brand };

/**
 * @internal
 */
export type Unparse<T> = Omit<T, typeof __parsed>;

/**
 * @internal
 */
export type DecoderType<T> = T extends Decoder<infer U> ? U : never;

/**
 * @internal
 */
export interface OptionsHandlerImpl<Types extends OptionsHandlerTypes> {
  decoder: Decoder<Types['Parseable']>,
  refine: (input: Types['Decoded'], field: string | undefined) => Unparse<Types['Parsed']>,
}

/**
 * @internal
 */
export interface MonoidalOptionsHandlerImpl<Types extends OptionsHandlerTypes> extends OptionsHandlerImpl<Types> {
  concat(configs: Types['Parsed'][]): Unparse<Types['Parsed']>,
  empty: Unparse<Types['Parsed']>,
}

/**
 * @internal
 */
export interface OptionsHandlerTypes {
  Parsed: Parsed<string> & unknown,
  Parseable: unknown,
  Decoded: unknown,
}

/**
 * @internal
 */
export class OptionsHandler<Types extends OptionsHandlerTypes> {
  public readonly decoder: Decoder<Types['Parseable']>;
  public readonly parsed!: Types['Parsed'];

  constructor(protected readonly impl: OptionsHandlerImpl<Types>) {
    this.decoder = impl.decoder;
  }

  public parse(input: Types['Parseable'], field?: string): Types['Parsed'] {
    const decoded = this.impl.decoder.verify(input);
    return assertParsed(this.impl.refine(decoded, field));
  }

  public parseWithin<Field extends string>(obj: Partial<Record<Field, Types['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Types['Parsed'] {
    const decoded = this.impl.decoder.verify(obj?.[field.split('.').at(-1) as Field]);
    return assertParsed(this.impl.refine(decoded, field));
  }
}

/**
 * @internal
 */
export class MonoidalOptionsHandler<Types extends OptionsHandlerTypes> extends OptionsHandler<Types> {
  public readonly empty: Types['Parsed'];

  constructor(protected readonly impl: MonoidalOptionsHandlerImpl<Types>) {
    super(impl);
    this.empty = assertParsed(impl.empty);
  }

  public concat(...configs: Types['Parsed'][]): Types['Parsed'] {
    return assertParsed(this.impl.concat(configs));
  }

  public concatParse(configs: Types['Parsed'][], raw: Types['Parseable'], field?: string): Types['Parsed'] {
    return this.concat(...configs, this.parse(raw, field));
  }

  public concatParseWithin<Field extends string>(configs: Types['Parsed'][], obj: Partial<Record<Field, Types['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Types['Parsed'] {
    return this.concat(...configs, this.parseWithin(obj, field));
  }
}

const assertParsed = <T>(input: T): Parsed<string> => input as T & Parsed<string>;
