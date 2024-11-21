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
import { $CustomInspect } from '@/src/lib/constants';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des';
import { $SerializeForTable } from '@/src/documents/tables/ser-des';

const uuidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

export const uuid = (uuid: string | 4 | 7) =>
  (typeof uuid === 'string')
    ? new UUID(uuid) :
  (uuid === 4)
    ? UUID.v4()
    : UUID.v7();

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
export class UUID {
  /**
   * The version of the UUID.
   */
  public readonly version!: number;

  readonly #raw: string;

  public [$SerializeForCollection] = () => ({ $uuid: this.#raw });
  public [$SerializeForTable] = this.toString;

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

    this.#raw = uuid.toLowerCase();

    Object.defineProperty(this, 'version', {
      value: parseInt(this.#raw[14], 16),
    });

    Object.defineProperty(this, $CustomInspect, {
      value: () => `UUID<${this.version}>("${this.#raw}")`,
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
      return this.#raw === other.toLowerCase();
    }
    if (other instanceof UUID) {
      return this.#raw === other.#raw;
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
    return this.#raw;
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
