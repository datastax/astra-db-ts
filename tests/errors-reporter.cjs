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

const { Runner, reporters } = require(['mocha'][0]);
const util = require('node:util');
const fs = require('node:fs');

const REPORTS_DIR = 'etc/test-reports';

class ErrorsReporter extends reporters.Spec {
  #erroredTests = [];

  constructor(runner) {
    super(runner);

    if (process.env.CLIENT_NO_ERROR_REPORT) {
      return;
    }

    runner.on(Runner.constants.EVENT_TEST_FAIL, (test, err) => {
      this.#erroredTests.push([test, err])
    });
  }

  epilogue() {
    super.epilogue();

    if (!this.#erroredTests.length) {
      return;
    }

    let output = '';
    let existingHierarchy = [];

    for (const [test, err] of this.#erroredTests) {
      const testName = (!test.title.endsWith('ms)'))
        ? `${test.title} (${test.duration}ms)`
        : test.title

      const newHierarchy = [testName];

      for (let suite = test.parent; suite.title; suite = suite.parent) {
        newHierarchy.unshift(suite.title);
      }

      const hierarchyDiff = newHierarchy.map((v, i) => existingHierarchy[i] === v ? undefined : v);
      existingHierarchy = newHierarchy;

      output += hierarchyDiff.map((v, i) => v ? '#'.repeat(i + 1) + ' ' + v + '\n' : '').join('\n');
      output += '\n```ts\n';
      output += `// ${test.file}\n`
      output += `// ${existingHierarchy.join(' > ')}\n`
      output += util.inspect(err, { depth: null }).replaceAll(/\u001b\[[0-9]+?m/g, '');
      output += '\n```\n';
    }

    const timestamp = new Date().toISOString().replaceAll(':', '_');

    if (!fs.existsSync(REPORTS_DIR)){
      fs.mkdirSync(REPORTS_DIR);
    }

    fs.writeFileSync(`${REPORTS_DIR}/${timestamp}.md`, output);
  }
}

module.exports = ErrorsReporter;
