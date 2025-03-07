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
import { DataAPIVector, vector } from '@/src/documents/datatypes/vector.js';
import type { CollectionDesCtx, CollectionSerCtx } from '@/src/documents/index.js';
import type { CustomCodecOpts, NominalCodecOpts, RawCodec, SerDesFn, TypeCodecOpts } from '@/src/lib/index.js';
import { assertHasDeserializeFor, assertHasSerializeFor } from '@/src/lib/api/ser-des/utils.js';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';
import { betterTypeOf } from '@/src/documents/utils.js';
import type { PathSegment } from '@/src/lib/types.js';

/**
 * @public
 */
export type CollectionCodecClass =
  & (abstract new (...args: any[]) => { [$SerializeForCollection]: (ctx: CollectionSerCtx) => ReturnType<SerDesFn<any>> })
  & { [$DeserializeForCollection]: SerDesFn<CollectionDesCtx> }

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
        return ctx.done(new Date(Number(value.$date)));
      },
    }),
    $vector: CollectionCodecs.forName('$vector', {
      serialize: (val, ctx) => DataAPIVector.isVectorLike(val) ? vector(val)[$SerializeForCollection](ctx) : ctx.nevermind(),
      deserialize: DataAPIVector[$DeserializeForCollection],
    }),
    $uuid: CollectionCodecs.forType('$uuid', UUID),
    $objectId: CollectionCodecs.forType('$objectId', ObjectId),
  };

  public static forId(clazz: CollectionCodecClass): RawCollCodecs {
    CollectionCodecs.asCodecClass(clazz);

    const { [$DeserializeForCollection]: deserialize } = clazz;

    return [
      CollectionCodecs.forName('', {
        deserialize: (val, ctx) => ctx.target === SerDesTarget.InsertedId ? deserialize(val, ctx) : ctx.nevermind(),
      }),
      CollectionCodecs.forPath(['_id'], {
        deserialize: (val, ctx) => ctx.target === SerDesTarget.Record ? deserialize(val, ctx) : ctx.nevermind(),
      }),
    ].flat();
  }

  public static forName(name: string, optsOrClass: CollNominalCodecOpts | CollectionCodecClass): RawCollCodecs {
    validateIfCodecClass(optsOrClass);

    return [{
      tag: 'forName',
      name: name,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static forPath(path: readonly PathSegment[], optsOrClass: CollNominalCodecOpts | CollectionCodecClass): RawCollCodecs {
    validateIfCodecClass(optsOrClass);

    return [{
      tag: 'forPath',
      path: path,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static forType(type: string, optsOrClass: CollTypeCodecOpts | CollectionCodecClass): RawCollCodecs {
    validateIfCodecClass(optsOrClass);

    return [{
      tag: 'forType',
      type: type,
      opts: ($DeserializeForCollection in optsOrClass) ? { deserialize: optsOrClass[$DeserializeForCollection] } : optsOrClass,
    }];
  }

  public static custom(opts: CollCustomCodecOpts): RawCollCodecs {
    return [{ tag: 'custom', opts: opts }];
  }

  public static asCodecClass<T>(val: T, builder?: ((val: T & CollectionCodecClass & { prototype: { [$SerializeForCollection]: (ctx: CollectionSerCtx) => ReturnType<SerDesFn<any>> } }) => void)): CollectionCodecClass {
    builder?.(val as T & CollectionCodecClass);
    assertIsCodecClass(val);
    return val;
  }
}

function assertIsCodecClass(val: unknown): asserts val is CollectionCodecClass {
  if (typeof val !== 'function') {
    throw new Error(`Invalid codec class: expected a constructor; got ${betterTypeOf(val)}`);
  }
  assertHasSerializeFor(val, $SerializeForCollection, '$SerializeForCollection');
  assertHasDeserializeFor(val, $DeserializeForCollection, '$DeserializeForCollection');
}

function validateIfCodecClass<T>(val: CollectionCodecClass | T) {
  if (typeof val === 'function') {
    // We can't check for $SerializeForCollection here because it may not be on the prototype, depending on how it's
    // implemented in the class. This at least helps catch cases when a completely wrong class is passed.
    assertHasDeserializeFor(val, $DeserializeForCollection, '$DeserializeForCollection');
  }
}
