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
import {
  CustomCodecOpts,
  Deserializers,
  EmptyObj,
  NominalCodecOpts,
  RawCodec,
  SerDesFn,
  Serializers,
  TypeCodecOpts,
} from '@/src/lib';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';

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

  public static forName(name: string, optsOrClass: CollNominalCodecOpts | CollCodecClass): RawCodec<'collection'> {
    return {
      tag: 'forName',
      name: name,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    };
  }

  public static forPath(path: string[], optsOrClass: CollNominalCodecOpts | CollCodecClass): RawCodec<'collection'> {
    return {
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    };
  }

  public static forType(type: string, optsOrClass: CollTypeCodecOpts | CollCodecClass): RawCodec<'collection'> {
    return {
      tag: 'forType',
      type: type,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    };
  }

  public static custom(opts: CollCustomCodecOpts): RawCodec<'collection'> {
    return { tag: 'custom', opts: opts };
  }
}

type CollSerGuard = (value: unknown, ctx: CollSerCtx) => boolean;
type CollDesGuard = (value: unknown, ctx: CollDesCtx) => boolean;

/**
 * @public
 */
export type CollNominalCodecOpts = NominalCodecOpts<CollSerFn, CollDesFn>;

/**
 * @public
 */
export type CollTypeCodecOpts = TypeCodecOpts<CollSerFn, CollSerGuard, CollDesFn>;

/**
 * @public
 */
export type CollCustomCodecOpts = CustomCodecOpts<CollSerFn, CollSerGuard, CollDesFn, CollDesGuard>;

/**
 * @public
 */
export type CollSerializers = Serializers<CollSerFn, CollSerGuard>;

/**
 * @public
 */
export type CollDeserializers = Deserializers<CollDesFn, CollDesGuard>;
