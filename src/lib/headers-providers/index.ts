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

export * from './root/headers-provider.js';
export * from './root/pure-headers-provider.js';
export type * from './root/types.js';
export * from './impls/any/static-headers-provider.js';
export * from './impls/reranking/reranking-api-key-header-provider.js';
export * from './impls/embedding/embedding-api-key-header-provider.js';
export * from './impls/embedding/aws-embedding-headers-provider.js';

import './root/opts-handlers.js'; // loads HeadersProviders.opts w/out causing circular dependencies
