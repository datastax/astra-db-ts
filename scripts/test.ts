#!/usr/bin/env -S npx tsx
// noinspection ES6PreferShortImport

import 'zx/globals';
import { Steps } from './utils/steps.js';
import { RawTestCfg } from '../tests/testlib/index.js';
import { Args } from './utils/arg-parse.js';

dotenv.config();

const testCmd = 'mocha --import=tsx/esm -r tsconfig-paths --recursive tests/prelude.test.ts tests/unit tests/integration tests/postlude.test.ts --extension .test.ts -t 0 --reporter tests/errors-reporter.cjs --exit ';

const opts = new Args('test.ts')
  .stringEnum('TestType', {
    choices: {
      'all': ['-all'],
      'light': ['-light'],
      'coverage': ['-coverage'],
    },
    default: 'all',
  })
  .stringEnum('FilterCombinator', {
    choices: {
      'and': ['-fand'],
      'or': ['-for'],
    },
    default: 'and',
  })
  .stringArray('FilterExact', {
    flags: ['-f'],
  })
  .stringArray('FilterNotExact', {
    flags: ['-F'],
  })
  .stringArray('FilterMatch', {
    flags: ['-g'],
  })
  .stringArray('FilterNotMatch', {
    flags: ['-G'],
  })
  .string('VectorizeWhitelist', {
    flags: ['-w'],
    default: undefined,
  })
  .boolean('InvertVectorizeWhitelist', {
    flags: ['-W'],
  })
  .boolean('Bail', {
    flags: ['-b', '-bail'],
  })
  .boolean('NoReport', {
    flags: ['-R', '-no-report'],
  })
  .string('HttpClient', {
    flags: ['-c'],
    default: undefined,
  })
  .string('Environment', {
    flags: ['-e'],
    default: process.env.CLIENT_DB_ENVIRONMENT,
  })
  .boolean('SkipPrelude', {
    flags: ['-P', '-skip-prelude'],
  })
  .boolean('Watch', {
    flags: ['-watch'],
  })
  .number('TestTimeout', {
    flags: ['-test-timeout', '-t'],
    default: undefined,
  })
  .string('LoggingPredicate', {
    flags: ['-L', '-logging-pred'],
    default: 'false',
  })
  .fake({
    flags: ['-l', '-logging'],
    type: 'boolean',
    use: (v: boolean, opts) => {
      if (v) {
        opts.LoggingPredicate = '!isGlobal';
      } else {
        opts.LoggingPredicate = 'false';
      }
    },
  })
  .fake({
    flags: ['-local'],
    type: 'boolean',
    use: (v: boolean, opts) => {
      if (v) {
        opts.Environment = 'dse';
        process.env.CLIENT_DB_TOKEN = 'Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh';
        process.env.CLIENT_DB_URL = 'http://127.0.0.1:8181';
      }
    }
  })
  .fake({
    flags: ['-u'],
    type: 'boolean',
    use: (v: boolean, opts) => {
      if (v) {
        opts.TestType = 'light';
        opts.FilterExact.push('unit.');
      }
    }
  })
  .parse()

// Required for tests
process.env.CLIENT_DYNAMIC_JS_ENV_CHECK = '1'

const {exitCode} = await new Steps()
  .do(PrepareTest())
  .do(RunTests())
  .run();

process.exit(exitCode);

function PrepareTest() {
  return async () => {
    const config: RawTestCfg = {
      DbEnvironment: opts.Environment,
      HttpClient: opts.HttpClient,
      TestTimeout: opts.TestTimeout,
      LoggingPredicate: opts.LoggingPredicate,
      SkipPrelude: opts.SkipPrelude,
      Filter: _buildFilters(),
      VectorizeWhitelist: _buildWhitelist(),
      RunTests: _buildRunTests(),
    }

    if (opts.Watch && !config.Filter?.Parts?.length) {
      console.error('A filter must be used with watch mode to prevent accidentally running all tests. \'-f unit.\' at the very least is highly recommended.');
      process.exit(1);
    }

    process.env.CLIENT_TEST_CONFIG = JSON.stringify(config);
    process.env.CLIENT_NO_ERROR_REPORTER = opts.NoReport ? '1' : '';
  }

  function _buildFilters(): RawTestCfg['Filter'] {
    return {
      Parts: [
        ...opts.FilterExact.map((f) => `fn:${f}` as const),
        ...opts.FilterNotExact.map((f) => `fi:${f}` as const),
        ...opts.FilterMatch.map((f) => `gn:${f}` as const),
        ...opts.FilterNotMatch.map((f) => `gi:${f}` as const),
      ],
      Combinator: opts.FilterCombinator,
    }
  }

  function _buildWhitelist(): RawTestCfg['VectorizeWhitelist'] {
    return {
      Whitelist: opts.VectorizeWhitelist,
      Inverted: opts.InvertVectorizeWhitelist,
    }
  }

  function _buildRunTests(): RawTestCfg['RunTests'] {
    return {
      Vectorize: opts.TestType === 'all' || opts.TestType === 'coverage',
      LongRunning: opts.TestType === 'all' || opts.TestType === 'coverage',
      Admin: opts.TestType === 'all' || opts.TestType === 'coverage',
    }
  }
}

function RunTests() {
  return async () => ({
    exitCode: await $({ stdio: 'inherit' })`${_buildCommand()}`.nothrow().exitCode,
  });

  function _buildCommand(): string[] {
    const commandParts = ['npx'];

    if (opts.TestType === 'coverage') {
      commandParts.push('c8', '-o', 'coverage');
    }

    commandParts.push(...testCmd.trim().split(' '));

    if (opts.Bail || opts.TestType === 'coverage') {
      commandParts.push('-b');
    }

    if (opts.Watch) {
      commandParts.push('--watch', '--watch-files', 'tests/**/*.test.ts');
    }

    return commandParts;
  }
}
