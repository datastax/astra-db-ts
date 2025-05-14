#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Step, Steps } from './utils/steps.js';
import { Args } from './utils/arg-parse.js';

$.nothrow = true;

const opts = new Args('premerge.ts')
  .string('BuildArgs', {
    flags: ['-build-args'],
    default: '-r',
  })
  .string('TestArgs', {
    flags: ['-test-args'],
    default: '-b',
  })
  .string('CheckArgs', {
    flags: ['-check-args'],
    default: '',
  })
  .string('ExampleDepsArgs', {
    flags: ['-example-deps-args'],
    default: '-tar',
  })
  .parse();

await new Steps()
  .do(BuildProject())
  .do(CheckProject())
  .do(RunTests())
  .do(SetExampleDeps())
  .run();

function BuildProject(): Step {
  return async () => {
    console.log(chalk.bold.green('Building the project...'));
    const { exitCode } = await $({ stdio: 'inherit' })`npx tsx scripts/build.ts ${opts.BuildArgs.split(' ').filter(Boolean)}`;

    if (!exitCode) {
      console.log(chalk.bold.green('Project built successfully!'));
    } else {
      console.error(chalk.bold.red('Project build failed!'));
      process.exit(exitCode);
    }
  };
}

function CheckProject(): Step {
  return async () => {
    console.log(chalk.bold.green('Checking the project...'));
    const { exitCode } = await $({ stdio: 'inherit' })`npx tsx scripts/check.ts ${opts.CheckArgs.split(' ').filter(Boolean)}`;

    if (!exitCode) {
      console.log(chalk.bold.green('Project checked successfully!'));
    } else {
      console.error(chalk.bold.red('Project checks failed!'));
      process.exit(exitCode);
    }
  };
}

function RunTests(): Step {
  return async () => {
    console.log(chalk.bold.green('Running tests...'));
    const { exitCode } = await $({ stdio: 'inherit' })`npx tsx scripts/test.ts ${opts.TestArgs.split(' ').filter(Boolean)}`;

    if (!exitCode) {
      console.log(chalk.bold.green('Tests passed!'));
    } else {
      console.error(chalk.bold.red('Tests failed!'));
      process.exit(exitCode);
    }
  };
}

function SetExampleDeps(): Step {
  return async () => {
    console.log(chalk.bold.green('Setting example deps to latest npm version...'));
    const { exitCode } = await $({ stdio: 'inherit' })`npx tsx scripts/set-example-client-deps.ts ${opts.ExampleDepsArgs.split(' ').filter(Boolean)}`;

    if (!exitCode) {
      console.log(chalk.bold.green('Example deps set to latest npm version!'));
    } else {
      console.error(chalk.bold.red('Failed to set example deps!'));
      process.exit(exitCode);
    }
  };
}
