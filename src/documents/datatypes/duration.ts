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

import { $CustomInspect } from '@/src/lib/constants';
import { TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';

/**
 * A shorthand function for `new DataAPIDuration(duration)`
 *
 * @public
 */
export const duration = (duration: string) => new DataAPIDuration(duration);

/**
 * Represents a `duration` column for Data API tables.
 *
 * You may use the {@link duration} function as a shorthand for creating a new `DataAPIDuration`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPIDuration implements TableCodec<typeof DataAPIDuration> {
  readonly #duration: string;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this.toString());
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](_: unknown, value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPIDuration(value));
  }

  /**
   * Creates a new `DataAPIDuration` instance from a duration string.
   *
   * @param input - The duration string to create the `DataAPIDuration` from
   */
  constructor(input: string) {
    this.#duration = input;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDuration("${this.#duration}")`,
    });
  }

  /**
   * Returns the string representation of this `DataAPIDuration`
   *
   * @returns The string representation of this `DataAPIDuration`
   */
  public toString() {
    return this.#duration;
  }
}
