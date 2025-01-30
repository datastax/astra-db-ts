# `test.sh` (The custom test script)

The `astra-db-ts` test suite uses a custom wrapper around [ts-mocha](https://www.npmjs.com/package/ts-mocha), including its own custom test script.

While this undeniably adds in extra complexity and getting-started overhead:
- We sped up the complete test suite by 500+%
- We majority improved the test filtering capabilities
- We made it vastly easier to write and work with `astra-db-ts`-esque tests

You can read more about the custom wrapper and why it exists [here](https://github.com/datastax/astra-db-ts/pull/66#issue-2430902926).

## Contents

1. [Prerequisites](#prerequisites)
2. [Just give me a TL;DR please](#just-give-me-a-tldr-please)
3. [Test script usage](#test-script-usage)
   1. [The test file (`scripts/test.sh`)](#1-the-test-file-scriptstestsh)
   2. [The test types (`[-all | -light | -coverage]`)](#2-the-test-types--all---light---coverage)
   3. [The test filters (`[-fand | -for] [-f/F <match>]+ [-g/G <regex>]+ [-u]`)](#3-the-test-filters--fand---for--ff-match--gg-regex--u)
   4. [The vectorize whitelist (`[-w/W <vectorize_whitelist>]`)](#4-the-vectorize-whitelist--ww-vectorize_whitelist)
   5. [Bailing (`[-b | -bail]`)](#5-bailing--b---bail)
   6. [Disabling error reporting (`[-R | -no-report]`)](#6-disabling-error-reporting--r---no-report)
   7. [The HTTP client (`[-c <http_client>]`)](#7-the-http-client--c-http_client)
   8. [The Data API environment (`[-e <environment>]`)](#8-the-data-api-environment--e-environment)
   9. [Running the tests on Stargate (`[-local]`)](#9-running-the-tests-on-stargate--local)
   10. [Enable verbose logging for tests (`[(-l | -logging) | (-L | -logging-with-pred <predicate>)]`)](#10-enable-verbose-logging-for-tests--l---logging---l---logging-with-pred-predicate)
   11. [Skipping the prelude (`[-P | -skip-prelude]`)](#11-skipping-the-prelude--p---skip-prelude)
   12. [Watching (`[-watch]`)](#12-watching--watch)
4. [Misc important stuff](#misc-important-stuff)
   1. [Running vectorize tests](#running-vectorize-tests)
   2. [Test tags (only important if writing tests)](#test-tags-only-important-if-writing-tests)
   3. [The custom Mocha wrapper (only important if writing tests)](#the-custom-mocha-wrapper-only-important-if-writing-tests)
      1. [The custom test functions](#the-custom-test-functions)
      2. [Examples](#examples) 
5. [Examples](#examples-1)
   1. [Simply running all tests](#simply-running-all-tests)
   2. [Running all non-long-running tests](#running-all-non-long-running-tests)
   3. [Running all tests, but with coverage](#running-all-tests-but-with-coverage)
   4. [Running only unit tests](#running-only-unit-tests)
   5. [Running a specific test file](#running-a-specific-test-file)
   6. [Running some tests without the lengthy setup step](#running-some-tests-without-the-lengthy-setup-step)
   7. [Running tests on local stargate](#running-tests-on-local-stargate)
   8. [Running tests without a specific test tag](#running-tests-without-a-specific-test-tag)
   9. [Running tests with logging](#running-tests-with-logging)
   10. [Running all unit tests on save](#running-all-unit-tests-on-save)
6. [See also](#see-also)

## Prerequisites

- `npm`/`npx`
- A running Data API instance
- A `.env` with the credentials filled out (unless using `-local`)

<sub>*DISCLAIMER: The test suite will create any necessary namespaces/collections, and any existing collections in
the database will be deleted.*</sub>

<sub>*Also, if you for some reason already have an existing namespace called 'slania', it too will be deleted. Not
sure why you'd have a namespace named that, but if you do, you have a good taste in music.*</sub>

## Just give me a TL;DR please

1. Just read the [prerequisites](#prerequisites) above and ensure those are all fulfilled
2. If you're running the full test suite, copy `vectorize_test_spec.example.json`, fill out the providers you want
   to test, and delete the rest
3. Run one of the following commands:

```sh
# Runs the full test suite (~10m + setup time)
sh scripts/test.sh

# Runs a version of the test suite that omits all longer-running tests (~4m + setup time)
sh scripts/test.sh -light
```

## Test script usage

The API for the test script is as follows:

```fortran
1. scripts/test.sh 
2.  [-all | -light | -coverage] 
3.  [-fand | -for] [-f/F <match>]+ [-g/G <regex>]+ [-u]
4.  [-w/W <vectorize_whitelist>]
5.  [-b | -bail]
6.  [-R | -no-report]
7.  [-c <http_client>]
8.  [-e <environment>]
9.  [-local]
10. [(-l | -logging) | (-L | -logging-with-pred <predicate>)]]
11. [-P | -skip-prelude]
12. [-watch]
```

The test script will return a non-zero exit code if any of the tests fail, and will print out the results of each test as it runs.

### 1. The test file (`scripts/test.sh`)

While you can use `npm run test` or `bun run test` if you so desire, attempting to use the test script's flags with it
may be a bit iffy, as the inputs are first "de-quoted" (evaluated) when you use the shell command, but they're
"de-quoted" again when the package manager runs the actual shell command.

Just use `scripts/test.sh` (or `sh scripts/test.sh`) directly if you're using command-line flags and want to
avoid a headache.

### 2. The test types (`[-all | -light | -coverage]`)

There are three main test types:
- `-all`: This is a shorthand for running enabling the `(LONG)`, `(ADMIN)`, and `(VECTORIZE)` tests (alongside all the normal tests that always run)
- `-light`: This is a shorthand for disabling the aforementioned tests. This runs only the normal tests, which are much quicker to run in comparison
- `-coverage`: This runs all tests, but uses `nyc` to test for coverage statistics. Enables the `-b` (bail) flag, as no point continuing if a test fails

By default, just running `scripts/test.sh` will be like using `-light`, but you can set the default config for which tests
to enable in your `.env` file, through the `CLIENT_RUN_*_TESTS` env vars.

### 3. The test filters (`[-fand | -for] [-f/F <match>]+ [-g/G <regex>]+ [-u]`)

The `astra-db-ts` test suite implements fully custom test filtering, inspired by Mocha's, but improved upon.
- `-f` and `-g` are _not_ mutually exclusive, and multiple of each may be used
- You can invert filters on an individual basis, instead of needing to invert either all filters or none
- Dynamically generated test filtering is properly handled
- Ability to choose if filters are ANDed or ORed together

There are two different mocha-like filters you can use:
- `-f <match>`: This is a basic filter that acts like Mocha's own `-f` flag. It only needs to match a part of the test name (or its parents' names) to succeed
- `-g <regex>`: This is like `-f`, but for regex. Each only needs to match a part of the test name (or its parents' names) to succeed, so use `^$` as necessary

Unlike Mocha, there is no `-i` flag—instead, you can invert filters on a case-by-case basis by using `-F <match>` 
or `-G <regex>`, so that the test (& its parent describes) need to NOT match that string/regex to run.

You can also use multiple filters by simply using multiple of `-f`, `-g`, `-F`, and `-G` as you please. By default,
it'll only run a test if it satisfies all the filters (`-fand`), but you can use the `-for` flag to run a test if
it satisfies any one of the filters.

In case filters overlap, an inverted filter always wins over a regular filter, and the conflicted test won't run.

Furthermore, there exists a naming convention for the root-level `describe`/`parallel` blocks' names to be equivalent to the test file's directory + name, relative to `./tests`. For example:

```ts
// ./tests/unnit/documents/tables/ser-des/key-transformer.test.ts

describe("unit.documents.tables.ser-des.key-transformer", () => {
  // tests here!
});
```

`-u` exits as a shorthand for `-f unit.` for running all unit tests to save you a precious few keystrokes (it also implicitly appends the `-light` flag to exclude a couple of long-running unit tests).
s
### 4. The vectorize whitelist (`[-w/W <vectorize_whitelist>]`)

There's a special filtering system just for vectorize tests, called the "vectorize whitelist", of which there are two
different types: either a piece of regex, or a special filter operator.

#### Regex filtering

Every vectorize test is given a test name representing every branch it took to become that specific test. It is
of the following format:

```sh
# providerName@modelName@authType@dimension
# where dimension := 'specified' | 'default' | <some_number>
# where authType := 'header' | 'providerKey' | 'none'
```

Again, the regex only needs to match part of each test's name to succeed, so use `^$` as necessary.

#### Filter operators

The vectorize test suite also defines some custom "filter operators" to provide filtering that can't be done through
basic regex. They come of the format `-w $<operator>:<args[,]>+`

1. `$limit:<number>` - This is a limit over the total number of vectorize tests, only running up to the specified amount
2. `$provider-limit:<number>` - This limits the amount of vectorize tests that can be run per provider
3. `$model-limit:<number>` - Akin to the above, but limits per model.

**The default whitelist is `$model-limit:1`.**

### 5. Bailing (`[-b | -bail]`)

Simply sets the bail flag, as it does in Mocha. Forces the test script to exit after a single test failure.

### 6. Disabling error reporting (`[-R | -no-report]`)

By default, the test suite logs the complete error objects of any that may've been thrown during your tests to the
`./etc/test-reports` directory for greatest debuggability. 

However, this can be disabled for a test run using the `-R`/`-no-report` flag.

### 7. The HTTP client (`[-c <http_client>]`)

By default, `astra-db-ts` will run its tests on `fetch-h2` using `HTTP/2`, but you can specify a specific client, which
is one of `default:http1`, `default:http2`, or `fetch`.

### 8. The Data API environment (`[-e <environment>]`)

By default, `astra-db-ts` assumes you're running on Astra, but you can specify the Data API environment through this
flag, which should be one of `dse`, `hcd`, `cassandra`, or `other`.

You can also provide `astra`, but it wouldn't really do anything. But I'm not the boss of you; you can make your own big-boy/girl/other decisions.

Not necessary if `-local` is set (it'll automatically set the environment to `dse`).

### 9. Running the tests on Stargate (`[-local]`)

If you're running the tests on a local Stargate instance, you can use this flag to set the `CLIENT_DB_URL` to
`http://localhost:8080` and the `CLIENT_DB_TOKEN` to `cassandra:cassandra` without needing to modify your `.env` file.

It'll also automatically set the environment to `dse`.

Note that you'll still need to run stargate yourself. See [startgate.sh.md](./startgate.sh.md) for more info.

### 10. Enable verbose logging for tests (`[(-l | -logging) | (-L | -logging-with-pred <predicate>)]`)

Allows you to log `[admin]CommandStarted` & `[admin]CommandFailed` events to the console. Useful for debugging.

There are two different ways to enable logging:

#### -l | -logging

This is the quick & easy way to enable logging. It's simply equal to `-L !isGlobal`, which means it'll log all events
that are not produced by setup/teardown commands (such as `prelude.test.ts`, `before/after` hooks, etc.).

#### -L | -logging-with-pred <predicate>

This is the more advanced way to enable logging. It allows you to specify a custom predicate to filter out the events
you want to log. 

The predicate is an expression with two implicit parameters:
- `e`: The event object
  - This will be one of `CommandStartedEvent`, `CommandFailedEvent`, `AdminCommandStartedEvent`, or `AdminCommandFailedEvent`
- `isGlobal`: A boolean that is `true` if the event is "global"
  - A "global" event is one that is not produced by a test, but rather a setup/teardown command, such as `prelude.test.ts`, `before/after` hooks, etc.

Internally, it's represented as such: `new Function("e", "isGlobal", "return " + process.env.LOGGING_PRED)`

Here are some examples of potentially common logging predicates:
- `-L '!isGlobal && e.commandName === "find"'`: Logs all `find` commands that are produced by tests
- `-L true`: Logs all events, regardless of if they're global or not

### 11. Skipping the prelude (`[-P | -skip-prelude]`)

By default, the test script will run a "prelude" script that sets up the database for the tests. This can be skipped
to save some time, using this flag, if the DB is already setup (enough), and you just want to run some tests really quickly.

**Note:** the `astra-db-ts` test suite will automatically skip the prelude if it detects that only unit tests are being run,
which shouldn't require any database setup in the first place.

## 12. Watching (`[-watch]`)

This flag is used to enable the watch mode for the test script. This will rerun the tests whenever a src or test file changes.

**It is mandatory for a filter to be present when using this flag to avoid accidentally running all tests.**

This also force-enables the `-light` flag for extra insurance.

I don't actually know what happens if you use this flag with integration tests, but I most likely wouldn't recommend it.

*You should most likely use this in conjunction with `-f unit.` to only run unit tests on save.*

## Misc important stuff

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

To run *only* the vectorize tests, a common pattern I use is `scripts/test.sh -f VECTORIZE [-w <vectorize_whitelist>]`.

### Test tags (only important if writing tests)

**Note: this section is not relevant to you if you aren't writing your own tests.**

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

### The custom Mocha wrapper (only important if writing tests)

**Note: this section is not relevant to you if you aren't writing your own tests.**

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
- [`./tests/unit/lib/api/timeouts.test.ts`](../../tests/unit/lib/api/timeouts.test.ts) (`describe`, `parallel`, `it`)
- [`./tests/integration/documents/tables/insert-one.test.ts`](../../tests/integration/documents/tables/insert-one.test.ts) (`parallel`, `it`)
- [`./tests/integration/administration/lifecycle.test.ts`](../../tests/integration/administration/lifecycle.test.ts) (`background`, `it`)

## Examples

This is by no means an exhaustive list of all the ways you can use the test script, but these are some ways I commonly use it.

Often, I'll combine these (and more), and end up with a long, useful test command which I could never do with Mocha alone, such as:

```sh
scripts/test.sh -R -f integration. -f object-mapping -f explicit -P -L '!isGlobal && e.commandName === "findOne"' -local
```

### Simply running all tests

Normally takes ~10m + the time it takes to run `prelude.test.ts` if you don't use `-P` (`-skip-prelude`).

If you don't run the `AstraAdmin` lifecycle test (`-F integration.administration.lifecycle`), it'll take ~6m instead (+ prelude time ofc).

```sh
scripts/test.sh
```

### Running all non-long-running tests

Runs in ~4m + prelude time.

```sh
scripts/test.sh -light
```

### Running all tests, but with coverage

Uses NYC to test for coverage statistics. Enables the `-b` (bail) flag, since there's really no point continuing if a test fails.

Also takes ~10m + prelude time.

```sh
scripts/test.sh -coverage
```

### Running only unit tests

Equivalent to running `scripts/test.sh -f unit. -light`.

Takes advantage of the naming convention of root-level `describe`/`parallel` blocks' names to be equivalent to the test file's directory + name, relative to `./tests` (e.g. `unit.documents.tables.ser-des.key-transformer`).

Because the `-light` option is implicitly appended, the unit tests will run in just a manner of milliseconds (otherwise, there are a couple of longer-running unit tests that take 10s to complete).

```sh
scripts/test.sh -u
```

### Running a specific test file

I use this very frequently.

Takes advantage of the naming convention of root-level `describe`/`parallel` blocks' names to be equivalent to the test file's directory + name, relative to `./tests` (e.g. `unit.documents.tables.ser-des.key-transformer`).

```sh
scripts/test.sh -f integration.documents.tables.ser-des.key-transformer
```

### Running some tests without the lengthy setup step

If I'm running some integration tests, I'll very commonly pair this with the `-P` flag to skip the prelude to save a lot of time there, and have the test run in (often) just seconds.

Note that if you're running only unit tests, the prelude will automatically be skipped for you.

Also, you'll probably have a bad time if the DB isn't already set up properly.

```sh
scripts/test.sh -f integration.documents.tables.ser-des.key-transformer -P
```

### Running tests on local stargate

Sets the `CLIENT_DB_URL` to `http://localhost:8080` and the `CLIENT_DB_TOKEN` to `cassandra:cassandra` without needing to modify your `.env` file.

Also sets the environment to `dse` implicitly.

```sh
# Secondary terminal window to spin up a local stargate data api instance
scripts/startgate.sh

# Main terminal window after waiting for stargate to start-gate (heh)
scripts/test.sh -local
```

### Running tests without a specific test tag

Don't use this as often, but it's nice for when I need it.

```sh
scripts/test.sh -F VECTORIZE
```

### Running tests with logging

Now this, this is I use _all the time_. It's so useful for debugging requests, and understanding exactly what the Data API is seeing and doing.

```sh
# Most of the time
scripts/test.sh -l

# Though sometimes I want something more specific
scripts/test.sh -L '!isGlobal && e.commandName === "find"'
```

### Running all unit tests on save

Quite helpful when developing unit tests or updating a feature, as it'll rerun the tests whenever you save a file.

```sh
scripts/test.sh -f unit. -watch
```

## See also

- [The custom checker script](./check.sh.md)
- [Local Data API spawning script](./startgate.sh.md)
- [The all-in-one "premerge" script](./premerge.sh.md)
