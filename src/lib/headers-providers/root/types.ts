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
// noinspection DuplicatedCode

import type { HeadersProvider, OneOrMany } from '@/src/lib/index.js';

export type AdditionalHeaders = OneOrMany<HeadersProvider | Record<string, string | undefined>>;

export type HeadersProviderVariants = 'embedding' | 'reranking';

export type EmbeddingHeadersProvider = HeadersProvider<'embedding'>;
export type RerankingHeadersProvider = HeadersProvider<'reranking'>;

export interface GetHeadersCtx {
  readonly for: 'devops-api' | 'data-api';
}
