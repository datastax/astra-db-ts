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
import { FoundDoc, IdOf } from '@/src/documents/collections/types';
import { CollectionFindCursor, FindCursor, WithSim } from '@/src/documents';

type GetTOfCursor<Cursor> = Cursor extends CollectionFindCursor<infer T, any> ? T : Cursor extends FindCursor<infer T, any> ? T : never;
type GetTRawOfCursor<Cursor> = Cursor extends CollectionFindCursor<any, infer TRaw> ? TRaw : Cursor extends FindCursor<any, infer TRaw> ? TRaw : never;

{
  const cursor = dummyCollection<TestSchema>().find({});

  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;

  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, Omit<TestSchema, '$vector'> & { _id: IdOf<TestSchema> } & { $similarity?: number }>>;

  type _id_is_expected = Expect<Equal<IdOf<GetTOfCursor<typeof cursor>>, string>>;

  void cursor.next().then((doc) => {
    type doc_type_is_expected = Expect<Equal<WithSim<FoundDoc<TestSchema>> | null, typeof doc>>;
  });

  void (async () => {
    for await (const doc of cursor) {
      type doc_type_is_expected = Expect<Equal<WithSim<FoundDoc<TestSchema>>, typeof doc>>;
    }
  })();

  void cursor.toArray().then((docs) => {
    type docs_type_is_expected = Expect<Equal<WithSim<FoundDoc<TestSchema>>[], typeof docs>>;
  });
}

{
  const cursor = dummyCollection<TestSchema>().find({}, { includeSimilarity: true });
  const cursor2 = dummyCollection<TestSchema>().find({}).includeSimilarity();
  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;
  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, WithSim<FoundDoc<TestSchema>>>>;
}

{
  const cursor = dummyCollection<TestSchema>().find({}).includeSimilarity();
  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;
  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, WithSim<FoundDoc<TestSchema>>>>;
}

{
  const cursor = dummyCollection<TestSchema>().find({});

  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;

  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, WithSim<FoundDoc<TestSchema>>>>;

  type _id_is_expected = Expect<Equal<IdOf<GetTOfCursor<typeof cursor>>, string>>;

  const mapped = cursor.map((doc) => doc._id);

  type mapped_is_expected = Expect<Equal<typeof mapped, FindCursor<string, WithSim<FoundDoc<TestSchema>>>>>;

  void mapped.next().then((mappedDoc) => {
    type mappedDoc_type_is_expected = Expect<Equal<string | null, typeof mappedDoc>>;
  });
}

{
  const cursor = dummyCollection<TestSchema>().find({});

  type T_and_TRaw_are_equal = Expect<Equal<GetTOfCursor<typeof cursor>, GetTRawOfCursor<typeof cursor>>>;

  type T_is_expected = Expect<Equal<GetTOfCursor<typeof cursor>, WithSim<FoundDoc<TestSchema>>>>;

  type _id_is_expected = Expect<Equal<IdOf<GetTOfCursor<typeof cursor>>, string>>;

  const rawProjected = cursor.project({ _id: 0, amount: 1 });

  type rawProjected_T_and_TRaw_are_expected = Expect<Equal<typeof rawProjected, FindCursor<Partial<WithSim<FoundDoc<TestSchema>>>, Partial<WithSim<FoundDoc<TestSchema>>>>>>;

  void rawProjected.next().then((doc) => {
    type doc_type_is_expected = Expect<Equal<Partial<WithSim<FoundDoc<TestSchema>>> | null, typeof doc>>;
  });

  const projected = cursor.project<{ amount: number }>({ _id: 0, amount: 1 });

  type projected_T_is_expected = Expect<Equal<GetTOfCursor<typeof projected>, { amount: number }>>;

  void projected.next().then((doc) => {
    type doc_type_is_expected = Expect<Equal<{ amount: number } | null, typeof doc>>;
  });
}
