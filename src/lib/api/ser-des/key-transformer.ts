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

import { BaseDesCtx, BaseSerCtx } from '@/src/lib';

/**
 * @public
 */
export abstract class KeyTransformer {
  public abstract serializeKey(key: string, ctx: BaseSerCtx): string;
  public abstract deserializeKey(key: string, ctx: BaseDesCtx): string;
}

/**
 * @public
 */
export class Camel2SnakeCase extends KeyTransformer {
  private _cache: Record<string, string> = { _id: '_id' };

  public override serializeKey(camel: string, ctx: BaseSerCtx): string {
    if (ctx.path.length > 1 || !camel) {
      return camel;
    }
    if (this._cache[camel]) {
      return this._cache[camel];
    }
    return this._cache[camel] = camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  public override deserializeKey(snake: string, ctx: BaseDesCtx): string {
    if (ctx.path.length > 1 || !snake) {
      return snake;
    }
    if (this._cache[snake]) {
      return this._cache[snake];
    }
    return this._cache[snake] = snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
