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

import { isNullish } from '@/src/lib/utils.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { CollectionCodec, CollectionDesCtx, CollectionSerCtx } from '@/src/documents/index.js';
import { $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { mkTypeUnsupportedForTablesError } from '@/src/lib/api/ser-des/utils.js';
import type { nullish } from '@/src/lib/index.js';

const objectIdRegex = new RegExp('^[0-9a-fA-F]{24}$');

/**
 * A shorthand function for `new ObjectId(oid?)`
 *
 * @public
 */
export const oid = (id?: string | number | null | ObjectId) => new ObjectId(id);

/**
 * Represents an ObjectId that can be used as an _id in the DataAPI.
 *
 * Provides methods for generating ObjectIds and getting the timestamp of an ObjectId.
 *
 * @example
 * ```typescript
 * const collections = await db.createCollection('myCollection'. {
 *   defaultId: {
 *     type: 'objectId',
 *   },
 * });
 *
 * await collections.insertOne({ album: 'Inhuman Rampage' });
 *
 * const doc = await collections.findOne({ album: 'Inhuman Rampage' });
 *
 * // Prints the ObjectId of the document
 * console.log(doc._id.toString());
 *
 * // Prints the timestamp when the document was created (server time)
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @example
 * ```typescript
 * await collections.insertOne({ _id: new ObjectId(), album: 'Sacrificium' });
 *
 * const doc = await collections.findOne({ album: 'Sacrificium' });
 *
 * // Prints the ObjectId of the document
 * console.log(doc._id.toString());
 *
 * // Prints the timestamp when the document was created (server time)
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @public
 */
export class ObjectId implements CollectionCodec<typeof ObjectId> {
  private readonly _raw!: string;

  /**
   * Errorful implementation of `$SerializeForTable` for {@link TableCodec}
   *
   * Throws a human-readable error message warning that this datatype may not be used with tables without writing a custom ser/des codec.
   */
  public [$SerializeForTable]() {
    throw mkTypeUnsupportedForTablesError('ObjectId', [
      'Use another object ID representation, such as a string',
    ]);
  };

  /**
   * Implementation of `$SerializeForCollection` for {@link TableCodec}
   */
  public [$SerializeForCollection](ctx: CollectionSerCtx) {
    return ctx.done({ $objectId: this._raw });
  };

  /**
   * Implementation of `$DeserializeForCollection` for {@link TableCodec}
   */
  public static [$DeserializeForCollection](value: any, ctx: CollectionDesCtx) {
    return ctx.done(new ObjectId(value.$objectId, false));
  }

  /**
   * Creates a new ObjectId instance.
   *
   * If `id` is provided, it must be a 24-character hex string. Otherwise, a new ObjectId is generated.
   *
   * @param id - The ObjectId string.
   * @param validate - Whether to validate the ObjectId string. Defaults to `true`.
   */
  constructor(id?: string | number | ObjectId | null, validate = true) {
    if (validate) {
      if (typeof id === 'string') {
        if (id.length !== 24 || !objectIdRegex.test(id)) {
          throw new Error('ObjectId must be a 24-character hex string');
        }
      } else if (typeof id !== 'number' && !isNullish(id) && !(id as unknown instanceof ObjectId)) {
        throw new Error('ObjectId must be a string, number, nullish, or another ObjectId instance');
      }
    }

    Object.defineProperty(this, '_raw', {
      value: (typeof id === 'string') ? id.toLowerCase() : (id instanceof ObjectId) ? id._raw : genObjectId(id, ObjectIDGenIndex),
    });

    Object.defineProperty(this, $CustomInspect, {
      value: () => `ObjectId("${this._raw}")`,
    });
  }

  /**
   * Compares this ObjectId to another ObjectId.
   *
   * **The other ObjectId can be an ObjectId instance or a string.**
   *
   * An ObjectId is considered equal to another ObjectId if their string representations are equal.
   *
   * @param other - The ObjectId to compare to.
   *
   * @returns `true` if the ObjectIds are equal, `false` otherwise.
   */
  public equals(other: unknown): boolean {
    if (typeof other === 'string') {
      return this._raw.localeCompare(other, undefined, { sensitivity: 'accent' }) === 0;
    }
    if (other instanceof ObjectId) {
      return this._raw.localeCompare(other._raw, undefined, { sensitivity: 'accent' }) === 0;
    }
    return false;
  }

  /**
   * Returns the timestamp of the ObjectId.
   *
   * @returns The timestamp of the ObjectId.
   */
  public getTimestamp(): Date {
    const time = parseInt(this._raw.slice(0, 8), 16);
    return new Date(~~time * 1000);
  }

  /**
   * Returns the string representation of the ObjectId.
   */
  public toString(): string {
    return this._raw;
  }
}

const RAND_ID = ~~(Math.random() * 0xFFFFFF);
const PID = ~~(Math.random() * 100000) % 0xFFFF;

const HexTable = Array.from({ length: 256 }, (_, i) => {
  return (i <= 15 ? '0' : '') + i.toString(16);
});

let ObjectIDGenIndex = ~~(Math.random() * 0xFFFFFF);

/**
 * @internal
 */
export function genObjectId(time: number | nullish, genIndex: number): string {
  time ??= ~~(Date.now() / 1000);
  time = time % 0xFFFFFFFF;

  ObjectIDGenIndex = (genIndex + 1) % 0xFFFFFF;

  let hexString = '';

  hexString += HexTable[((time >> 24) & 0xFF)];
  hexString += HexTable[((time >> 16) & 0xFF)];
  hexString += HexTable[((time >> 8) & 0xFF)];
  hexString += HexTable[(time & 0xFF)];
  hexString += HexTable[((RAND_ID >> 16) & 0xFF)];
  hexString += HexTable[((RAND_ID >> 8) & 0xFF)];
  hexString += HexTable[(RAND_ID & 0xFF)];
  hexString += HexTable[((PID >> 8) & 0xFF)];
  hexString += HexTable[(PID & 0xFF)];
  hexString += HexTable[((ObjectIDGenIndex >> 16) & 0xFF)];
  hexString += HexTable[((ObjectIDGenIndex >> 8) & 0xFF)];
  hexString += HexTable[(ObjectIDGenIndex & 0xFF)];

  return hexString;
}
