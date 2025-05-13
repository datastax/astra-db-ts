#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Args } from './utils/arg-parse.js';
import path from 'path';
import { chalk, globby, spinner } from 'zx';
import { root } from './utils/constants.js';
import { Step, Steps } from './utils/steps.js';
import * as readline from 'node:readline';

const opts = new Args('set-example-client-deps.ts')
  .stringArray('DirPatterns', {
    flags: ['-d', '-dirs'],
    default: ['examples/*/'],
  })
  .stringEnum('Mode', {
    choices: {
      tar: ['-tar'],
      sym: ['-sym'],
    },
  })
  .parse();

const TarFile = `${root}/examples/astra-db-ts.tgz`;

await new Steps()
  .do(Cleanup(), {
    spinner: 'Cleaning up previous installations...',
  })
  .do(ValidateDirectories(), {
    spinner: 'Finding and validating directories...',
  })
  .do(LogFoundDirectories())
  .do(BuildLibrary(), {
    spinner: 'Building the library...',
  })
  .do(SetupForInstallation(opts.Mode))
  .do(InstallLibrary())
  .run()

function Cleanup(): Step {
  return async () => {
    await $`rm -f ${TarFile}`.nothrow();
  };
}

type WithDirs = { dirs: string[]; }

function ValidateDirectories(): Step<never, WithDirs> {
  return async () => {
    const dirs = await globby(opts.DirPatterns.flatMap(d => d.split(',')), { onlyDirectories: true });

    if (dirs.length === 0) {
      console.error(chalk.red('No directories found matching given pattern(s)'));
      process.exit(1);
    }

    for (const dir of dirs) {
      if (path.dirname(path.relative(root, dir)) !== 'examples') {
        console.error(chalk.red('Directory must be in the examples/ folder'));
        process.exit(1);
      }
    }

    return { dirs };
  };
}

function LogFoundDirectories(): Step {
  return async (ctx) => {
    console.log(chalk.green(`Found ${ctx.dirs.length} directories to install the library into:`));

    for (const dir of ctx.dirs) {
      console.log(chalk.green('- ' + dir));
    }

    console.log();
  };
}

function BuildLibrary(): Step {
  return async () => {
    try {
      await $`npx tsx scripts/build.ts`.quiet();
    } catch (error) {
      console.error(chalk.red('Failed to build the library'));
      process.exit(1);
    }
  };
}

function SetupForInstallation(mode: 'tar' | 'sym'): Step<never, WithInstallDir> {
  return async () => {
    if (mode === 'tar') {
      await spinner('Creating tarball...', async () => {
        await $`npm pack`.quiet();
        const packResult = await $`ls -1 datastax-astra-db-ts-*.tgz`;
        const tempTarFile = packResult.stdout.trim();
        await $`mv ${tempTarFile} ${TarFile}`;
      });
    }

    return {
      installDir: (mode === 'tar') ? TarFile : root,
    }
  };
}

type WithInstallDir = { installDir: string; }

function InstallLibrary(): Step<WithDirs & WithInstallDir> {
  return async (ctx) => {
    await spinner(`Installing library to ${ctx.dirs.length} directories...`, async () => {
      await Promise.all(ctx.dirs.map(async (dir) => {
        await $`npm --prefix ${dir} rm @datastax/astra-db-ts`.nothrow();
        await $`npm --prefix ${dir} i ${ctx.installDir}`;
        readline.clearLine(process.stdout, 0);
        console.log(chalk.green('\r✔ ') + chalk.gray(`Installed library to ${dir}`));
      }));
    });
  };
}
