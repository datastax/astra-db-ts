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

import { FinalVectorizeTestBranch } from '@/tests/integration/data-api/vectorize/vec-test-branches';

export const whitelistImplFor = (whitelist: string) => {
  switch (true) {
    case whitelist.startsWith('$limit:'):
      return new LimitWhitelist(whitelist, (_) => '');
    case whitelist.startsWith('$provider-limit:'):
      return new LimitWhitelist(whitelist, (t) => t.providerName);
    case whitelist.startsWith('$model-limit:'):
      return new LimitWhitelist(whitelist, (t) => t.providerName + t.modelName);
    default:
      return new RegexWhitelist(whitelist);
  }
}

class LimitWhitelist {
  limit: number;
  seen = new Map<string, number>();

  constructor(whitelist: string, readonly mkKey: (test: FinalVectorizeTestBranch) => string) {
    this.limit = +whitelist.split(':')[1];
  }

  test(test: FinalVectorizeTestBranch) {
    const key = this.mkKey(test);

    const timesSeen = (this.seen.get(key) ?? 0) + 1;
    this.seen.set(key, timesSeen);

    return timesSeen <= this.limit;
  }
}

class RegexWhitelist {
  regex: RegExp;

  constructor(whitelist: string) {
    this.regex = RegExp(whitelist);
  }

  test(test: FinalVectorizeTestBranch) {
    return this.regex.test(test.branchName);
  }
}
