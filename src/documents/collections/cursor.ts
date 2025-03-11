// // Copyright DataStax, Inc.
// //
// // Licensed under the Apache License, Version 2.0 (the "License");
// // you may not use this file except in compliance with the License.
// // You may obtain a copy of the License at
// //
// // http://www.apache.org/licenses/LICENSE-2.0
// //
// // Unless required by applicable law or agreed to in writing, software
// // distributed under the License is distributed on an "AS IS" BASIS,
// // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// // See the License for the specific language governing permissions and
// // limitations under the License.
//
// import type { Collection, CollectionFilter} from '@/src/documents/index.js';
// import { FindCursor, type SomeDoc } from '@/src/documents/index.js';
//
// /**
//  * A subclass of `FindCursor` which is identical to its parent; it just adds some more specific typing for
//  * a couple of properties/functions.
//  *
//  * See {@link FindCursor} directly for information on the cursor itself.
//  *
//  * @public
//  */
// export class CollectionFindCursor<T, TRaw extends SomeDoc = SomeDoc> extends FindCursor<T, TRaw> {
//   /**
//    * The collection which spawned this cursor.
//    *
//    * @returns The collection which spawned this cursor.
//    */
//   public override get dataSource(): Collection {
//     return super.dataSource as Collection;
//   }
//
//   /**
//    * Sets the filter for the cursor, overwriting any previous filter.
//    *
//    * *NB. This method does **NOT** mutate the cursor, and may be called even after the cursor is started; it simply
//    * returns a new, uninitialized cursor with the given new filter set.*
//    *
//    * @param filter - A filter to select which records to return.
//    *
//    * @returns A new cursor with the new filter set.
//    */
//   public override filter(filter: CollectionFilter<TRaw>): FindCursor<T, TRaw> {
//     return super.filter(filter);
//   }
// }
