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

import { UUID as UUIDv7, uuidv4, uuidv7 } from 'uuidv7';
import { isNullish } from '@/src/common';

/**
 * All possible types for a document ID. JSON scalar types, `Date`, `UUID`, and `ObjectId`.
 *
 * Note that the `_id` *can* technically be `null`. Trying to set the `_id` to `null` doesn't mean "auto-generate
 * an ID" like it may in some other databases; it quite literally means "set the ID to `null`".
 *
 * It's heavily recommended to properly type this in your Schema, so you know what to expect for your `_id` field.
 *
 * @public
 */
export type SomeId = string | number | bigint | boolean | Date | UUID | ObjectId | null;

const uuidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

/**
 * Represents a UUID that can be used as an _id in the DataAPI.
 *
 * Provides methods for creating v4 and v7 UUIDs, and for parsing timestamps from v7 UUIDs.
 *
 * @example
 * ```typescript
 * const collection = await db.createCollection('myCollection'. {
 *   defaultId: {
 *     type: 'uuidv7',
 *   },
 * });
 *
 * await collection.insertOne({ album: 'Jomsviking' });
 *
 * const doc = await collection.findOne({ album: 'Jomsviking' });
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
 * await collection.insertOne({ _id: UUID.v4(), album: 'Berserker' });
 *
 * const doc = await collection.findOne({ album: 'Berserker' });
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
export class UUID {
  /**
   * The version of the UUID.
   */
  public readonly version!: number;

  private readonly _raw!: string;

  /**
   * Creates a new UUID instance.
   *
   * Use `UUID.v4()` or `UUID.v7()` to generate random new UUIDs.
   *
   * @param uuid - The UUID string.
   * @param validate - Whether to validate the UUID string. Defaults to `true`.
   */
  constructor(uuid: string, validate = true) {
    if (validate) {
      if (typeof <unknown>uuid !== 'string') {
        throw new Error('UUID must be a string');
      }

      if (uuid.length !== 36 || !uuidRegex.test(uuid)) {
        throw new Error('UUID must be a 36-character hex string');
      }
    }

    Object.defineProperty(this, '_raw', {
      value: uuid.toLowerCase(),
      writable: false,
    });

    Object.defineProperty(this, 'version', {
      value: parseInt(this._raw[14], 16),
      writable: false,
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
      return this._raw === other;
    }
    if (other instanceof UUID) {
      return this._raw === other._raw;
    }
    return false;
  }

  /**
   * Returns the timestamp of a v7 UUID. If the UUID is not a v7 UUID, this method returns `undefined`.
   *
   * @returns The timestamp of the UUID, or `undefined` if the UUID is not a v7 UUID.
   */
  public getTimestamp(): Date | undefined {
    return timestampFromUUID(this);
  }

  /**
   * Returns the string representation of the UUID in lowercase.
   */
  public toString(): string {
    return this._raw;
  }

  /**
   * Creates a new v4 UUID.
   */
  public static v4(): UUID {
    return new UUID(uuidv4(), false);
  }

  /**
   * Creates a new v7 UUID.
   */
  public static v7(): UUID {
    return new UUID(uuidv7(), false);
  }

  /**
   * Inspects the UUID.
   */
  public inspect(): string {
    return `UUID("${this.toString()}")`;
  }

  /**
   * Converts the UUID to a JSON representation.
   *
   * Serializes to `{ $uuid: 'uuid' }`.
   */
  public toJSON() {
    return { $uuid: this.toString() };
  }
}

const objectIdRegex = new RegExp('^[0-9a-fA-F]{24}$');

/**
 * Represents an ObjectId that can be used as an _id in the DataAPI.
 *
 * Provides methods for generating ObjectIds and getting the timestamp of an ObjectId.
 *
 * @example
 * ```typescript
 * const collection = await db.createCollection('myCollection'. {
 *   defaultId: {
 *     type: 'objectId',
 *   },
 * });
 *
 * await collection.insertOne({ album: 'Inhuman Rampage' });
 *
 * const doc = await collection.findOne({ album: 'Inhuman Rampage' });
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
 * await collection.insertOne({ _id: new ObjectId(), album: 'Sacrificium' });
 *
 * const doc = await collection.findOne({ album: 'Sacrificium' });
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
export class ObjectId {
  private readonly _raw!: string;

  /**
   * Creates a new ObjectId instance.
   *
   * If `id` is provided, it must be a 24-character hex string. Otherwise, a new ObjectId is generated.
   *
   * @param id - The ObjectId string.
   * @param validate - Whether to validate the ObjectId string. Defaults to `true`.
   */
  constructor(id?: string | number | null, validate = true) {
    if (validate) {
      if (typeof id === 'string') {
        if (id.length !== 24 || !objectIdRegex.test(id)) {
          throw new Error('ObjectId must be a 24-character hex string');
        }
      } else if (typeof id !== 'number' && !isNullish(id)) {
        throw new Error('ObjectId must be a string, number, or nullish');
      }
    }

    Object.defineProperty(this, '_raw', {
      value: (typeof id === 'string') ? id.toLowerCase() : genObjectId(id),
      writable: false,
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

  /**
   * Inspects the ObjectId.
   */
  public inspect(): string {
    return `ObjectId("${this.toString()}")`;
  }

  /**
   * Converts the ObjectId to a JSON representation.
   *
   * Serializes to `{ $objectId: 'objectId' }`.
   */
  public toJSON() {
    return { $objectId: this.toString() };
  }
}

const RAND_ID = ~~(Math.random() * 0xFFFFFF);
const PID = ((typeof process === 'undefined' || typeof process.pid !== 'number') ? ~~(Math.random() * 100000) : process.pid) % 0xFFFF;

const hexTable = Array.from({ length: 256 }, (_, i) => {
  return (i <= 15 ? '0' : '') + i.toString(16);
});

let index = ~~(Math.random() * 0xFFFFFF);

function genObjectId(time?: number | null): string {
  time ??= ~~(Date.now() / 1000);
  time = time % 0xFFFFFFFF;

  index = (index + 1) % 0xFFFFFF;

  let hexString = '';

  hexString += hexTable[((time >> 24) & 0xFF)];
  hexString += hexTable[((time >> 16) & 0xFF)];
  hexString += hexTable[((time >> 8) & 0xFF)];
  hexString += hexTable[(time & 0xFF)];
  hexString += hexTable[((RAND_ID >> 16) & 0xFF)];
  hexString += hexTable[((RAND_ID >> 8) & 0xFF)];
  hexString += hexTable[(RAND_ID & 0xFF)];
  hexString += hexTable[((PID >> 8) & 0xFF)];
  hexString += hexTable[(PID & 0xFF)];
  hexString += hexTable[((index >> 16) & 0xFF)];
  hexString += hexTable[((index >> 8) & 0xFF)];
  hexString += hexTable[(index & 0xFF)];

  return hexString;
}

function timestampFromUUID(uuid: UUID): Date | undefined {
  if (uuid.version !== 7) {
    return undefined;
  }

  const timestampBytes = new Uint8Array(8);
  timestampBytes.set(new Uint8Array(UUIDv7.parse(uuid.toString()).bytes.buffer.slice(0, 6)), 2);
  const timestampMs = new DataView(timestampBytes.buffer).getBigUint64(0);

  return new Date(Number(timestampMs));
}
