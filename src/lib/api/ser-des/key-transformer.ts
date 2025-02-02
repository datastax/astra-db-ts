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

import { SomeDoc } from '@/src/index';
import { isBigNumber } from '@/src/lib/utils';

/**
 * ##### Overview (Beta)
 *
 * The context object passed to key transformer methods.
 *
 * Contains the current path of the object being transformed.
 *
 * The invariant `path.at(-1) === key` holds.
 *
 * @beta
 */
export interface KeyTransformerCtx {
  path: (string | number)[],
}

/**
 * ##### Overview (Beta)
 *
 * A key transformer to customize how keys are serialized and deserialized.
 *
 * May be most commonly used to convert between camelCase and snake_case, via the {@link Camel2SnakeCase} transformer (see {@link Camel2SnakeCase} documentation for more details).
 *
 * ##### General usage information
 *
 * - The key transformer is run immediately before the document is sent to the server, and immediately after the document is received from the server.
 *   - This means that any custom codecs should treat the document as if the keys are in the format that the client expects (e.g., camelCase).
 *   - For example, `CollCodecs.forName('myField', ...)` instead of `'my_field'`
 * - The key transformer only affects inserted/read rows/documents, filters, and table primary keys.
 *   - **Things like table/index definitions are not affected**.
 *
 * ##### Implementing your own key transformer
 *
 * Implementing a key transformer is not as easy as implementing the `serializeKey` and `deserializeKey` methods, and calling it a day.
 *
 * *Which keys to actually transform* is also a concern, with the issue being split into two classes for minor optimization reasons:
 * - `serializeKey` and `deserializeKey` are used to transform keys in the current object.
 *   - Within these methods, additional logic may be added to determine whether to transform that specific key or not
 * - `transformNested` is used to determine whether to transform nested objects.
 *   - This is useful for cases where you want to transform the keys of the current object, but not the keys of nested objects.
 *   - This saves you from having to deeply recurse over objects you didn't mean to transform in the first place.
 *
 * See the documentation of each abstract method for more information.
 *
 * ##### Context
 *
 * A context object is passed to the method, which contains the current path of the object being transformed.
 *
 * The invariant `path.at(-1) === key` holds.
 *
 * You may see {@link Camel2SnakeCase} for the reference example of a key transformer.
 *
 * @beta
 */
export abstract class KeyTransformer {
  /**
   * ##### Overview (Beta)
   *
   * Transforms a client-intended key to a server-intended key (e.g. camelCase to snake_case).
   *
   * ##### Implementation considerations
   *
   * - Additional logic may be desired to determine if that specific key should be transformed or not
   *   - For example, you may want to skip transforming keys like `_id` or keys that start with `$`
   * - Depending on your use case, caching the transformed key may be beneficial
   *
   * @param key - The key to transform
   * @param ctx - Additional context information
   *
   * @returns The transformed key
   */
  public abstract serializeKey(key: string, ctx: KeyTransformerCtx): string;

  /**
   * ##### Overview (Beta)
   *
   * Transforms a server-intended key to a client-intended key (e.g. snake_case to camelCase).
   *
   * ##### Implementation considerations
   *
   * - Additional logic may be desired to determine if that specific key should be transformed or not
   *   - For example, you may want to skip transforming keys like `_id` or keys that start with `$`
   * - Depending on your use case, caching the transformed key may be beneficial
   *
   * @param key - The key to transform
   * @param ctx - Additional context information
   *
   * @returns The transformed key
   */
  public abstract deserializeKey(key: string, ctx: KeyTransformerCtx): string;

  /**
   * ##### Overview (Beta)
   *
   * Determines whether to transform nested objects.
   *
   * For example, given object `{ a: { b: 1 } }`, this will be called with ctx `{ path: ['a'] }`.
   * - If it returns `true`, the key transformer will recurse, and be called for each of the keys of the nested object.
   * - If it returns `false`, the key transformer will not recurse, and the nested object will be left as-is.
   *
   * ##### Implementation considerations
   *
   * If you only want specific keys of the nested object to be transformed, this function must return `true`, with
   * additional logic in `serializeKey` and `deserializeKey` to determine whether to transform that specific key.
   *
   * An option (which {@link Camel2SnakeCase} uses) is to simply delegate this decision to the caller, via a function passed in the constructor.
   *
   * @param ctx - Additional context information
   *
   * @returns `true` if nested objects should be transformed, `false` otherwise
   */
  public abstract transformNested(ctx: KeyTransformerCtx): boolean;

  /**
   * @internal
   */
  public serialize(obj: unknown, ctx: KeyTransformerCtx) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    return this._immutSerdesHelper(obj, ctx, this.serializeKey.bind(this));
  }

  /**
   * @internal
   */
  public deserialize(obj: unknown, ctx: KeyTransformerCtx) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    return this._immutSerdesHelper(obj, ctx, this.deserializeKey.bind(this));
  }

  /**
   * @internal
   */
  private _immutSerdesHelper(obj: SomeDoc, ctx: KeyTransformerCtx, fn: (key: string, ctx: KeyTransformerCtx) => string) {
    const ret: SomeDoc = Array.isArray(obj) ? [] : {};

    const path = ctx.path;
    path.push('<temp>');

    for (const key of Object.keys(obj)) {
      path[path.length - 1] = key;

      const newKey = fn(key, ctx);
      ret[newKey] = obj[key];

      const isObj = typeof obj[key] === 'object' && obj[key] !== null;
      const isLegalObj = isObj && !isBigNumber(obj[key]);

      if (isLegalObj && this.transformNested(ctx)) {
        ret[newKey] = this._immutSerdesHelper(obj[key], ctx, fn);
      }
    }

    path.pop();
    return ret;
  }
}

/**
 * @public
 */
export interface Camel2SnakeCaseOptions {
  exceptId?: boolean,
  exceptDollar?: boolean,
  transformNested?: boolean | ((path: KeyTransformerCtx) => boolean),
}

/**
 * @public
 */
export class Camel2SnakeCase extends KeyTransformer {
  private readonly _transformNested?: (path: KeyTransformerCtx) => boolean;
  private readonly _exceptId: boolean;
  private readonly _exceptDollar: boolean;

  constructor({ exceptId, exceptDollar, transformNested }: Camel2SnakeCaseOptions = {}) {
    super();

    this._exceptId = exceptId !== false;
    this._exceptDollar = exceptDollar !== false;

    this._transformNested = (typeof transformNested === 'boolean')
      ? () => transformNested
      : transformNested;
  }

  public override transformNested(ctx: KeyTransformerCtx): boolean {
    return this._transformNested?.(ctx) ?? false;
  }

  public override serializeKey(camel: string): string {
    if (!camel || this._exceptId && camel === '_id' || this._exceptDollar && camel.startsWith('$')) {
      return camel;
    }
    return camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  public override deserializeKey(snake: string): string {
    if (!snake || this._exceptId && snake === '_id' || this._exceptDollar && snake.startsWith('$')) {
      return snake;
    }

    return snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
