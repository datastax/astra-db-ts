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
import { findLast } from '@/src/lib/utils';

/**
 * @public
 */
export class OptionParseError extends Error {
  constructor(message: string, public readonly field: string | undefined) {
    super(message);
  }
}

/**
 * @internal
 */
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
export interface OptionsHandlerTypes {
  Parsed: Parsed<string> & unknown,
  Parseable: unknown,
}

/**
 * @internal
 */
export class OptionsHandler<Types extends OptionsHandlerTypes> {
  public readonly decoder: Decoder<Types['Parsed']>;

  public readonly parseable!: Types['Parseable'];
  public readonly parsed!: Types['Parsed'];

  constructor(decoder: Decoder<Unparse<Types['Parsed']>>) {
    this.decoder = decoder as Decoder<Types['Parsed']>;
  }

  public parse(input: Types['Parseable'], field?: string): Types['Parsed'] {
    try {
      return assertParsed(this.decoder.verify(input));
    } catch (e) {
      if (!(e instanceof Error) || e.name !== 'Decoding error') {
        throw e;
      }
      throw new OptionParseError(e.message, field);
    }
  }

  public parseWithin<Field extends string>(obj: Partial<Record<Field, Types['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Types['Parsed'] {
    return this.parse(obj?.[field.split('.').at(-1) as Field], field);
  }
}

/**
 * @internal
 */
export class MonoidalOptionsHandler<Types extends OptionsHandlerTypes> extends OptionsHandler<Types> implements Monoid<Unparse<Types['Parsed']>> {
  public readonly empty: Types['Parsed'];

  constructor(decoder: Decoder<Unparse<Types['Parsed']>>, private readonly monoid: Monoid<Unparse<Types['Parsed']>>) {
    super(decoder);
    this.empty = assertParsed(monoid.empty);
  }

  public concat(configs: Types['Parsed'][]): Types['Parsed'] {
    return assertParsed(this.monoid.concat(configs));
  }

  public concatParse(configs: Types['Parsed'][], raw: Types['Parseable'], field?: string): Types['Parsed'] {
    return this.concat([...configs, this.parse(raw, field)]);
  }

  public concatParseWithin<Field extends string>(configs: Types['Parsed'][], obj: Partial<Record<Field, Types['Parseable']>> | nullish, field: Field | `${string}.${Field}`): Types['Parsed'] {
    return this.concat([...configs, this.parseWithin(obj, field)]);
  }
}

const assertParsed = <T>(input: T): Parsed<string> => input as T & Parsed<string>;

/**
 * @internal
 */
export interface Monoid<A> {
  empty: A;
  concat(as: A[]): A;
}

/**
 * @internal
 */
type MonoidSchema<T> = {
  [K in keyof T]: Monoid<T[K]>;
};

/**
 * @internal
 */
export type MonoidType<T> = T extends Monoid<infer U> ? U : never;

/**
 * @internal
 */
export const monoids = <const>{
  optional: <T>(): Monoid<T | undefined> => ({
    empty: undefined,
    concat: findLast<T | undefined>((a) => a !== undefined && a !== null),
  }),
  record: <T>(): Monoid<Record<string, T>> => ({
    empty: {},
    concat: (as) => as.reduce((acc, next) => ({ ...acc, ...next }), {}),
  }),
  array: <T>(): Monoid<T[]> => ({
    empty: [],
    concat: (as) => as.flat(),
  }),
  prependingArray: <T>(): Monoid<T[]> => ({
    empty: [],
    concat: (as) => as.reduce((acc, next) => [...next, ...acc], []),
  }),
  object<const T>(schema: MonoidSchema<T>): Monoid<T> {
    const schemaEntries = Object.entries(schema) as [keyof typeof schema, Monoid<any>][];

    const empty = Object.fromEntries(schemaEntries.map(([k, v]) => [k, v.empty])) as T;

    const concat = (configs: T[]): T => {
      const result = { ...empty } as T;

      for (const config of configs) {
        for (const [key, monoid] of schemaEntries) {
          result[key] = monoid.concat([result[key], config[key]]);
        }
      }

      return result;
    };

    return { empty, concat };
  },
};
