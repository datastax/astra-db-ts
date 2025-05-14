#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Args } from './utils/arg-parse.js';
import path from 'path';
import { chalk, globby, spinner } from 'zx';
import { root } from './utils/constants.js';
import { Steps } from './utils/steps.js';
import * as readline from 'node:readline';

$.nothrow = true;

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

const { exitCode } = await new Steps()
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

process.exit(exitCode);

function Cleanup() {
  return async () => {
    await $`rm -f ${TarFile}`.nothrow();
  };
}

type WithDirs = { dirs: string[]; }

function ValidateDirectories() {
  return async (): Promise<WithDirs> => {
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

function LogFoundDirectories() {
  return async (ctx: WithDirs) => {
    console.log(chalk.green(`Found ${ctx.dirs.length} directories to install the library into:`));

    for (const dir of ctx.dirs) {
      console.log(chalk.green('- ' + dir));
    }

    console.log();
  };
}

function BuildLibrary() {
  return async () => {
    if (await $`npx tsx scripts/build.ts`.quiet().exitCode) {
      console.error(chalk.red('Failed to build the library'));
      process.exit(1);
    }
  };
}

type WithInstallDir = { installDir: string; }

function SetupForInstallation(mode: 'tar' | 'sym') {
  return async (): Promise<WithInstallDir> => {
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

function InstallLibrary() {
  return async (ctx: WithDirs & WithInstallDir) => {
    let exitCode = 0;

    await spinner(`Installing library to ${ctx.dirs.length} directories...`, async () => {
      await Promise.all(ctx.dirs.map(async (dir) => {
        if (await $`npm --prefix ${dir} rm @datastax/astra-db-ts`.exitCode) {
          readline.clearLine(process.stdout, 0);
          console.error(chalk.red('Failed to remove existing library from', dir));
          exitCode = 1;
        }

        if (await $`npm --prefix ${dir} i ${ctx.installDir}`.exitCode) {
          readline.clearLine(process.stdout, 0);
          console.error(chalk.red('Failed to install library to', dir));
          exitCode = 2;
        }

        readline.clearLine(process.stdout, 0);
        console.log(chalk.green('\r✔ ') + chalk.gray(`Installed library to ${dir}`));
      }));
    });

    return { exitCode };
  };
}
