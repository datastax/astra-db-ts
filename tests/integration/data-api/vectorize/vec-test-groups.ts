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
import { Collection, Db } from '@/src/data-api';
import crypto from 'node:crypto';
import * as util from 'node:util';

export interface VectorizeTestGroup {
  groupName: string;
  collName: string;
  tests: VectorizeTest[];
}

interface VectorizeTest {
  branch: FinalVectorizeTestBranch,
  coll: (db: Db) => Promise<Collection>,
}

interface VectorizeTestGroupDesc {
  clazz: new (tests: FinalVectorizeTestBranch[]) => VectorizeTestGroup,
  tests: FinalVectorizeTestBranch[],
}

export const createTestGroups = (branches: FinalVectorizeTestBranch[]): VectorizeTestGroup[] => {
  const acc: Record<string, VectorizeTestGroupDesc> = {};

  branches.reduce((groups, branch) => {
    const groupClass = (branch.authType !== 'none')
      ? HeaderKMSTestGroup
      : NoAuthTestGroup;

    const key = `${branch.providerName}@${branch.modelName}@${groupClass.name}`;

    if (!groups[key]) {
      groups[key] = {
        clazz: groupClass,
        tests: [],
      };
    }
    groups[key].tests.push(branch);

    return groups;
  }, acc);

  return Object.values(acc).map(({ clazz, tests }) => {
    return new clazz(tests);
  });
}

class HeaderKMSTestGroup implements VectorizeTestGroup {
  groupName: string;
  collName: string;
  tests: VectorizeTest[];

  constructor(branches: FinalVectorizeTestBranch[]) {
    if (branches.length !== 1 && branches.length !== 2) {
      throw new Error(`HeaderKMSTestGroup got tests w/ length !== 1|2; ${util.inspect(branches, { depth: null })}`);
    }

    const kmsBranch = branches.find(t => t.authType === 'providerKey');
    const headerBranch = branches.find(t => t.authType === 'header');

    this.groupName = this._mkCombinedTestName(kmsBranch?.branchName, headerBranch?.branchName);
    this.collName = mkCollectionName(this.groupName);

    const kmsTest = kmsBranch ? ({
      branch: kmsBranch,
      coll: this._mkColl(kmsBranch).bind(this),
    }) : null!;

    const headerTest = headerBranch ? ({
      branch: headerBranch,
      coll: (kmsBranch ? this._useColl(headerBranch) : this._mkColl(headerBranch)).bind(this),
    }) : null!;

    this.tests = [kmsTest, headerTest].filter(Boolean);
  }

  _mkCombinedTestName = (kmsTestName?: string, headerTestName?: string) => {
    const combinedAuthType = [kmsTestName, headerTestName].filter(Boolean).join('+');

    return (kmsTestName ?? headerTestName)!
      .replace('@header', combinedAuthType)
      .replace('@providerKey', combinedAuthType);
  };

  _mkColl = (branch: FinalVectorizeTestBranch) => (db: Db) => db.createCollection(this.collName, {
    vector: {
      dimension: branch.dimension,
      service: {
        provider: branch.providerName,
        modelName: branch.modelName,
        authentication: {
          providerKey: branch.providerKey,
        },
        parameters: branch.parameters,
      },
    },
    maxTimeMS: 0,
  });

  _useColl = (branch: FinalVectorizeTestBranch) => (db: Db) => Promise.resolve(
    db.collection(this.collName, {
      embeddingApiKey: branch.header,
    }),
  );
}

class NoAuthTestGroup implements VectorizeTestGroup {
  groupName: string;
  collName: string;
  tests: VectorizeTest[];

  constructor(branches: FinalVectorizeTestBranch[]) {
    if (branches.length !== 1) {
      throw new Error(`NoAuthTestGroup got tests w/ length !== 1; ${util.inspect(branches, { depth: null })}`);
    }

    const branch = branches[0];

    this.groupName = branch.branchName;
    this.collName = mkCollectionName(branch.branchName);

    this.tests = [{
      branch: branch,
      coll: this._mkColl(branch).bind(this),
    }];
  }

  _mkColl = (branch: FinalVectorizeTestBranch) => (db: Db) => db.createCollection(this.collName, {
    vector: {
      dimension: branch.dimension,
      service: {
        provider: branch.providerName,
        modelName: branch.modelName,
        parameters: branch.parameters,
      },
    },
  });
}

const mkCollectionName = (groupName: string): string => {
  return groupName[0] + crypto
    .createHash('md5')
    .update(groupName)
    .digest('hex');
}
