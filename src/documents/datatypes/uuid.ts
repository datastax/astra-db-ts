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

import * as _uuid from 'uuid';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { CollCodec, TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents/index.js';
import { type CollDesCtx, type CollSerCtx } from '@/src/documents/index.js';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';

/**
 * A shorthand function for `new UUID(uuid)`
 *
 * `uuid(4)` and `uuid(7)` are equivalent to `UUID.v4()` and `UUID.v7()`, respectively.
 *
 * @public
 */
export const uuid = (uuid: string | 1 | 4 | 6 | 7) => {
  switch (uuid) {
    case 1:
      return UUID.v1();
    case 4:
      return UUID.v4();
    case 6:
      return UUID.v6();
    case 7:
      return UUID.v7();
    default:
      return new UUID(uuid);
  }
};

/**
 * Represents a UUID that can be used as an _id in the DataAPI.
 *
 * Provides methods for creating v4 and v7 UUIDs, and for parsing timestamps from v7 UUIDs.
 *
 * @example
 * ```typescript
 * const collections = await db.createCollection('myCollection'. {
 *   defaultId: {
 *     type: 'uuidv7',
 *   },
 * });
 *
 * await collections.insertOne({ type: 'Jomsvikings' });
 *
 * const doc = await collections.findOne({ type: 'Jomsvikings' });
 *
 * // Prints the UUID of the document
 * console.log(doc._id.toString());
 *
 * // Prints the timestamp when the document was created (server time)
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @example
 * ```typescript
 * await collections.insertOne({ _id: UUID.v4(), car: 'toon' });
 *
 * const doc = await collections.findOne({ car: 'toon' });
 *
 * // Prints the UUID of the document
 * console.log(doc._id.toString());
 *
 * // Undefined, as the document was created with a v4 UUID
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @see ObjectId
 *
 * @public
 */
export class UUID implements CollCodec<typeof UUID>, TableCodec<typeof UUID> {
  /**
   * The version of the UUID.
   */
  public readonly version!: number;

  private readonly _raw!: string;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this._raw);
  };

  /**
   * Implementation of `$SerializeForCollection` for {@link TableCodec}
   */
  public [$SerializeForCollection](ctx: CollSerCtx) {
    return ctx.done({ $uuid: this._raw });
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](value: any, ctx: TableDesCtx) {
    return ctx.done(new UUID(value, false));
  }

  /**
   * Implementation of `$DeserializeForCollection` for {@link TableCodec}
   */
  public static [$DeserializeForCollection](value: any, ctx: CollDesCtx) {
    return ctx.done(new UUID(value.$uuid, false));
  }

  /**
   * Creates a new UUID instance.
   *
   * Use `UUID.v4()` or `UUID.v7()` to generate random new UUIDs.
   *
   * @param uuid - The UUID string.
   * @param validate - Whether to validate the UUID string. Defaults to `true`.
   * @param version - The version of the UUID. If not provided, it is inferred from the UUID string.
   */
  constructor(uuid: string, validate = true, version = 0) {
    if (validate) {
      if (typeof <unknown>uuid !== 'string') {
        throw new Error(`UUID '${uuid}' must be a string`);
      }

      if (!_uuid.validate(uuid)) {
        throw new Error(`UUID '${uuid}' is not valid`);
      }
    }

    Object.defineProperty(this, '_raw', {
      value: uuid.toLowerCase(),
    });

    Object.defineProperty(this, 'version', {
      value: version || parseInt(this._raw[14], 16),
    });

    Object.defineProperty(this, $CustomInspect, {
      value: () => `UUID<${this.version}>("${this._raw}")`,
    });
  }

  /**
   * Compares this UUID to another UUID.
   *
   * **The other UUID can be a UUID instance or a string.**
   *
   * A UUID is considered equal to another UUID if their lowercase string representations are equal.
   *
   * @param other - The UUID to compare to.
   *
   * @returns `true` if the UUIDs are equal, `false` otherwise.
   */
  public equals(other: unknown): boolean {
    if (typeof other === 'string') {
      return this._raw === other.toLowerCase();
    }
    if (other instanceof UUID) {
      return this._raw === other._raw;
    }
    return false;
  }

  /**
   * Returns the timestamp of a v1 or v7 UUID. If the UUID is not a v1 or v7 UUID, this method returns `undefined`.
   *
   * @returns The timestamp of the UUID, or `undefined` if the UUID is not a v1 or v7 UUID.
   */
  public getTimestamp(): Date | undefined {
    switch (this.version) {
      case 1:
        return uuidV1Timestamp(this);
      case 7:
        return uuidV7Timestamp(this);
      default:
        return undefined;
    }
  }

  /**
   * Returns the string representation of the UUID in lowercase.
   */
  public toString(): string {
    return this._raw;
  }

  /**
   * Creates a new v1 UUID.
   */
  public static v1(msecs?: number, nsecs?: number): UUID {
    return new UUID(_uuid.v1({ msecs, nsecs }), false, 1);
  }

  /**
   * Creates a new v4 UUID.
   */
  public static v4(): UUID {
    return new UUID(_uuid.v4(), false, 4);
  }

  /**
   * Creates a new v6 UUID.
   */
  public static v6(msecs?: number, nsecs?: number): UUID {
    return new UUID(_uuid.v6({ msecs, nsecs }), false, 6);
  }

  /**
   * Creates a new v7 UUID.
   */
  public static v7(msecs?: number): UUID {
    return new UUID(_uuid.v7({ msecs }), false, 7);
  }
}

const MAGIC_NUMBER = 1221929280000000 * 100;

function uuidV1Timestamp(uuid: UUID): Date | undefined {
  const arr = uuid.toString().split('-');
  const timeStr = [arr[2].substring(1), arr[1], arr[0]].join('');
  const timeInt = parseInt(timeStr, 16);
  return new Date(~~((timeInt - MAGIC_NUMBER) / 10000));
}

function uuidV7Timestamp(uuid: UUID): Date | undefined {
  const timestampBytes = new Uint8Array(8);
  timestampBytes.set(new Uint8Array(_uuid.parse(uuid.toString()).buffer.slice(0, 6)), 2);
  const timestampMs = new DataView(timestampBytes.buffer).getBigUint64(0);
  return new Date(Number(timestampMs));
}
