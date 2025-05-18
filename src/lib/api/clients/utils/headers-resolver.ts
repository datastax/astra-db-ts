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

import type { ParsedHeadersProviders } from '@/src/lib/headers-providers/root/opts-handlers.js';
import { type GetHeadersCtx, HeadersProvider, PureHeadersProvider } from '@/src/lib/index.js';

export interface HeadersResolverAdapter {
  target: GetHeadersCtx['for'];
}

/**
 * @internal
 */
export class HeadersResolver {
  private readonly _resolveStrategy: StaticHeadersResolveStrategy | DynamicHeadersResolveStrategy;

  constructor(adapter: HeadersResolverAdapter, additionalHeaders: ParsedHeadersProviders, baseHeaders: Record<string, any>) {
    const queue = this._mkResolveQueue(adapter, additionalHeaders);

    if (queue.length <= 1 && !(queue[0] instanceof HeadersProvider)) {
      this._resolveStrategy = new StaticHeadersResolveStrategy({ ...baseHeaders, ...queue[0] });
    } else {
      this._resolveStrategy = new DynamicHeadersResolveStrategy(adapter.target, baseHeaders, queue);
    }
  }

  public resolve() {
    return this._resolveStrategy.resolve();
  }

  private _mkResolveQueue(adapter: HeadersResolverAdapter, headerProviders: ParsedHeadersProviders) {
    const ctx: GetHeadersCtx = { for: adapter.target };
    const ret = [] as (Record<string, string> | HeadersProvider)[];

    let staticAcc = {} as Record<string, string>;

    for (const provider of headerProviders.providers) {
      // noinspection SuspiciousTypeOfGuard -- the lsp is wrong here
      if (provider instanceof PureHeadersProvider) {
        assignNonUndefined(staticAcc, provider.getHeaders(ctx));
      } else {
        ret.push(staticAcc);
        ret.push(provider);
        staticAcc = {};
      }
    }
    ret.push(staticAcc);

    return ret.filter((obj) => {
      return Object.keys(obj).length > 0;
    });
  }
}

/**
 * @internal
 */
class StaticHeadersResolveStrategy {
  constructor(private readonly _headers: Record<string, string>) {}

  public resolve(): Record<string, string> {
    return this._headers;
  }
}

/**
 * @internal
 */
class DynamicHeadersResolveStrategy {
  constructor(
    private readonly _target: GetHeadersCtx['for'],
    private readonly _baseHeaders: Record<string, any>,
    private readonly _resolveQueue: (Record<string, string | undefined> | HeadersProvider)[],
  ) {}

  public async resolve(): Promise<Record<string, string>> {
    const headers = { ...this._baseHeaders };

    for (const item of this._resolveQueue) {
      if (item instanceof HeadersProvider) {
        assignNonUndefined(headers, await item.getHeaders({ for: this._target }));
      } else {
        assignNonUndefined(headers, item);
      }
    }

    return headers;
  }
}

function assignNonUndefined(target: Record<string, string>, source: Record<string, string | undefined>) {
  for (const key in source) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
}
