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
import { nullish } from '@/src/lib';
import { $DeserializeForTable, $SerializeForTable, TableCodec, TableSerCtx } from '@/src/documents';

export const inet = (address: string, version?: 4 | 6) => new InetAddress(address, version);

export class InetAddress implements TableCodec<typeof InetAddress> {
  readonly #raw: string;
  #version: 4 | 6 | nullish;

  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this.#raw);
  };

  public static [$DeserializeForTable](value: any) {
    return new InetAddress(value, null, false);
  }

  public constructor(address: string, version?: 4 | 6 | null, validate = true) { // ::1 => 0:0:0:0:0:0:0:1
    if (validate) {
      switch (version) {
        case 4:
          if (!isIPv4(address)) {
            throw new Error(`'${address}' is not a valid IPv4 address`);
          }
          break;
        case 6:
          if (!isIPv6(address)) {
            throw new Error(`'${address}' is not a valid IPv6 address`);
          }
          break;
        default:
          if (!(version = isIPv4(address) ? 4 : isIPv6(address) ? 6 : null)) {
            throw new Error(`'${address}' is not a valid IPv4 or IPv6 address`);
          }
      }
    }

    this.#raw = address.toLowerCase();
    this.#version = version;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `InetAddress<${this.version}>("${this.#raw}")`,
    });
  }

  public get version(): 4 | 6 {
    if (!this.#version) {
      this.#version = isIPv4(this.#raw) ? 4 : 6;
    }
    return this.#version;
  }

  public toString(): string {
    return this.#raw;
  }
}

const IPv4Lengths = { max: 15, min: 7 };
const IPv6Lengths = { max: 45, min: 2 };

// =====================================================================================================================
// From https://github.com/sindresorhus/ip-regex/blob/main/index.js
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

function isIPv6(raw: string) {
  if (raw.length < IPv6Lengths.min || IPv6Lengths.max < raw.length) {
    return false;
  }
  return IPv6Regex.test(raw);
}

function isIPv4(raw: string) {
  if (raw.length < IPv4Lengths.min || IPv4Lengths.max < raw.length) {
    return false;
  }
  return IPv4Regex.test(raw);
}
