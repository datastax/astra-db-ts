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

export interface KeyTransformerCtx {
  path: string[];
}

/**
 * @public
 */
export abstract class KeyTransformer {
  public abstract serializeKey(key: string, ctx: KeyTransformerCtx): string;
  public abstract deserializeKey(key: string, ctx: KeyTransformerCtx): string;
  public abstract shouldRecurse(ctx: KeyTransformerCtx): boolean;

  public serialize(obj: SomeDoc, ctx: KeyTransformerCtx) {
    return this._immutSerdesHelper(obj, ctx, this.serializeKey.bind(this));
  }

  public deserialize(obj: SomeDoc, ctx: KeyTransformerCtx) {
    return this._immutSerdesHelper(obj, ctx, this.deserializeKey.bind(this));
  }

  private _immutSerdesHelper(obj: SomeDoc, ctx: KeyTransformerCtx, fn: (key: string, ctx: KeyTransformerCtx) => string) {
    const ret: SomeDoc = Array.isArray(obj) ? [] : {};

    const path = ctx.path;
    path.push('<temp>');

    for (const key of Object.keys(obj)) {
      path[path.length - 1] = key;

      const newKey = fn(key, ctx);
      ret[newKey] = obj[key];

      if (typeof obj[key] === 'object' && obj[key] !== null && this.shouldRecurse(ctx)) {
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
  cached?: boolean;
  exceptId?: boolean;
  deep?: boolean;
}

/**
 * @public
 */
export class Camel2SnakeCase extends KeyTransformer {
  /**
   * @internal
   */
  private readonly _impl: Camel2SnakeCaseImpl;

  private readonly _deep: boolean;

  private readonly _exceptId: boolean;

  constructor(opts: Camel2SnakeCaseOptions = {}) {
    super();
    this._impl = opts.cached ? new CachedCamel2SnakeCase() : UncachedCamel2SnakeCase;
    this._deep = opts.deep === true;
    this._exceptId = opts.exceptId !== false;
  }

  public shouldRecurse(ctx: KeyTransformerCtx): boolean {
    return this._deep || ctx.path.length === 0;
  }

  public override serializeKey(camel: string): string {
    if (!camel || this._exceptId && camel === '_id') {
      return camel;
    }
    return this._impl.camel2SnakeCase(camel);
  }

  public override deserializeKey(snake: string): string {
    if (!snake || this._exceptId && snake === '_id') {
      return snake;
    }
    return this._impl.snake2CamelCase(snake);
  }
}

interface Camel2SnakeCaseImpl {
  snake2CamelCase(snake: string): string;
  camel2SnakeCase(camel: string): string;
}

class CachedCamel2SnakeCase implements Camel2SnakeCaseImpl {
  private _cache: Record<string, string> = {};

  public snake2CamelCase(camel: string): string {
    if (this._cache[camel]) {
      return this._cache[camel];
    }
    return this._cache[camel] = UncachedCamel2SnakeCase.snake2CamelCase(camel);
  }

  public camel2SnakeCase(snake: string): string {
    if (this._cache[snake]) {
      return this._cache[snake];
    }
    return this._cache[snake] = UncachedCamel2SnakeCase.camel2SnakeCase(snake);
  }
}

const UncachedCamel2SnakeCase: Camel2SnakeCaseImpl = {
  snake2CamelCase(snake: string): string {
    return snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  },
  camel2SnakeCase(camel: string): string {
    return camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  },
};
