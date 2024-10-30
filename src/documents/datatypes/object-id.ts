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

import { isNullish } from '@/src/lib/utils';
import { $CustomInspect } from '@/src/lib/constants';
import { $SerializeForCollections } from '@/src/documents/collections/ser-des';

const objectIdRegex = new RegExp('^[0-9a-fA-F]{24}$');

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
export class ObjectId {
  readonly #raw: string;

  public [$SerializeForCollections] = () => ({ $objectId: this.#raw });

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

    this.#raw = (typeof id === 'string') ? id.toLowerCase() : genObjectId(id);

    Object.defineProperty(this, $CustomInspect, {
      value: () => `ObjectId("${this.#raw}")`,
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
      return this.#raw.localeCompare(other, undefined, { sensitivity: 'accent' }) === 0;
    }
    if (other instanceof ObjectId) {
      return this.#raw.localeCompare(other.#raw, undefined, { sensitivity: 'accent' }) === 0;
    }
    return false;
  }

  /**
   * Returns the timestamp of the ObjectId.
   *
   * @returns The timestamp of the ObjectId.
   */
  public getTimestamp(): Date {
    const time = parseInt(this.#raw.slice(0, 8), 16);
    return new Date(~~time * 1000);
  }

  /**
   * Returns the string representation of the ObjectId.
   */
  public toString(): string {
    return this.#raw;
  }
}

const RAND_ID = ~~(Math.random() * 0xFFFFFF);
const PID = ((typeof process === 'undefined' || typeof process.pid !== 'number') ? ~~(Math.random() * 100000) : process.pid) % 0xFFFF;

const HexTable = Array.from({ length: 256 }, (_, i) => {
  return (i <= 15 ? '0' : '') + i.toString(16);
});

let index = ~~(Math.random() * 0xFFFFFF);

function genObjectId(time?: number | null): string {
  time ??= ~~(Date.now() / 1000);
  time = time % 0xFFFFFFFF;

  index = (index + 1) % 0xFFFFFF;

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
  hexString += HexTable[((index >> 16) & 0xFF)];
  hexString += HexTable[((index >> 8) & 0xFF)];
  hexString += HexTable[(index & 0xFF)];

  return hexString;
}
