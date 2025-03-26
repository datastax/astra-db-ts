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
// noinspection ExceptionCaughtLocallyJS

import { betterTypeOf } from '@/src/documents/utils.js';
import { jsonTryStringify } from '@/src/lib/utils.js';

/**
 * @public
 */
export class NonErrorError extends Error {
  public readonly value: unknown;

  public constructor(value: unknown) {
    const valueType = betterTypeOf(value);

    try {
      const valueString = jsonTryStringify(value, `${value}`);
      super(`Non-error value thrown; type='${valueType}' toString='${value}' JSON.stringified='${valueString}'`);
    } catch (_) {
      super(`Non-error value thrown; type='${valueType}'`); // catch to prevent property tests from failing if obj toString is not a function
    }

    this.value = value;
  }

  public static asError(e: unknown): Error {
    if (e instanceof Error) {
      return e;
    }
    return new NonErrorError(e);
  }
}
