const { Runner, reporters } = require('mocha');
const util = require('node:util');
const fs = require('node:fs');

class ErrorsReporter extends reporters.Spec {
  #erroredTests = [];

  constructor(runner) {
    super(runner);

    runner.on(Runner.constants.EVENT_TEST_FAIL, (test, err) => {
      this.#erroredTests.push([test, err])
    });
  }

  epilogue() {
    super.epilogue();

    let output = '';
    let existingHierarchy = [];

    for (const [test, err] of this.#erroredTests) {
      const testName = (!test.title.endsWith('ms)'))
        ? `${test.title} (${test.duration}ms)`
        : test.title

      console.log(test);

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

    fs.writeFileSync('etc/test-errors-report.md', output);
  }
}

module.exports = ErrorsReporter;
