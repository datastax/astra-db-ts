# DEVGUIDE.md

## Contents
1. [Running the tests](#running-the-tests)
   1. [Prerequisites](#prerequisites)
   2. [I can't be bothered to read all of this](#i-cant-be-bothered-to-read-all-of-this)
   3. [The custom test script](#the-custom-test-script)
   4. [Test tags](#test-tags)
   5. [Running vectorize tests](#running-vectorize-tests)
   6. [Running the tests on local Stargate](#running-the-tests-on-local-stargate)
   7. [The custom Mocha wrapper](#the-custom-mocha-wrapper)
2. [Typechecking & Linting](#typechecking--linting)
3. [Building the library](#building-the-library)
4. [Publishing](#publishing)
5. [Miscellaneous](#miscellaneous)
    1. [nix-shell + direnv support](#nix-shell--direnv-support)

## Running the tests

### Prerequisites

- `npm`/`npx`
- A running Data API instance
- A `.env` with the credentials filled out

<sub>*DISCLAIMER: The test suite will create any necessary namespaces/collections, and any existing collections in
the database will be deleted.*</sub>

<sub>*Also, if you for some reason already have an existing namespace called 'slania', it too will be deleted. Not
sure why you'd have a namespace named that, but if you do, you have a good taste in music.*</sub>

### I can't be bothered to read all of this

1. Just make sure `CLIENT_DB_URL` and `CLIENT_DB_TOKEN` are set in your `.env` file
2. If you're running the full test suite, copy `vectorize_test_spec.example.json`, fill out the providers you want
   to test, and delete the rest
3. Run one of the following commands:

```sh
# Add '-e dse' or '-e hcd' to the command if running on either of those

# Runs the full test suite (~10m)
sh scripts/test.sh -all # -e dse|hcd

# Runs a version of the test suite that omits all longer-running tests (~2m)
sh scripts/test.sh -light # -e dse|hcd
```

### The custom test script

The `astra-db-ts` test suite uses a custom wrapper around [ts-mocha](https://www.npmjs.com/package/ts-mocha), including
its own custom test script.

While this undeniably adds in extra complexity and getting-started overhead, you can read the complete rationale as to 
why [here](https://github.com/datastax/astra-db-ts/pull/66#issue-2430902926), but TL;DR:
- We sped up the complete test suite by 500%
- We improved the test filtering capabilities
- We made it easier to write and work with `astra-db-ts`-esque tests

The API for the test script is as the following:

```sh
1. scripts/test.sh 
2.  [-all | -light | -coverage] 
3.  [-fand | -for] [-f/F <filter>]+ [-g/G <regex>]+ 
4.  [-w/W <vectorize_whitelist>] 
5.  [-b | -bail]
6.  [-R | -no-report]
7.  [-c <http_client>] 
8.  [-e <environment>]
9.  [-local]
10. [-l | -logging]
11. [-P | -skip-prelude]
```

#### 1. The test file (`scripts/test.sh`)

While you can use `npm run test` or `bun run test` if you so desire, attempting to use the test script's flags with it
may be a bit iffy, as the inputs are first "de-quoted" (evaluated) when you use the shell command, but they're 
"de-quoted" again when the package manager runs the actual shell command. 

Just use `scripts/test.sh` (or `sh scripts/test.sh`) directly if you're using command-line flags and want to
avoid a headache.

#### 2. The test types (`[-all | -light | -coverage]`)

There are three main test types:
- `-all`: This is a shorthand for running enabling the `(LONG)`, `(ADMIN)`, and `(VECTORIZE)` tests (alongside all the normal tests that always run)
- `-light`: This is a shorthand for disabling the aforementioned tests. This runs only the normal tests, which are much quicker to run in comparison
- `-coverage`: This runs all tests, but uses `nyc` to test for coverage statistics. Enabled the `-b` (bail) flag, as no point continuing if a test fails

By default, just running `scripts/test.sh` will be like using `-light`, but you can set the default config for which tests
to enable in your `.env` file, through the `CLIENT_RUN_*_TESTS` env vars.

#### 3. The test filters (`[-fand | -for] [-f/F <filter>]+ [-g/G <regex>]+`)

The `astra-db-ts` test suite implements fully custom test filtering, inspired by Mocha's, but improved upon.

You can add a basic filter using `-f <filter>` which acts like Mocha's own `-f` flag. Like Mocha, we also support `-g`,
which is like `-f`, but for regex. Each only needs to match a part of the test name (or its parent describes' names) to
succeed, so use `^$` as necessary.

Unlike Mocha, there is no `-i` flag—instead, you can invert a filter by using `-F <filter>` or `-G <regex>`, so that the
test needs to NOT match that string/regex to run.

You can also use multiple filters by simply using multiple of `-f`, `-g`, `-F`, and `-G` as you please. By default,
it'll only run a test if it satisfies all the filters (`-fand`), but you can use the `-for` flag to run a test if
it satisfies any one of the filters.

In case filters overlap, an inverted filter always wins over a regular filter, and the conflicted test won't run.

#### 4. The vectorize whitelist (`[-w/W <vectorize_whitelist>]`)

There's a special filtering system just for vectorize tests, called the "vectorize whitelist", of which there are two
different types: either a piece of regex, or a special filter operator.

##### Regex filtering

Every vectorize test is given a test name representing every branch it took to become that specific test. It is
of the following format:

```sh
# providerName@modelName@authType@dimension
# where dimension := 'specified' | 'default' | <some_number>
# where authType := 'header' | 'providerKey' | 'none'
```

Again, the regex only needs to match part of each test's name to succeed, so use `^$` as necessary.

##### Filter operators

The vectorize test suite also defines some custom "filter operators" to provide filtering that can't be done through
basic regex. They come of the format `-w $<operator>:<colon_separated_args>`

1. `$limit:<number>` - This is a limit over the total number of vectorize tests, only running up to the specified amount
2. `$provider-limit:<number>` - This limits the amount of vectorize tests that can be run per provider
3. `$model-limit:<number>` - Akin to the above, but limits per model.

The default whitelist is `$limit-per-model:1`.

#### 5. Bailing (`[-b | -bail]`)

Simply sets the bail flag, as it does in Mocha. Forces the test script to exit after a single test failure.

#### 6. Disabling error reporting (`[-R | -no-report]`)

By default, the test suite logs the complete error objects of any that may've been thrown during your tests to the
`./etc/test-reports` directory for greatest debuggability. However, this can be disabled for a test run using the
`-R`/`-no-report` flag.

#### 7. The HTTP client (`[-c <http_client>]`)

By default, `astra-db-ts` will run its tests on `fetch-h2` using `HTTP/2`, but you can specify a specific client, which
is one of `default:http1`, `default:http2`, or `fetch`.

#### 8. The Data API environment (`[-e <environment>]`)

By default, `astra-db-ts` assumes you're running on Astra, but you can specify the Data API environment through this
flag. It should be one of `dse`, `hcd`, `cassandra`, or `other`. You can also provide `astra`, but it wouldn't really
do anything. But I'm not the boss of you; you can make your own big-boy/girl/other decisions.

#### 9. Running the tests on Stargate (`[-local]`)

If you're running the tests on a local Stargate instance, you can use this flag to set the `CLIENT_DB_URL` to
`http://localhost:8080` and the `CLIENT_DB_TOKEN` to `cassandra:cassandra` without needing to modify your `.env` file.

#### 10. Logging (`[-l | -logging]`)

Logs all `[admin]CommandStarted` & `[admin]CommandFailed` events to the console. Useful for debugging.

#### 11. Skipping the prelude (`[-P | -skip-prelude]`)

By default, the test script will run a "prelude" script that sets up the database for the tests. This can be skipped
to save some time, using this flag, if the DB is already setup (enough), and you just want to run a test really quickly.

### Test tags

The `astra-db-ts` test suite uses the concept of "test tags" to further advance test filtering. These are tags in
the names of test blocks, such as `(LONG) createCollection tests` or `(ADMIN) (ASTRA) AstraAdmin tests`.

These tags are automatically parsed and filtered through the custom wrapper our test suite uses, though
you can still interact with them through test filters as well. For example, I commonly use `-f VECTORIZE` to
only run the vectorize tests.

Current tags include:
 - `VECTORIZE` - Enabled if `CLIENT_RUN_VECTORIZE_TESTS` is set (or `-all` is set)
 - `LONG` - Enabled if `CLIENT_RUN_LONG_TESTS` is set (or `-all` is set)
 - `ADMIN` - Enabled if `CLIENT_RUN_ADMIN_TESTS` is set (or `-all` is set)
 - `DEV` - Automatically enabled if running on Astra-dev
 - `NOT-DEV` - Automatically enabled if not running on Astra-dev
 - `ASTRA` - Automatically enabled if running on Astra

Attempting to set any other test tag will throw an error. (All test tags must contain only uppercase letters & 
hyphens—any tag not matching `\([A-Za]+?\)` will not be counted.)

### Running vectorize tests

To run vectorize tests, you need to have a vectorize-enabled kube running, with the correct tags enabled.

Ensure `CLIENT_RUN_VECTORIZE_TESTS` and `CLIENT_RUN_LONG_TESTS` are enabled as well (or just pass the `-all` flag to
the test script).

Lastly, you must create a file, `vectorize_tests.json`, in the root folder, with the following format:

```ts
type VectorizeTestSpec = {
  [providerName: string]: {
    headers?: {
      [header: `x-${string}`]: string,
    },
    sharedSecret?: {
      providerKey?: string,
    },
    dimension?: {
      [modelNameRegex: string]: number,
    },
    parameters?: {
      [modelNameRegex: string]: Record<string, string>,
    },
    warmupErr?: string,
  },
}
```

where:
- `providerName` is the name of the provider (e.g. `nvidia`, `openai`, etc.) as found in `findEmbeddingProviders`.
- `headers` sets the embedding headers to be used for header auth.
   - resolves to an `EmbeddingHeadersProvider` under the hood—throws error if no corresponding one found.
   - optional if no header auth test wanted.
- `sharedSecret` is the block for KMS auth (isomorphic to `providerKey`, but it's an object for future-compatability).
   - `providerKey` is the provider key for the provider (which will be passed in @ collection creation).
   - optional if no KMS auth test wanted.
- `parameters` is a mapping of model names to their corresponding parameters. The model name can be some regex that partially matches the full model name.
   - `"text-embedding-3-small"`, `"3-small"`, and `".*"` will all match `"text-embedding-3-small"`.
   - optional if not required. `azureOpenAI`, for example, will need this.
- `dimension` is also a mapping of model name regex to their corresponding dimensions, like the `parameters` field.
   - optional if not required. `huggingfaceDedicated`, for example, will need this.
- `warmupErr` may be set if the provider errors on a cold start
   - if set, the provider will be called in a `while (true)` loop until it stops throwing an error matching this message

This file is .gitignore-d by default and will not be checked into VCS.

See `vectorize_test_spec.example.json` for, guess what, an example.

This spec is cross-referenced with `findEmbeddingProviders` to create a suite of tests branching off each possible
parameter, with tests names of the format `providerName@modelName@authType@dimension`, where each section is another
potential branch.

To run *only* the vectorize tests, a common pattern I use is `scripts/test.sh -all -f VECTORIZE [-w <vectorize_whitelist>]`.

### Running the tests on local Stargate
In another terminal tab, you can do `sh scripts/start-stargate-4-tests.sh` to spin up an ephemeral Data API on DSE
instance which will destroy itself on script exit. The test suite will set up any keyspaces/collections as necessary.

Then, be sure to set the following vars in `.env` exactly.
```dotenv
CLIENT_DB_URL=http://localhost:8181
CLIENT_DB_TOKEN=Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh
CLIENT_DB_ENVIRONMENT=dse
```

Once the local Data API instance is fully started and ready for requests, you can run the tests.

### The custom Mocha wrapper

The `astra-db-ts` test suite is massively IO-bound, and desires a more advanced test filtering system than
Mocha provides by default. As such, we have written a (relatively) light custom wrapper around Mocha, extending
it to allow us to squeeze all possible performance out of our tests, and make it easier to write, scale, and work
with tests in both the present, and the future.

#### The custom test functions

The most prominent changes are the introduction of 5 new Mocha-API-esque functions (two of which are overhauls)
- [`describe`](https://github.com/datastax/astra-db-ts/blob/60fa445192b6a648b7a139a45986af8525a37ffb/tests/testlib/describe.ts) - An overhaul to the existing `dynamic` block
   - Provides fresh instances of the "common fixtures" in its callback
   - Performs "tag filtering" on the suite names
   - Some suite options to reduce boilerplate
      - `truncateColls: 'default'` - Does `deleteMany({})` on the default collection in the default namespace after each test case
      - `truncateColls: 'both'` - Does `deleteMany({})` on the default collection in both test namespaces after each test case
      - `drop: 'after'` - Drops all non-default collections in both test namespaces after all the test cases in the suite
      - `drop: 'afterEach'` - Drops all non-default collections in both test namespaces each test case
- [`it`](https://github.com/datastax/astra-db-ts/blob/60fa445192b6a648b7a139a45986af8525a37ffb/tests/testlib/it.ts) - An overhaul to the existing `it` block
   - Performs "tag filtering" on the test names
   - Provides unique string keys for every test case
- [`parallel`](https://github.com/datastax/astra-db-ts/blob/60fa445192b6a648b7a139a45986af8525a37ffb/tests/testlib/parallel.ts) - A wrapper around `describe` which runs all of its test cases in parallel
   - Only allows `it`, `before`, `after`, and a single layer of `describe` functions
   - Will run all tests simultaneously in a `before` hook, capture any exceptions, and rethrow them in reconstructed `it`/`describe` blocks for the most native-like behavior
   - Performs tag and test filtering as normal
   - Nearly all integration tests have been made parallel
- [`background`](https://github.com/datastax/astra-db-ts/blob/60fa445192b6a648b7a139a45986af8525a37ffb/tests/testlib/background.ts) - A version of `describe` which runs in the background while all the other test cases run
   - Only allows `it` blocks
   - Will run the test at the very start of the test script, capture any exceptions, and rethrow them in reconstructed `it`/`describe` blocks for the most native-like behavior at the end of the test script
   - Performs tag and test filtering as normal
   - Meant for independent tests that take a very long time to execute (such as the `integration.devops.db-admin` lifecycle test)

These are not globals like Mocha's—rather, they are imported, like so:
```ts
import { background, describe, it, parallel } from '@/tests/testlib';
```

#### Examples

You can find examples of usages of each in most, if not all, test files, such as:
- [`/tests/integration/miscs/timeouts.test.ts`](https://github.com/datastax/astra-db-ts/blob/60fa445192b6a648b7a139a45986af8525a37ffb/tests/integration/misc/timeouts.test.ts) (`describe`, `parallel`, `it`)
- [`/tests/integration/devops/lifecycle.test.ts`](https://github.com/datastax/astra-db-ts/blob/60fa445192b6a648b7a139a45986af8525a37ffb/tests/integration/devops/lifecycle.test.ts) (`background`)

## Typechecking & Linting

The test script also provides typechecking and linting through the following commands:

```sh
# Full typechecking
scripts/test.sh -tc

# Linting
scripts/test.sh -lint

# Or even both
scripts/test.sh -lint -tc
```

## Building the library

At the moment, you need to be using a unix-like system to build the library, as it uses a small shell script,
which can be found in `scripts/build.sh`, and run manually enough on Windows if necessary.

To build it, just run `npm run build`, which does the following:
- Deletes the `dist` directory
- Updates the versioning file (`src/version.ts`)
- Runs `tsc` to compile the TypeScript files & resolves path aliases w/ `tsc-alias`
- Uses `api-extractor` to generate the API report & generate a rolled-up `.d.ts` file
- Runs over the code and trims any extra comments/files to reduce code size
- Deletes any extraneous `.d.ts` files

## Publishing

I heavily recommend using [np](https://github.com/sindresorhus/np) to publish the package. 

Unfortunately, because certain tests in the `astra-db-ts` test suite can fail for reasons outside your control,
such as the `huggingface` embedding provider failing, I **heavily** recommend running the full test suite manually
using the following command: `scripts/test.sh -all -w '.*'`, and, if the tests are all passing to your best judgement,
continue on to publish the package using `np --no-tests`.

The versioning step will automatically update the api report + update the version in `src/version.ts`, so you don't
need to worry about that.

## Miscellaneous

### nix-shell + direnv support

This is in no way required, but just for convenience purposes, a `.envrc` file is present that will
 - If you have nix, use the `shell.nix` to drop you into a nix-shell w/ `nodejs_20` & `jq`
 - Ephemerally add the `scripts/` dir to `PATH`
 - Ephemerally source `.env` into your shell

In case you have `direnv` installed, but don't want to use this, you can of course simply do `direnv block` and never
worry about any of this ever again.
