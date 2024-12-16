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
import { DataAPITimestamp } from '@/src/documents/datatypes/dates';
import { CollDesCtx, CollSerCtx } from '@/src/documents';
import { EmptyObj, SerDesFn } from '@/src/lib';
import { CodecOpts, RawCodec } from '@/src/lib/api/ser-des/codecs';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';

/**
 * @public
 */
export interface CollCodecSerDesFns {
  serialize: SerDesFn<CollSerCtx>,
  deserialize: SerDesFn<CollDesCtx>,
}

/**
 * @public
 */
export interface CollCodecClass {
  new (...args: any[]): { [$SerializeForCollection]: (ctx: CollSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForCollection]: CollCodecSerDesFns['deserialize'];
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

  public static Overrides = {
    USE_DATA_API_TIMESTAMPS_FOR_DATES: CollCodecs.forType('$date', DataAPITimestamp),
  };

  public static forPath(path: string[], optsOrClass: CodecOpts<CollCodecSerDesFns, CollSerCtx, CollDesCtx> | CollCodecClass): RawCodec<CollCodecSerDesFns> {
    return {
      path,
      ...($DeserializeForCollection in optsOrClass)
        ? { deserialize: optsOrClass[$DeserializeForCollection] }
        : optsOrClass,
    };
  }

  public static forName(name: string, optsOrClass: CodecOpts<CollCodecSerDesFns, CollSerCtx, CollDesCtx> | CollCodecClass): RawCodec<CollCodecSerDesFns> {
    return {
      name,
      ...($DeserializeForCollection in optsOrClass)
        ? { deserialize: optsOrClass[$DeserializeForCollection] }
        : optsOrClass,
    };
  }

  public static forType(type: string, optsOrClass: CodecOpts<CollCodecSerDesFns, CollSerCtx, CollDesCtx> | CollCodecClass): RawCodec<CollCodecSerDesFns> {
    return {
      type,
      ...($DeserializeForCollection in optsOrClass)
        ? { deserialize: optsOrClass[$DeserializeForCollection] }
        : optsOrClass,
    };
  }
}
