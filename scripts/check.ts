#!/usr/bin/env -S npx tsx

import 'zx/globals';
import path from 'path';
import fs from 'fs/promises';
import { Step, Steps } from './utils/steps.js';
import { spinner } from 'zx';
import { Args } from './utils/arg-parse.js';
import { root } from './utils/constants.js';

const Utils = mkUtils();
let failed = false;

const checks = new Args('check.ts')
  .boolean('TypeCheck', {
    flags: ['tc'],
  })
  .boolean('Lint', {
    flags: ['lint'],
  })
  .boolean('Licensing', {
    flags: ['licensing'],
  })
  .boolean('TestExts', {
    flags: ['test-exts'],
  })
  .boolean('TestNames', {
    flags: ['test-names'],
  })
  .boolean('LibCheck', {
    flags: ['lib-check'],
  })
  .boolean('ModuleExportsDiff', {
    flags: ['module-exports-diff'],
  })
  .parse();

if (Object.values(checks).every(v => !v)) {
  for (const key of Object.keys(checks)) {
    (checks as any)[key] = true;
  }
}

await new Steps()
  .do(TypeCheck())
  .do(Lint())
  .do(Licensing())
  .do(TestExts())
  .do(TestNames())
  .do(LibCheck())
  .do(ModuleExportsDiff())
  .run();

if (!failed) {
  console.log(chalk.bold.green('Checks passed :)'));
} else {
  console.log(chalk.bold.red('Checks failed :('));
  process.exit(1);
}

function TypeCheck(): Step {
  return async () => {
    if (!checks.TypeCheck) {
      return;
    }

    Utils.printGreenWithStatus('Running type-checker...');

    try {
      await spinner('Running tsc...', () => $`npx tsc --noEmit`.quiet());
    } catch (_) {
      await spinner('Error detected... rerunning tsc with captured output', async () => {
        await $({ stdio: 'inherit', nothrow: true })`npx tsc --noEmit`;
      });
      Utils.printFailed('Type-checking failed');
    }
  };
}

function Lint(): Step {
  return async () => {
    if (!checks.Lint) {
      return;
    }

    Utils.printGreenWithStatus('Running linter...');

    try {
      await spinner('Running eslint...', () => $`npm run lint -- --no-warn-ignored`.quiet());
    } catch (error) {
      await spinner('Error detected... rerunning eslint with captured output', async () => {
        await $({ stdio: 'inherit', nothrow: true })`npm run lint -- --no-warn-ignored`;
      });
      Utils.printFailed('Linting failed');
    }
  };
}

function Licensing(): Step {
  return async () => {
    if (!checks.Licensing) {
      return;
    }

    Utils.printGreenWithStatus('Running licensing headers check...');

    const { stdout } = await spinner('Finding files without licensing headers...', () => {
      return $`find tests/ src/ -type f -exec grep -L "^// Copyright DataStax, Inc." {} +`;
    });
    const offenders = stdout.trim();

    if (offenders) {
      Utils.printFailed('The following files are missing licensing headers:');
      Utils.printFailed(offenders);
    }
  };
}

function LibCheck(): Step {
  return async () => {
    if (!checks.LibCheck) {
      return;
    }

    Utils.printGreenWithStatus('Running library compilation with skipLibCheck: false...');

    const tmpDir = 'tmp-lib-check';
    await $`rm -rf ${tmpDir} ${root}/dist`;

    try {
      await spinner('Building library...', Utils.buildIfNotBuilt);
    } catch (_) {
      Utils.printFailed('Could not build library for lib-check phase');
      return;
    }

    await $`mkdir ${tmpDir}`;
    cd(tmpDir);

    try {
      await spinner('Initializing new project...', async () => {
        await $`npm init -y > /dev/null`;
        await $`npm install typescript "${root}" > /dev/null`;
        await fs.writeFile('src.ts', `import '@datastax/astra-db-ts'`);
        await $`npx tsc --init --skipLibCheck false --typeRoots "./node_modules/**" --target es2020 > /dev/null`;
      });

      if (await fs.access('tsconfig.json').then(() => true).catch(() => false)) {
        try {
          await spinner('Compiling new project...', async () => {
            await $`npx tsc`;
          });
        } catch (_) {
          Utils.printFailed('Library compilation failed');

          await spinner('Rerunning tsc with captured output...', async () => {
            await $({ stdio: 'inherit', nothrow: true })`npx tsc`;
          });
        }
      } else {
        Utils.printFailed('Could not set up library for lib-check phase');
      }
    } finally {
      cd(root);
      await $`rm -rf ${tmpDir}`;
    }
  };
}

function TestExts(): Step {
  return async () => {
    if (!checks.TestExts) {
      return;
    }

    Utils.printGreenWithStatus('Running test file extension check...');

    const { stdout } = await $`find tests/unit tests/integration -type d -name '__*' -prune -o -type f -not -name "*.test.ts" -exec echo "- {}" \\;`;
    const offenders = stdout.trim();

    if (offenders) {
      Utils.printFailed('The following test files do not end in \'.test.ts\':');
      Utils.printFailed(offenders);
    }
  };
}

function TestNames(): Step {
  return async () => {
    if (!checks.TestNames) {
      return;
    }

    Utils.printGreenWithStatus('Running test suite name check...');

    const { stdout: filesOutput } = await spinner('Finding test files...', () => {
      return $`find tests/unit tests/integration -type f -name "*.test.ts"`;
    });
    const files = filesOutput.trim().split('\n').filter(Boolean);

    const offenders: string[] = [];

    await spinner('Checking all test suite names...', async () => {
      await Promise.all(files.map(async (file) => {
        const dirPart = path.dirname(file).replace(/^tests\//, '').replace(/\//g, '\\.');
        const filePart = path.basename(file, '.test.ts');

        const regex = new RegExp(`(describe|parallel|background)\\('(\\([A-Z-]+\\) )*${dirPart}\\.${filePart}`);
        const fileContent = await fs.readFile(file, 'utf8');

        if (!regex.test(fileContent)) {
          offenders.push(`- ${file}`);
        }
      }));
    });

    if (offenders.length > 0) {
      Utils.printFailed('The following test suites do not match the test dir + file name:');
      Utils.printFailed(offenders.join('\n'));
    }
  };
}

function ModuleExportsDiff(): Step {
  return async () => {
    if (!checks.ModuleExportsDiff) {
      return;
    }

    Utils.printGreenWithStatus('Running ESM & CJS module exports comparison...');

    try {
      await spinner('Building library...', Utils.buildIfNotBuilt);
    } catch (_) {
      Utils.printFailed('Could not build library for module-exports-diff phase');
      return;
    }

    const { stderr } = await spinner('Comparing ESM & CJS module exports...', () => {
      return $`npx tsx -e '
        import("./dist/esm/index.js").then(Object.keys).then(esm => {
          const cjs = Object.keys(require("./dist/cjs/index.js"));
  
          const inCjsNotInEsm = cjs.filter(key => !esm.includes(key));
          const inEsmNotInCjs = esm.filter(key => !cjs.includes(key));
  
          if (inCjsNotInEsm.length > 0 || inEsmNotInCjs.length > 0) {
            console.error("The following exports are missing from either ESM or CJS:");
            console.error("In CJS but not ESM:", inCjsNotInEsm);
            console.error("In ESM but not CJS:", inEsmNotInCjs);
            process.exit(1);
          }
        }).catch(() => process.exit(1));
      '`.nothrow();
    });

    if (stderr) {
      Utils.printFailed('The following exports are missing from either ESM or CJS:');
      Utils.printFailed(stderr);
    }
  };
}

function mkUtils() {
  let _built = false;

  return {
    printGreen(text: string): void {
      console.log(chalk.bold.green(text));
    },

    printGreenWithStatus(text: string): void {
      const emoji = failed ? ':/' : ':)';
      this.printGreen(`- ${text} ${emoji}`);
    },

    printFailed(text: string): void {
      console.error(chalk.red(text));
      failed = true;
    },

    async buildIfNotBuilt(): Promise<void> {
      if (!_built) {
        await $`npx tsx scripts/build.ts`.quiet();
        _built = true;
      }
    },
  }
}
