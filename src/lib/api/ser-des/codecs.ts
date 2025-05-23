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

import type { SerDesFn, SomeConstructor } from '@/src/lib/index.js';
import type { CollectionCodecClass, TableCodecClass } from '@/src/documents/index.js';
import { pathArraysEqual } from '@/src/lib/api/ser-des/utils.js';
import type { PathSegment } from '@/src/lib/types.js';

/**
 * @public
 */
export type DataAPICodec<Class extends CollectionCodecClass & TableCodecClass> = InstanceType<Class>;

/**
 * @public
 */
export type SerDesGuard<Ctx> = (value: any, ctx: Ctx) => boolean;

/**
 * @public
 */
export interface NominalCodecOpts<SerCtx, DesCtx> {
  serialize?: SerDesFn<SerCtx>,
  deserialize?: SerDesFn<DesCtx>,
}

/**
 * @public
 */
export type TypeCodecOpts<SerCtx, DesCtx> = CustomCodecSerOpts<SerCtx> & { deserialize?: SerDesFn<DesCtx> }

/**
 * @public
 */
export type CustomCodecOpts<SerCtx, DesCtx> = CustomCodecSerOpts<SerCtx> & (
  | { deserialize: SerDesFn<DesCtx>, deserializeGuard: SerDesGuard<DesCtx> }
  | { deserialize?: never }
)

/**
 * @public
 */
export type CustomCodecSerOpts<SerCtx> =
  | { serialize: SerDesFn<SerCtx>, serializeGuard: SerDesGuard<SerCtx>, serializeClass?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.' }
  | { serialize: SerDesFn<SerCtx>, serializeClass: SomeConstructor, serializeGuard?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.', }
  | { serialize?: never };

/**
 * @public
 */
export type RawCodec<SerCtx = any, DesCtx = any> =
  | { tag: 'forName', name: string, opts: NominalCodecOpts<SerCtx, DesCtx> }
  | { tag: 'forPath', path: readonly PathSegment[], opts: NominalCodecOpts<SerCtx, DesCtx> }
  | { tag: 'forType', type: string, opts: TypeCodecOpts<SerCtx, DesCtx> }
  | { tag: 'custom',  opts: CustomCodecOpts<SerCtx, DesCtx> };

/**
 * @public
 */
export interface Serializers<SerCtx> {
  forName: Record<string, SerDesFn<SerCtx>[]>,
  forPath: Record<number, { path: readonly PathSegment[], fns: SerDesFn<SerCtx>[] }[]>,
  forClass: { class: SomeConstructor, fns: SerDesFn<SerCtx>[] }[],
  forGuard: { guard: SerDesGuard<SerCtx>, fn: SerDesFn<SerCtx> }[],
}

/**
 * @public
 */
export interface Deserializers<DesCtx> {
  forName: Record<string, SerDesFn<DesCtx>[]>,
  forType: Record<string, SerDesFn<DesCtx>[]>,
  forPath: Record<number, { path: readonly PathSegment[], fns: SerDesFn<DesCtx>[] }[]>,
  forGuard: { guard: SerDesGuard<DesCtx>, fn: SerDesFn<DesCtx> }[],
}

/**
 * @internal
 */
export const processCodecs = <SerCtx, DesCtx>(raw: readonly RawCodec[]): [Serializers<SerCtx>, Deserializers<DesCtx>] => {
  const serializers: Serializers<SerCtx> = { forName: Object.create(null), forPath: Object.create(null), forClass: [], forGuard: [] };
  const deserializers: Deserializers<DesCtx> = { forName: Object.create(null), forPath: Object.create(null), forType: Object.create(null), forGuard: [] };

  for (const codec of raw) {
    appendCodec[codec.tag](codec as never, serializers, deserializers);
  }

  return [serializers, deserializers];
};

const appendCodec = {
  forName(codec: RawCodec & { tag: 'forName' }, serializers: Serializers<any>, deserializers: Deserializers<any>) {
    if (codec.opts.serialize) {
      (serializers.forName[codec.name] ??= []).push(codec.opts.serialize);
    }
    if (codec.opts.deserialize) {
      (deserializers.forName[codec.name] ??= []).push(codec.opts.deserialize);
    }
  },
  forPath(codec: RawCodec & { tag: 'forPath' }, serializers: Serializers<any>, deserializers: Deserializers<any>) {
    if (codec.opts.serialize) {
      findOrInsertPath(serializers.forPath, codec.path, codec.opts.serialize);
    }
    if (codec.opts.deserialize) {
      findOrInsertPath(deserializers.forPath, codec.path, codec.opts.deserialize);
    }
  },
  forType(codec: RawCodec & { tag: 'forType' }, serializers: Serializers<any>, deserializers: Deserializers<any>) {
    appendCodec.customSer(codec, serializers);

    if (codec.opts.deserialize) {
      (deserializers.forType[codec.type] ??= []).push(codec.opts.deserialize);
    }
  },
  custom(codec: RawCodec & { tag: 'custom' }, serializers: Serializers<any>, deserializers: Deserializers<any>) {
    appendCodec.customSer(codec, serializers);

    if ('deserializeGuard' in codec.opts) {
      deserializers.forGuard.push({ guard: codec.opts.deserializeGuard, fn: codec.opts.deserialize });
    }
  },
  customSer(codec: RawCodec & { tag: 'custom' | 'forType' }, serializers: Serializers<any>) {
    if ('serializeGuard' in codec.opts && !codec.opts.serializeClass) {
      serializers.forGuard.push({ guard: codec.opts.serializeGuard, fn: codec.opts.serialize });
    }
    else if ('serializeClass' in codec.opts && !codec.opts.serializeGuard) {
      findOrInsertClass(serializers.forClass, codec.opts.serializeClass, codec.opts.serialize);
    }
  },
};

const findOrInsertPath = <Fn>(arr: Record<number, { path: readonly PathSegment[], fns: Fn[] }[]>, newPath: readonly PathSegment[], fn: Fn) => {
  const arrForDepth = arr[newPath.length] ??= [];

  for (const { path, fns } of arrForDepth) {
    if (pathArraysEqual(path, newPath)) {
      fns.push(fn);
      return;
    }
  }

  arrForDepth.push({ path: newPath, fns: [fn] });
  arrForDepth.sort((a, b) => comparePathGeneralities(a.path, b.path));
};

const comparePathGeneralities = (a: readonly PathSegment[], b: readonly PathSegment[]) => {
  const aIndex = a.indexOf('*');
  const diff = aIndex - b.indexOf('*');

  if (diff === 0 && aIndex !== -1 && aIndex + 1 < a.length) {
    return comparePathGeneralities(a.slice(aIndex + 1), b.slice(aIndex + 1));
  }

  return diff;
};

const findOrInsertClass = <Fn>(arr: { class: SomeConstructor, fns: Fn[] }[], newClass: SomeConstructor, fn: Fn) => {
  for (const { class: clazz, fns } of arr) {
    if (clazz === newClass) {
      fns.push(fn);
      return;
    }
  }
  arr.push({ class: newClass, fns: [fn] });
};
