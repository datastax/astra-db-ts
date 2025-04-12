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
import type {
  CustomCodecOpts,
  NominalCodecOpts,
  RawCodec,
  SerDesFn,
  SomeConstructor,
  TypeCodecOpts,
} from '@/src/lib/index.js';
import { escapeFieldNames } from '@/src/lib/index.js';
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
 * @beta
 */
export type RawCollCodecs = readonly RawCodec<CollectionSerCtx, CollectionDesCtx>[] & { phantom?: 'This codec is only valid for collections' };

/**
 * @beta
 */
export type CollNominalCodecOpts = NominalCodecOpts<CollectionSerCtx, CollectionDesCtx>;

/**
 * @beta
 */
export type CollTypeCodecOpts = TypeCodecOpts<CollectionSerCtx, CollectionDesCtx>;

/**
 * @beta
 */
export type CollCustomCodecOpts = CustomCodecOpts<CollectionSerCtx, CollectionDesCtx>;

/**
 * @beta
 */
export class CollectionCodecs {
  public static Defaults = {
    $date: CollectionCodecs.forType('$date', {
      serializeClass: Date,
      serialize(date, ctx) {
        if (isNaN(date.valueOf())) {
          throw new Error(`Can not serialize an invalid date (at '${escapeFieldNames(ctx.path)}')`);
        }
        return ctx.done({ $date: date.valueOf() });
      },
      deserialize(value, ctx) {
        return ctx.done(new Date(Number(value.$date)));
      },
    }),
    $vector: CollectionCodecs.forName('$vector', {
      serialize: (val, ctx) => (DataAPIVector.isVectorLike(val)) ? vector(val)[$SerializeForCollection](ctx) : ctx.nevermind(),
      deserialize: DataAPIVector[$DeserializeForCollection],
    }),
    $uuid: CollectionCodecs.forType('$uuid', UUID),
    $objectId: CollectionCodecs.forType('$objectId', ObjectId),
  };

  public static forId(clazz: CollectionCodecClass): RawCollCodecs {
    assertIsCodecClass(clazz);

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

  /**
   * @deprecated
   */
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

  public static asCodecClass<Class extends SomeConstructor>(clazz: Class, fns?: AsCollectionCodecClassFns<Class>): CollectionCodecClass {
    if (fns) {
      if (!('prototype' in clazz)) {
        throw new Error(`Cannot attach ser/des functions to non-class ${clazz}`);
      }
      (clazz as any)[$DeserializeForCollection] = fns.deserializeForCollection;
      (clazz.prototype)[$SerializeForCollection] = fns.serializeForCollection;
    }
    assertIsCodecClass(clazz);
    return clazz;
  }
}

export interface AsCollectionCodecClassFns<Class extends SomeConstructor> {
  serializeForCollection: (this: InstanceType<Class>, ctx: CollectionSerCtx) => ReturnType<SerDesFn<any>>;
  deserializeForCollection: SerDesFn<CollectionDesCtx>;
}

function assertIsCodecClass(clazz: unknown): asserts clazz is CollectionCodecClass {
  if (typeof clazz !== 'function') {
    throw new TypeError(`Invalid codec class: expected a constructor; got ${betterTypeOf(clazz)}`);
  }
  assertHasSerializeFor(clazz, $SerializeForCollection, '$SerializeForCollection');
  assertHasDeserializeFor(clazz, $DeserializeForCollection, '$DeserializeForCollection');
}

function validateIfCodecClass<T>(val: CollectionCodecClass | T) {
  if (typeof val === 'function') {
    // We can't check for $SerializeForCollection here because it may not be on the prototype, depending on how it's
    // implemented in the class. This at least helps catch cases when a completely wrong class is passed.
    assertHasDeserializeFor(val, $DeserializeForCollection, '$DeserializeForCollection');
  }
}
