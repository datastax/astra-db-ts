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

import ipRegex from 'ip-regex';

export class InetAddress {
  readonly #address: string;
  #version: 4 | 6 | undefined;

  constructor(address: string, version?: 4 | 6) {
    this.#address = address;
    this.#version = version;
  }

  static fromIP(raw: string): InetAddress {
    if (!isValidIP(raw)) {
      throw new Error(`${raw} is not a valid IP address`);
    }
    return new InetAddress(raw);
  }

  static fromIPv4(raw: string): InetAddress {
    if (!isIPv4(raw)) {
      throw new Error(`${raw} is not a valid IPv4 address`);
    }
    return new InetAddress(raw, 4);
  }

  static fromIPv6(raw: string): InetAddress {
    if (!isIPv6(raw)) {
      throw new Error(`${raw} is not a valid IPv6 address`);
    }
    return new InetAddress(raw, 6);
  }

  public version(): 4 | 6 {
    if (!this.#version) {
      this.#version = isIPv4(this.#address) ? 4 : 6;
    }
    return this.#version;
  }

  public get(): string {
    return this.#address;
  }
}

const IPv4Lengths = { max: 15, min: 7 };
const IPv6Lengths = { max: 45, min: 2 };

function isValidIP(raw: string) {
  if (raw.length < IPv4Lengths.min || IPv6Lengths.max < raw.length) {
    return false;
  }
  return ipRegex({ exact: true }).test(raw);
}

function isIPv6(raw: string) {
  if (raw.length < IPv6Lengths.min || IPv6Lengths.max < raw.length) {
    return false;
  }
  return ipRegex.v6({ exact: true }).test(raw);
}

function isIPv4(raw: string) {
  if (raw.length < IPv4Lengths.min || IPv4Lengths.max < raw.length) {
    return false;
  }
  return ipRegex.v6({ exact: true }).test(raw);
}
