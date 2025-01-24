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

import { SomeConstructor } from '@/src/lib';
import { stringArraysEqual } from '@/src/lib/utils';

/**
 * @public
 */
export interface NominalCodecOpts<SerFn, DesFn> {
  serialize?: SerFn,
  deserialize?: DesFn,
}

/**
 * @public
 */
export type TypeCodecOpts<SerFn, SerGuard, DesFn> = CustomCodecSerOpts<SerFn, SerGuard> & { deserialize?: DesFn }

/**
 * @public
 */
export type CustomCodecOpts<SerFn, SerGuard, DesFn, DesGuard> = CustomCodecSerOpts<SerFn, SerGuard> & (
  | { deserialize: DesFn, deserializeGuard: DesGuard }
  | { deserialize?: never }
)

/**
 * @public
 */
export type CustomCodecSerOpts<SerFn, SerGuard> =
  | { serialize: SerFn, serializeGuard: SerGuard, serializeClass?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.' }
  | { serialize: SerFn, serializeClass: SomeConstructor, serializeGuard?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.', }
  | { serialize?: never };

/**
 * @public
 */
export type RawCodec<For extends 'table' | 'collection'> =
  | { phantom?: For, tag: 'forName', name: string, opts: NominalCodecOpts<any, any> }
  | { phantom?: For, tag: 'forPath', path: string[], opts: NominalCodecOpts<any, any> }
  | { phantom?: For, tag: 'forType', type: string, opts: TypeCodecOpts<any, any, any> }
  | { phantom?: For, tag: 'custom',  opts: CustomCodecOpts<any, any, any, any> };

/**
 * @public
 */
export interface Serializers<SerFn, SerGuard> {
  forName: Record<string, SerFn[]>,
  forPath: Record<number, { path: string[], fns: SerFn[] }[]>,
  forClass: { class: SomeConstructor, fns: SerFn[] }[],
  forGuard: { guard: SerGuard, fn: SerFn }[],
}

/**
 * @public
 */
export interface Deserializers<DesFn, DesGuard> {
  forName: Record<string, DesFn[]>,
  forType: Record<string, DesFn[]>,
  forPath: Record<number, { path: string[], fns: DesFn[] }[]>,
  forGuard: { guard: DesGuard, fn: DesFn }[],
}

/**
 * @internal
 */
export const processCodecs = <SerFn, SerGuard, DesFn, DesGuard>(raw: RawCodec<any>[]): [Serializers<SerFn, SerGuard>, Deserializers<DesFn, DesGuard>] => {
  const serializers: Serializers<SerFn, SerGuard> = { forName: {}, forPath: {}, forClass: [], forGuard: [] };
  const deserializers: Deserializers<DesFn, DesGuard> = { forName: {}, forPath: {}, forType: {}, forGuard: [] };

  for (const codec of raw) {
    appendCodec[codec.tag](codec as never, serializers, deserializers);
  }

  return [serializers, deserializers];
};

const appendCodec = {
  forName(codec: RawCodec<any> & { tag: 'forName' }, serializers: Serializers<any, any>, deserializers: Deserializers<any, any>) {
    if (codec.opts.serialize) {
      (serializers.forName[codec.name] ??= []).push(codec.opts.serialize);
    }
    if (codec.opts.deserialize) {
      (deserializers.forName[codec.name] ??= []).push(codec.opts.deserialize);
    }
  },
  forPath(codec: RawCodec<any> & { tag: 'forPath' }, serializers: Serializers<any, any>, deserializers: Deserializers<any, any>) {
    if (codec.opts.serialize) {
      findOrInsertPath(serializers.forPath, codec.path, codec.opts.serialize);
    }
    if (codec.opts.deserialize) {
      findOrInsertPath(deserializers.forPath, codec.path, codec.opts.deserialize);
    }
  },
  forType(codec: RawCodec<any> & { tag: 'forType' }, serializers: Serializers<any, any>, deserializers: Deserializers<any, any>) {
    appendCodec.customSer(codec, serializers);

    if (codec.opts.deserialize) {
      (deserializers.forType[codec.type] ??= []).push(codec.opts.deserialize);
    }
  },
  custom(codec: RawCodec<any> & { tag: 'custom' }, serializers: Serializers<any, any>, deserializers: Deserializers<any, any>) {
    appendCodec.customSer(codec, serializers);

    if ('deserializeGuard' in codec.opts) {
      deserializers.forGuard.push({ guard: codec.opts.deserializeGuard, fn: codec.opts.deserialize });
    }
  },
  customSer(codec: RawCodec<any> & { tag: 'custom' | 'forType' }, serializers: Serializers<any, any>) {
    if ('serializeGuard' in codec.opts) {
      serializers.forGuard.push({ guard: codec.opts.serializeGuard, fn: codec.opts.serialize });
    }
    else if ('serializeClass' in codec.opts) {
      findOrInsertClass(serializers.forClass, codec.opts.serializeClass, codec.opts.serialize);
    }
  },
};

const findOrInsertPath = <Fn>(arr: Record<number, { path: string[], fns: Fn[] }[]>, newPath: string[], fn: Fn) => {
  const arrForDepth = arr[newPath.length] ??= [];

  for (const { path, fns } of arrForDepth) {
    if (stringArraysEqual(path, newPath)) {
      fns.push(fn);
      return;
    }
  }

  arrForDepth.push({ path: newPath, fns: [fn] });
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
