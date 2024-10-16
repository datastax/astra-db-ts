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

import { r, p, Result, ok } from '@/src/lib/validation';
import { Caller } from '@/src/client';
import { isNullish } from '@/src/lib/utils';

export const parseCaller = (caller: unknown, field: string): Result<Caller | Caller[] | undefined> => {
  if (isNullish(caller)) {
    return ok(undefined);
  }

  if (!Array.isArray(caller)) {
    return p.typeError(`Expected ${field}.caller to be an array, or undefined/null`);
  }

  const isCallerArr = Array.isArray(caller[0]);

  const callers = (isCallerArr)
    ?  caller
    : [caller];

  const mkIdxMsg = (isCallerArr)
    ? (i: number) => `[${i}]`
    : () => '';

  return r.mapM((c, i): Result<Caller> => {
    if (!Array.isArray(c)) {
      return p.typeError(`Expected ${field}.caller${mkIdxMsg(i)} to be a tuple [name: string, version?: string]`);
    }

    if (c.length < 1 || 2 < c.length) {
      return p.typeError(`Expected ${field}.caller${mkIdxMsg(i)} to be of format [name: string, version?: string]`);
    }

    const [name, version] = c;

    if (typeof name !== 'string') {
      return p.error(`Expected ${field}.caller${mkIdxMsg(i)}[0] to be a string name (got ${typeof name})`);
    }

    if (isNullish(version) && typeof version !== 'string') {
      return p.error(`Expected ${field}.caller${mkIdxMsg(i)}[1] to be a string (or undefined) version (got ${typeof version})`);
    }

    return ok([name, version || undefined]);
  })(callers);
};
