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

import type { GetHeadersCtx, HeadersProviderVariants } from '@/src/lib/index.js';
import type {
  ObjectBasedHeadersProviderOptsHandler, ParsedHeadersProviders,
  StringBasedHeadersProviderOptsHandler,
} from '@/src/lib/headers-providers/root/opts-handlers.js';
import type { Monoid } from '@/src/lib/opts-handler.js';

export abstract class HeadersProvider<Tag extends HeadersProviderVariants = any> {
  public declare readonly _phant: `Expected a HeaderProvider specifically for ${Tag}s (e.g. \`class ${Capitalize<Tag>}HeadersProvider extends HeadersProvider<'${Tag}'>\`).`;

  /**
   * @internal
   */
  public static opts: {
    fromStr: typeof StringBasedHeadersProviderOptsHandler,
    fromObj: typeof ObjectBasedHeadersProviderOptsHandler,
    monoid: Monoid<ParsedHeadersProviders>,
    parsed: ParsedHeadersProviders,
  };

  public abstract getHeaders(ctx: GetHeadersCtx): Promise<Record<string, string | undefined>> | Record<string, string | undefined>;
}
