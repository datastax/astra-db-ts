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
import { CustomCodecOpts, NominalCodecOpts, RawCodec, SerDesFn, SomeConstructor, TypeCodecOpts } from '@/src/lib';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';

/**
 * @public
 */
export interface CollCodecClass {
  new (...args: any[]): { [$SerializeForCollection]: (ctx: CollSerCtx) => ReturnType<SerDesFn<any>> };
  [$DeserializeForCollection]: SerDesFn<CollDesCtx>;
}

/**
 * @public
 */
export type CollCodec<Class extends CollCodecClass> = InstanceType<Class>;

/**
 * @public
 */
export type RawCollCodecs = readonly RawCodec<CollSerCtx, CollDesCtx>[] & { phantom?: 'This codec is only valid for collections' };

/**
 * @public
 */
export type CollNominalCodecOpts = NominalCodecOpts<CollSerCtx, CollDesCtx>;

/**
 * @public
 */
export type CollTypeCodecOpts = TypeCodecOpts<CollSerCtx, CollDesCtx>;

/**
 * @public
 */
export type CollCustomCodecOpts = CustomCodecOpts<CollSerCtx, CollDesCtx>;


/**
 * @public
 */
export class CollCodecs {
  public static Defaults = {
    $date: CollCodecs.forType('$date', {
      serializeClass: Date,
      serialize(value, ctx) {
        return ctx.done({ $date: value.valueOf() });
      },
      deserialize(value, ctx) {
        return ctx.done(new Date(value.$date));
      },
    }),
    $vector: CollCodecs.forName('$vector', DataAPIVector),
    $uuid: CollCodecs.forType('$uuid', UUID),
    $objectId: CollCodecs.forType('$objectId', ObjectId),
  };

  public static forId(optsOrClass: CollNominalCodecOpts & { class?: SomeConstructor } | CollCodecClass): RawCollCodecs {
    const mkIdDesCodec = (fn: SerDesFn<CollDesCtx>): RawCollCodecs => [
      CollCodecs.forName('', {
        deserialize: (val, ctx) => ctx.parsingInsertedId ? fn(val, ctx) : ctx.continue(),
      }),
      CollCodecs.forPath(['_id'], {
        deserialize: fn,
      }),
    ].flat();

    if ($DeserializeForCollection in optsOrClass) {
      return mkIdDesCodec(optsOrClass[$DeserializeForCollection]);
    }

    return [
      (optsOrClass.serialize)
        ? CollCodecs.forPath(['_id'], { serialize: optsOrClass.serialize })
        : [],
      (optsOrClass.deserialize)
        ? mkIdDesCodec(optsOrClass.deserialize)
        : [],
    ].flat();
  }

  public static forName(name: string, optsOrClass: CollNominalCodecOpts | CollCodecClass): RawCollCodecs {
    return [{
      tag: 'forName',
      name: name,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static forPath(path: (string | number)[], optsOrClass: CollNominalCodecOpts | CollCodecClass): RawCollCodecs {
    return [{
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static forType(type: string, optsOrClass: CollTypeCodecOpts | CollCodecClass): RawCollCodecs {
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
