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
// noinspection DuplicatedCode

import { describe } from '@/tests/testlib';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';

describe('unit.documents.table.ser-des.snake-case-interop', () => {
  const serdes = new TableSerDes({ snakeCaseInterop: true });

  it('should convert the top-level fields to snake_case', () => {
    const res = serdes.serialize({
      aCoolField: 'dontConvertMe',
      BCoolField: ['dontConvertMe'],
      _CoolField: new Map([['dontConvertMe', 'dontConvertMe']]),
      d_cool_field: 123n,
      e_Cool_Field: { dontCovertMe: 'dontConvertMe' },
      [Symbol.for('hi')]: 'dontConvertMe',
    });

    console.log(res);
  });
});
