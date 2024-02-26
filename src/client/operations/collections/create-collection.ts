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

import { ToDotNotation } from '@/src/client/operations/dot-notation';
import { SomeDoc } from '@/src/client/document';

export interface CreateCollectionCommand {
  createCollection: {
    name: string;
    options?: Record<string, any>;
  };
}

export interface CreateCollectionOptions<Schema extends SomeDoc> {
  vector?: VectorOptions;
  vectorize?: VectorizeOptions;
  indexing?: IndexingOptions<Schema>;
}

interface VectorOptions {
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dot_product';
}

interface VectorizeOptions {
  service: 'openai' | 'vertexai' | 'huggingface';
  options?: Record<string, unknown>;
}

type IndexingOptions<Schema extends SomeDoc> =
  | { allow: (keyof ToDotNotation<Schema>)[] | ['*'], deny?:  never }
  | { deny:  (keyof ToDotNotation<Schema>)[] | ['*'], allow?: never }

export const createCollectionOptionsKeys = new Set(['vector', 'indexing']);
