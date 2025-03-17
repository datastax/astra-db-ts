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

import type { GetHeadersCtx, HeadersProviderVariants} from '@/src/lib/index.js';
import { PureHeadersProvider } from '@/src/lib/headers-providers/index.js';

export class StaticHeadersProvider<Tag extends HeadersProviderVariants = any> extends PureHeadersProvider<Tag> {
  readonly #headers: Record<string, string | undefined>;

  public constructor(headers: Record<string, string | undefined>) {
    super();
    this.#headers = headers;
  }

  public override getHeaders(_: GetHeadersCtx): Record<string, string | undefined> {
    return this.#headers;
  }
}
