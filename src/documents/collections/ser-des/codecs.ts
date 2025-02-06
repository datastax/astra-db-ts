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
import { UUID } from '@/src/documents/datatypes/uuid.js';
import { ObjectId } from '@/src/documents/datatypes/object-id.js';
import { DataAPIVector } from '@/src/documents/datatypes/vector.js';
import type { CollectionDesCtx, CollectionSerCtx } from '@/src/documents/index.js';
import type { CustomCodecOpts, NominalCodecOpts, RawCodec, SerDesFn, SomeConstructor, TypeCodecOpts } from '@/src/lib/index.js';
import type { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { $DeserializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';

/**
 * @public
 */
export interface CollectionCodecClass {
  new (...args: any[]): { [$SerializeForCollection]: (ctx: CollectionSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForCollection]: SerDesFn<CollectionDesCtx>;
}

/**
 * @public
 */
export type CollectionCodec<Class extends CollectionCodecClass> = InstanceType<Class>;

/**
 * @public
 */
export type RawCollCodecs = readonly RawCodec<CollectionSerCtx, CollectionDesCtx>[] & { phantom?: 'This codec is only valid for collections' };

/**
 * @public
 */
export type CollNominalCodecOpts = NominalCodecOpts<CollectionSerCtx, CollectionDesCtx>;

/**
 * @public
 */
export type CollTypeCodecOpts = TypeCodecOpts<CollectionSerCtx, CollectionDesCtx>;

/**
 * @public
 */
export type CollCustomCodecOpts = CustomCodecOpts<CollectionSerCtx, CollectionDesCtx>;


/**
 * @public
 */
export class CollectionCodecs {
  public static Defaults = {
    $date: CollectionCodecs.forType('$date', {
      serializeClass: Date,
      serialize(value, ctx) {
        return ctx.done({ $date: value.valueOf() });
      },
      deserialize(value, ctx) {
        return ctx.done(new Date(value.$date));
      },
    }),
    $vector: CollectionCodecs.forName('$vector', DataAPIVector),
    $uuid: CollectionCodecs.forType('$uuid', UUID),
    $objectId: CollectionCodecs.forType('$objectId', ObjectId),
  };

  public static forId(optsOrClass: CollNominalCodecOpts & { class?: SomeConstructor } | CollectionCodecClass): RawCollCodecs {
    const mkIdDesCodec = (fn: SerDesFn<CollectionDesCtx>): RawCollCodecs => [
      CollectionCodecs.forName('', {
        deserialize: (val, ctx) => ctx.target === SerDesTarget.InsertedId ? fn(val, ctx) : ctx.nevermind(),
      }),
      CollectionCodecs.forPath(['_id'], {
        deserialize: fn,
      }),
    ].flat();

    if ($DeserializeForCollection in optsOrClass) {
      return mkIdDesCodec(optsOrClass[$DeserializeForCollection]);
    }

    const serFn = optsOrClass.serialize;

    return [
      (serFn)
        ? CollectionCodecs.forPath(['_id'], {
          serialize(val, ctx) {
            if (ctx.locals.__parsedId) {
              return ctx.nevermind();
            }
            ctx.locals.__parsedId = true;
            return serFn(val, ctx);
          },
        })
        : [],
      (optsOrClass.deserialize)
        ? mkIdDesCodec(optsOrClass.deserialize)
        : [],
    ].flat();
  }

  public static forName(name: string, optsOrClass: CollNominalCodecOpts | CollectionCodecClass): RawCollCodecs {
    return [{
      tag: 'forName',
      name: name,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static forPath(path: (string | number)[], optsOrClass: CollNominalCodecOpts | CollectionCodecClass): RawCollCodecs {
    return [{
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static forType(type: string, optsOrClass: CollTypeCodecOpts | CollectionCodecClass): RawCollCodecs {
    return [{
      tag: 'forType',
      type: type,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static custom(opts: CollCustomCodecOpts): RawCollCodecs {
    return [{ tag: 'custom', opts: opts }];
  }
}
