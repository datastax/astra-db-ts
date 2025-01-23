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
//
// import { describe, it } from '@/tests/testlib';
// import assert from 'assert';
// import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';
// import { TableCodecs } from '@/src/documents/tables';
// import { BaseSerDesCtx } from '@/src/lib';
// import { $DeserializeForTable, $SerializeForTable, TableCodec } from '@/src/index';
//
// describe('unit.documents.tables.ser-des.sparse-data', () => {
//   describe('order', () => {
//     const counters = {
//       ser: [[] as number[], []],
//       des: [[] as number[], []],
//     };
//
//     const inc = (ord: number, ctx: BaseSerDesCtx<any>, type: keyof typeof counters) => {
//       const depth = ctx.path.length;
//       counters[type][depth].push(ord);
//       return ctx.continue();
//     };
//
//     class Test implements TableCodec<typeof Test> {
//       [$SerializeForTable] = (ctx: BaseSerDesCtx<any>) => inc(6, ctx, 'ser');
//       static [$DeserializeForTable] = (_: unknown, __: unknown, ctx: BaseSerDesCtx<any>) => inc(6, ctx, 'des');
//     }
//
//     let r = 1;
//     const repeat = <T>(n: number, mk: (n: number) => T) => Array.from({ length: n }, () => mk(r++));
//
//     const serdes = new TableSerDes({
//       codecs: [
//         repeat(2, (i) => TableCodecs.forPath([], {
//           serialize: (_, __, ctx) => inc(i, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(i, ctx, 'des'),
//         })),
//         repeat(1, (i) => TableCodecs.forName('', {
//           serialize: (_, __, ctx) => inc(i, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(i, ctx, 'des'),
//         })),
//         [TableCodecs.forType('int', {
//           serializeGuard: (v)  => v instanceof Test,
//           serialize: (_, __, ctx) => inc(4, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(4, ctx, 'des'),
//         }),
//         TableCodecs.forType('int', {
//           serializeGuard: (v)  => v instanceof Test,
//           serialize: (_, __, ctx) => inc(5, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(5, ctx, 'des'),
//         })],
//         [TableCodecs.forType('int', Test)],
//         [TableCodecs.forType('int', {
//           serializeClass: Test,
//           serialize: (_, __, ctx) => inc(7, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(7, ctx, 'des'),
//         }),
//         TableCodecs.forType('int', {
//           serializeClass: Test,
//           serialize: (_, __, ctx) => inc(8, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(8, ctx, 'des'),
//         })],
//         [TableCodecs.forType('int', {
//           serializeGuard: () => false,
//           serialize: (_, __, ctx) => inc(-1, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(-1, ctx, 'des'),
//         })],
//         [TableCodecs.forType('int', {
//           serializeClass: Array,
//           serialize: (_, __, ctx) => inc(-2, ctx, 'ser'),
//           deserialize: (_, __, ctx) => inc(-2, ctx, 'des'),
//         })],
//       ].sort(() => .5 - Math.random()).flat(),
//     });
//
//     const obj = { null: new Test() };
//
//     it('should process all of the serialization codecs in the right order', () => {
//       serdes.serialize(obj);
//       assert.deepStrictEqual(counters.ser, [[1, 2, 3], [4, 5, 6, 7, 8]]);
//     });
//   });
// });
