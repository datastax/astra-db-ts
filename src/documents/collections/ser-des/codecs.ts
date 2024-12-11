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
import { CollDesCtx, CollSerCtx, TableSerCtx } from '@/src/documents';
import { CodecHolder } from '@/src/lib/api/ser-des/codecs';
import { EmptyObj, SerDesFn } from '@/src/lib';
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
export class CollCodecs implements CodecHolder<CollCodecSerDesFns> {
  /**
   * @internal
   */
  public readonly get: CodecHolder<CollCodecSerDesFns>['get'];

  /**
   * @internal
   */
  public constructor(state: typeof this.get) {
    this.get = state;
  }

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
    USE_DATA_API_TIMESTAMPS_OVER_DATES: CollCodecs.forType('$date', DataAPITimestamp),
    // USE_NUMBER_ARRAYS_FOR_VECTORS:
  };

  public static forPath(path: string[], clazz: CollCodecClass): CollCodecs

  public static forPath(path: string[], opts: CollCodecSerDesFns): CollCodecs

  public static forPath(path: string[], clazzOrOpts: CollCodecClass | CollCodecSerDesFns): CollCodecs {
    if ($DeserializeForCollection in clazzOrOpts) {
      return new CollCodecs({ codecType: 'path', path, deserialize: clazzOrOpts[$DeserializeForCollection] });
    }
    return new CollCodecs({ codecType: 'path', path, ...clazzOrOpts });
  }

  public static forName(name: string, clazz: CollCodecClass): CollCodecs

  public static forName(name: string, opts: CollCodecSerDesFns): CollCodecs

  public static forName(name: string, clazzOrOpts: CollCodecClass | CollCodecSerDesFns): CollCodecs {
    if ($DeserializeForCollection in clazzOrOpts) {
      return new CollCodecs({ codecType: 'name', name, deserialize: clazzOrOpts[$DeserializeForCollection] });
    }
    return new CollCodecs({ codecType: 'name', name, ...clazzOrOpts });
  }

  public static forType(type: string, clazz: CollCodecClass): CollCodecs;

  public static forType(type: string, opts: CollCodecSerDesFns & { serializeGuard: (value: unknown, ctx: TableSerCtx) => boolean }): CollCodecs;

  public static forType(type: string, opts: CollCodecSerDesFns & { serializeClass: new (...args: any[]) => any }): CollCodecs;

  public static forType(type: string, opts: CollCodecSerDesFns & { deserializeOnly: true }): CollCodecs;

  public static forType(type: string, clazzOrOpts: CollCodecClass | CollCodecSerDesFns): CollCodecs {
    if ($DeserializeForCollection in clazzOrOpts) {
      return new CollCodecs({ codecType: 'type', type, deserialize: clazzOrOpts[$DeserializeForCollection] });
    }
    return new CollCodecs({ codecType: 'type', type, ...clazzOrOpts });
  }
}
