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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { dummyCollection, TestSchema } from '@/tests/typing/collections/prelude';
import { Equal, Expect } from '@/tests/typing/prelude';
import { FindCursor } from '@/src/client/cursor';
import { IdOf } from '@/src/client/types/utils';

type GetTOfCursor<Cursor> = Cursor extends FindCursor<infer T> ? T : undefined;
type GetTRawOfCursor<Cursor> = Cursor extends FindCursor<any, infer TRaw> ? TRaw : undefined;

{
  const cursor = dummyCollection<TestSchema>().find({});

  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;

  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, TestSchema & { $similarity?: never }>>;

  type _id_is_expected = Expect<Equal<IdOf<GetTOfCursor<typeof cursor>>, string>>;

  cursor.next().then((doc) => {
    type doc_type_is_expected = Expect<Equal<TestSchema & { $similarity?: never } | null, typeof doc>>;
  });

  (async () => {
    for await (const doc of cursor) {
      type doc_type_is_expected = Expect<Equal<TestSchema & { $similarity?: never }, typeof doc>>;
    }
  })();

  cursor.toArray().then((docs) => {
    type docs_type_is_expected = Expect<Equal<(TestSchema & { $similarity?: never })[], typeof docs>>;
  });

  cursor.filter({ amount: { $gt: 5 } });

  // @ts-expect-error - am0unt is not a valid field
  cursor.filter({ am0unt: { $gt: 5 } });
}

{
  const cursor = dummyCollection<TestSchema>().find({});

  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;

  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, TestSchema & { $similarity?: never }>>;

  type _id_is_expected = Expect<Equal<IdOf<GetTOfCursor<typeof cursor>>, string>>;

  const mapped = cursor.map((doc) => doc._id);

  type mapped_is_expected = Expect<Equal<typeof mapped, FindCursor<string, TestSchema & { $similarity?: never }>>>;

  mapped.next().then((mappedDoc) => {
    type mappedDoc_type_is_expected = Expect<Equal<string | null, typeof mappedDoc>>;
  });

  mapped.filter({ amount: { $gt: 5 } });

  // @ts-expect-error - am0unt is not a valid field
  mapped.filter({ am0unt: { $gt: 5 } });
}

{
  const cursor = dummyCollection<TestSchema>().find({});

  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;

  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, TestSchema & { $similarity?: never }>>;

  type _id_is_expected = Expect<Equal<IdOf<GetTOfCursor<typeof cursor>>, string>>;

  const rawProjected = cursor.project({ _id: 0, amount: 1 });

  type rawProjected_T_and_TRaw_are_expected = Expect<Equal<typeof rawProjected, FindCursor<Partial<TestSchema & { $similarity?: never }>, Partial<TestSchema & { $similarity?: never }>>>>;

  rawProjected.next().then((doc) => {
    type doc_type_is_expected = Expect<Equal<Partial<TestSchema & { $similarity?: never }> | null, typeof doc>>;
  });

  const projected = cursor.project<{ amount: number }>({ _id: 0, amount: 1 });

  type projected_T_is_expected = Expect<Equal<GetTOfCursor<typeof projected>, { amount: number }>>;

  projected.next().then((doc) => {
    type doc_type_is_expected = Expect<Equal<{ amount: number } | null, typeof doc>>;
  });

  cursor.filter({ amount: { $gt: 5 } });

  // @ts-expect-error - am0unt is not a valid field
  cursor.filter({ am0unt: { $gt: 5 } });
}
