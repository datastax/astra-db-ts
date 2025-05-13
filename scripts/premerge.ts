#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Opts } from './utils/arg-parse.js';
import { Step, Steps } from './utils/steps.js';

const opts = new Opts('premerge.ts')
  .real({
    BuildArgs: [['-build-args'], 'string', '-r'],
    TestArgs: [['-test-args'], 'string', '-b'],
    CheckArgs: [['-check-args'], 'string', ''],
    ExampleDepsArgs: [['-example-deps-args'], 'string', '-tar'],
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
    try {
      console.log(chalk.bold.green('Building the project...'));
      await $({ stdio: 'inherit' })`npx tsx scripts/build.ts ${opts.BuildArgs.split(' ').filter(Boolean)}`;
      console.log(chalk.bold.green('Project built successfully!'));
    } catch (error) {
      console.error(chalk.bold.red('Project build failed!'));
      process.exit(1);
    }
  };
}

function CheckProject(): Step {
  return async () => {
    try {
      console.log(chalk.bold.green('Checking the project...'));
      await $({ stdio: 'inherit' })`npx tsx scripts/check.ts ${opts.CheckArgs.split(' ').filter(Boolean)}`;
      console.log(chalk.bold.green('Project checked successfully!'));
    } catch (error) {
      console.error(chalk.bold.red('Project checks failed!'));
      process.exit(1);
    }
  };
}

function RunTests(): Step {
  return async () => {
    try {
      console.log(chalk.bold.green('Running tests...'));
      await $({ stdio: 'inherit' })`npx tsx scripts/test.ts ${opts.TestArgs.split(' ').filter(Boolean)}`;
      console.log(chalk.bold.green('Tests passed!'));
    } catch (error) {
      console.error(chalk.bold.red('Tests failed!'));
      process.exit(1);
    }
  };
}

function SetExampleDeps(): Step {
  return async () => {
    try {
      console.log(chalk.bold.green('Setting example deps to latest npm version...'));
      await $({ stdio: 'inherit' })`npx tsx scripts/set-example-client-deps.ts ${opts.ExampleDepsArgs.split(' ').filter(Boolean)}`;
      console.log(chalk.bold.green('Example deps set to latest npm version!'));
    } catch (error) {
      console.error(chalk.bold.red('Failed to set example deps!'));
      process.exit(1);
    }
  };
}
