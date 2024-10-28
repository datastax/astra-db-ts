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

import { ObjectId, SomeDoc, UUID } from '@/src/documents';
import { $SerializeStrict, DataAPIDesCtx, DataAPIDesFn, DataAPISerCtx, DataAPISerFn } from '@/src/lib/api/ser-des';

export interface CollectionSerDes<Schema extends SomeDoc> {
  serialize: DataAPISerFn<DataAPISerCtx<Schema>>,
  deserialize: DataAPIDesFn<DataAPIDesCtx>,
}

export const DefaultCollectionSerDes: CollectionSerDes<SomeDoc> = {
  serialize(key, value) {
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return [{ $date: this[key].valueOf() }, false];
      }

      if ($SerializeStrict in value) {
        return [value[$SerializeStrict](), false];
      }
    }
    return undefined;
  },
  deserialize(key, value) {
    if (typeof value === 'object') {
      if ($SerializeStrict in value || value instanceof Date) {
        return;
      }

      if (value.$date) {
        this[key] = new Date(value.$date);
      }

      if (value.$objectId) {
        this[key] = new ObjectId(value.$objectId);
      }

      if (value.$uuid) {
        this[key] = new UUID(value.$uuid);
      }
    }
  },
};
