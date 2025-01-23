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

// Important to import from specific paths here to avoid circular dependencies
import { UUID } from '@/src/documents/datatypes/uuid';
import { ObjectId } from '@/src/documents/datatypes/object-id';
import { DataAPIVector } from '@/src/documents/datatypes/vector';
import { CollDesCtx, CollSerCtx } from '@/src/documents';
import { EmptyObj, SerDesFn, SomeConstructor } from '@/src/lib';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';
import { stringArraysEqual } from '@/src/lib/utils';

type CollSerFn = SerDesFn<CollSerCtx>;
type CollDesFn = SerDesFn<CollDesCtx>;

/**
 * @public
 */
export interface CollCodecClass {
  new (...args: any[]): { [$SerializeForCollection]: (ctx: CollSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForCollection]: CollDesFn;
}

/**
 * @public
 */
export type CollCodec<_Class extends CollCodecClass> = EmptyObj;

/**
 * @public
 */
export class CollCodecs {
  public static Defaults = {
    $date: CollCodecs.forType('$date', {
      serializeClass: Date,
      serialize(_, value, ctx) {
        return ctx.done({ $date: value.valueOf() });
      },
      deserialize(_, value, ctx) {
        return ctx.done(new Date(value.$date));
      },
    }),
    $vector: CollCodecs.forName('$vector', DataAPIVector),
    $uuid: CollCodecs.forType('$uuid', UUID),
    $objectId: CollCodecs.forType('$objectId', ObjectId),
  };

  public static forName(name: string, optsOrClass: CollNominalCodecOpts | CollCodecClass): RawCollCodec {
    return {
      tag: 'forName',
      name: name,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    };
  }

  public static forPath(path: string[], optsOrClass: CollNominalCodecOpts | CollCodecClass): RawCollCodec {
    return {
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    };
  }

  public static forType(type: string, optsOrClass: CollTypeCodecOpts | CollCodecClass): RawCollCodec {
    return {
      tag: 'forType',
      type: type,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    };
  }

  public static custom(opts: CollCustomCodecOpts): RawCollCodec {
    return { tag: 'custom', opts: opts };
  }
}

type CollSerGuard = (value: unknown, ctx: CollSerCtx) => boolean;
type CollDesGuard = (value: unknown, ctx: CollDesCtx) => boolean;

interface CollNominalCodecOpts {
  serialize?: CollSerFn,
  deserialize?: CollDesFn,
}

type CollTypeCodecOpts =
  & (
    | { serialize: CollSerFn, serializeGuard: CollSerGuard, serializeClass?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.' }
    | { serialize: CollSerFn, serializeClass: SomeConstructor, serializeGuard?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.', }
    | { serialize?: never }
    )
  & { deserialize?: CollDesFn }

type CollCustomCodecOpts =
  & (
  | { serialize: CollSerFn, serializeGuard: CollSerGuard, serializeClass?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.' }
  | { serialize: CollSerFn, serializeClass: SomeConstructor, serializeGuard?: 'One (and only one) of `serializeClass` or `serializeGuard` should be present if `serialize` is present.', }
  | { serialize?: never }
  )
  & (
  | { deserialize: CollDesFn, deserializeGuard: CollDesGuard }
  | { deserialize?: never }
  )

export type RawCollCodec =
  | { tag: 'forName', name: string, opts: CollNominalCodecOpts }
  | { tag: 'forPath', path: string[], opts: CollNominalCodecOpts }
  | { tag: 'forType', type: string, opts: CollTypeCodecOpts }
  | { tag: 'custom', opts: CollCustomCodecOpts };

export interface CollSerializers {
  forName: Record<string, CollSerFn[]>,
  forPath:  { path: string[], fns: CollSerFn[] }[],
  forClass: { class: SomeConstructor, fns: CollSerFn[] }[],
  forGuard: { guard: CollSerGuard, fn: CollSerFn }[],
}

export interface CollDeserializers {
  forName: Record<string, CollDesFn[]>,
  forType: Record<string, CollDesFn[]>,
  forPath:  { path: string[], fns: CollDesFn[] }[],
  forGuard: { guard: CollDesGuard, fn: CollDesFn }[],
}

/**
 * @internal
 */
export const processCodecs = (raw: RawCollCodec[]): [CollSerializers, CollDeserializers] => {
  const serializers: CollSerializers = { forName: {}, forPath: [], forClass: [], forGuard: [] };
  const deserializers: CollDeserializers = { forName: {}, forType: {}, forPath: [], forGuard: [] };

  for (const codec of raw) {
    switch (codec.tag) {
      case 'forName':
        codec.opts.serialize && (serializers.forName[codec.name] ??= []).push(codec.opts.serialize);
        codec.opts.deserialize && (deserializers.forName[codec.name] ??= []).push(codec.opts.deserialize);
        break;
      case 'forPath':
        codec.opts.serialize && findOrInsertPath(serializers.forPath, codec.path, codec.opts.serialize);
        codec.opts.deserialize && findOrInsertPath(deserializers.forPath, codec.path, codec.opts.deserialize);
        break;
      case 'forType':
        ('serializeGuard' in codec.opts && !codec.opts['serializeClass']) && serializers.forGuard.push({ guard: codec.opts.serializeGuard, fn: codec.opts.serialize });
        ('serializeClass' in codec.opts && !codec.opts['serializeGuard']) && findOrInsertClass(serializers.forClass, codec.opts.serializeClass, codec.opts.serialize);
        codec.opts.deserialize && (deserializers.forType[codec.type] ??= []).push(codec.opts.deserialize);
        break;
      case 'custom':
        ('serializeGuard' in codec.opts && !codec.opts['serializeClass']) && serializers.forGuard.push({ guard: codec.opts.serializeGuard, fn: codec.opts.serialize });
        ('serializeClass' in codec.opts && !codec.opts['serializeGuard']) && findOrInsertClass(serializers.forClass, codec.opts.serializeClass, codec.opts.serialize);
        ('deserializeGuard' in codec.opts) && deserializers.forGuard.push({ guard: codec.opts.deserializeGuard, fn: codec.opts.deserialize });
        break;
    }
  }

  return [serializers, deserializers];
};

const findOrInsertPath = <Fn>(arr: { path: string[], fns: Fn[] }[], newPath: string[], fn: Fn) => {
  for (const { path, fns } of arr) {
    if (stringArraysEqual(path, newPath)) {
      fns.push(fn);
      return;
    }
  }
  arr.push({ path: newPath, fns: [fn] });
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
