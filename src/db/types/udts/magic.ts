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

import type { CreateTypeDefinition, DataAPIType2TSType, DataAPITypes } from '@/src/db/index.js';
import type { LitUnion } from '@/src/lib/index.js';
import type { SomeRow } from '@/src/documents/index.js';

export type InferUDTSchema<Def extends CreateTypeDefinition, Overrides extends UDTSchemaInferenceOverrides = Record<never, never>> = {
  -readonly [FieldName in keyof Def['fields']]: FieldName extends keyof Overrides['fieldOverrides'] ? Overrides['fieldOverrides'][FieldName] : DataAPIType2TSType<Def['fields'][FieldName], Overrides['typeOverrides']>;
};

export type ResolveUDTSchema<DefOrSchema extends SomeRow> =
  DefOrSchema extends CreateTypeDefinition
    ? InferUDTSchema<DefOrSchema>
    : DefOrSchema;

export interface UDTSchemaInferenceOverrides {
  typeOverrides?: Partial<Record<LitUnion<DataAPITypes>, unknown>>,
  fieldOverrides?: Record<string, unknown>,
}
