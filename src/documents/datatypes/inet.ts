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

import { $CustomInspect } from '@/src/lib/constants.js';
import type { nullish } from '@/src/lib/index.js';
import type { TableCodec, TableSerCtx, TableDesCtx} from '@/src/documents/index.js';
import { $SerializeForCollection } from '@/src/documents/collections/ser-des/constants.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { mkTypeUnsupportedForCollectionsError } from '@/src/lib/api/ser-des/utils.js';

/**
 * A shorthand function for `new DataAPIInet(addr, version?)`
 *
 * @public
 */
export const inet = (address: string | DataAPIInet, version?: 4 | 6 | null) => new DataAPIInet(address, version);

/**
 * Represents an `inet` column for Data API tables.
 *
 * You may use the {@link inet} function as a shorthand for creating a new `DataAPIInet`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPIInet implements TableCodec<typeof DataAPIInet> {
  readonly _raw: string;
  _version: 4 | 6 | nullish;

  /**
   * Errorful implementation of `$SerializeForCollection` for {@link TableCodec}
   *
   * Throws a human-readable error message warning that this datatype may not be used with collections without writing a custom ser/des codec.
   */
  public [$SerializeForCollection]() {
    throw mkTypeUnsupportedForCollectionsError('DataAPIInet', '_inet', [
      'Use another inet representation, such as a string, or an object containing the inet address, and the version',
    ]);
  };

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this._raw);
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPIInet(value, null, false));
  }

  /**
   * Checks if a string is a valid IPv6 address.
   *
   * **NOTE:** Will cover all common cases of IP addresses, but may reject otherwise valid addresses in more esoteric, yet still technically legal, forms.
   *
   * However, this will never return `true` on an IP which is actually invalid.
   */
  public static isIPv6(raw: string): boolean {
    if (raw.length < IPv6Lengths.min || IPv6Lengths.max < raw.length) {
      return false;
    }
    return IPv6Regex.test(raw);
  }

  /**
   * Checks if a string is a valid IPv4 address.
   *
   * **NOTE:** Will cover all common cases of IP addresses, but may reject otherwise valid addresses in more esoteric, yet still technically legal, forms.
   *
   * However, this will never return `true` on an IP which is actually invalid.
   */
  public static isIPv4(raw: string): boolean {
    if (raw.length < IPv4Lengths.min || IPv4Lengths.max < raw.length) {
      return false;
    }
    return IPv4Regex.test(raw);
  }

  /**
   * Creates a new `DataAPIInet` instance from a vector-like value.
   *
   * If you pass a `version`, the value will be validated as an IPv4 or IPv6 address; otherwise, it'll be validated as
   * either, and the version will be inferred from the value.
   *
   * You can set `validate` to `false` to bypass any validation if you're confident the value is a valid inet address.
   *
   * @param address - The address to create the `DataAPIInet` from
   * @param version - The IP version to validate the address as
   * @param validate - Whether to actually validate the address
   *
   * @throws TypeError If the address is not a valid IPv4 or IPv6 address
   */
  public constructor(address: string | DataAPIInet, version?: 4 | 6 | null, validate = true) { // ::1 => 0:0:0:0:0:0:0:1
    const addressStr = (address instanceof DataAPIInet) ? address._raw : address;

    if (validate) {
      switch (version) {
        case 4:
          if (!DataAPIInet.isIPv4(addressStr)) {
            throw new Error(`'${address}' is not a valid IPv4 address`);
          }
          break;
        case 6:
          if (!DataAPIInet.isIPv6(addressStr)) {
            throw new Error(`'${address}' is not a valid IPv6 address`);
          }
          break;
        default:
          if (!(version = DataAPIInet.isIPv4(addressStr) ? 4 : DataAPIInet.isIPv6(addressStr) ? 6 : null)) {
            throw new Error(`'${address}' is not a valid IPv4 or IPv6 address`);
          }
      }
    }

    this._raw = addressStr.toLowerCase();
    this._version = version;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIInet<${this.version}>("${this._raw}")`,
    });
  }

  /**
   * Returns the IP version of the inet address.
   *
   * @returns The IP version of the inet address
   */
  public get version(): 4 | 6 {
    if (!this._version) {
      this._version = DataAPIInet.isIPv4(this._raw) ? 4 : 6;
    }
    return this._version;
  }

  /**
   * Returns the string representation of the inet address.
   *
   * @returns The string representation of the inet address
   */
  public toString(): string {
    return this._raw;
  }
}

const IPv4Lengths = { max: 15, min: 7 };
const IPv6Lengths = { max: 45, min: 2 };

// =====================================================================================================================
// Vendored from https://github.com/sindresorhus/ip-regex/blob/main/index.js
// Was getting errors trying to import it while as a dependency, so just decided not to deal with it for the time being
const v4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}';

const v6segment = '[a-fA-F\\d]{1,4}';

const v6 = `
(?:
(?:${v6segment}:){7}(?:${v6segment}|:)|                                    // 1:2:3:4:5:6:7::  1:2:3:4:5:6:7:8
(?:${v6segment}:){6}(?:${v4}|:${v6segment}|:)|                             // 1:2:3:4:5:6::    1:2:3:4:5:6::8   1:2:3:4:5:6::8  1:2:3:4:5:6::1.2.3.4
(?:${v6segment}:){5}(?::${v4}|(?::${v6segment}){1,2}|:)|                   // 1:2:3:4:5::      1:2:3:4:5::7:8   1:2:3:4:5::8    1:2:3:4:5::7:1.2.3.4
(?:${v6segment}:){4}(?:(?::${v6segment}){0,1}:${v4}|(?::${v6segment}){1,3}|:)| // 1:2:3:4::        1:2:3:4::6:7:8   1:2:3:4::8      1:2:3:4::6:7:1.2.3.4
(?:${v6segment}:){3}(?:(?::${v6segment}){0,2}:${v4}|(?::${v6segment}){1,4}|:)| // 1:2:3::          1:2:3::5:6:7:8   1:2:3::8        1:2:3::5:6:7:1.2.3.4
(?:${v6segment}:){2}(?:(?::${v6segment}){0,3}:${v4}|(?::${v6segment}){1,5}|:)| // 1:2::            1:2::4:5:6:7:8   1:2::8          1:2::4:5:6:7:1.2.3.4
(?:${v6segment}:){1}(?:(?::${v6segment}){0,4}:${v4}|(?::${v6segment}){1,6}|:)| // 1::              1::3:4:5:6:7:8   1::8            1::3:4:5:6:7:1.2.3.4
(?::(?:(?::${v6segment}){0,5}:${v4}|(?::${v6segment}){1,7}|:))             // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8  ::8             ::1.2.3.4
)(?:%[0-9a-zA-Z]{1,})?                                             // %eth0            %1
`.replace(/\s*\/\/.*$/gm, '').replace(/\n/g, '').trim();

const IPv4Regex = new RegExp(`^${v4}$`);
const IPv6Regex = new RegExp(`^${v6}$`);
// =====================================================================================================================
