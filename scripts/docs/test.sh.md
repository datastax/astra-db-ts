# `test.sh` (The custom test script)

The `astra-db-ts` test suite uses a custom wrapper around [ts-mocha](https://www.npmjs.com/package/ts-mocha), including its own custom test script.

While this undeniably adds in extra complexity and getting-started overhead:
- We sped up the complete test suite by 500+%
- We majority improved the test filtering capabilities
- We made it vastly easier to write and work with `astra-db-ts`-esque tests

You can read more about the custom wrapper and why it exists [here](https://github.com/datastax/astra-db-ts/pull/66#issue-2430902926).

## Contents

1. [Test script usage](#test-script-usage)
   1. [The test file (`scripts/test.sh`)](#1-the-test-file-scriptstestsh)
   2. [The test types (`[-all | -light | -coverage]`)](#2-the-test-types--all---light---coverage)
   3. [The test filters (`[-fand | -for] [-f/F <match>]+ [-g/G <regex>]+`)](#3-the-test-filters--fand---for--ff-match--gg-regex)
   4. [The vectorize whitelist (`[-w/W <vectorize_whitelist>]`)](#4-the-vectorize-whitelist--ww-vectorize_whitelist)
   5. [Bailing (`[-b | -bail]`)](#5-bailing--b---bail)
   6. [Disabling error reporting (`[-R | -no-report]`)](#6-disabling-error-reporting--r---no-report)
   7. [The HTTP client (`[-c <http_client>]`)](#7-the-http-client--c-http_client)
   8. [The Data API environment (`[-e <environment>]`)](#8-the-data-api-environment--e-environment)
   9. [Running the tests on Stargate (`[-local]`)](#9-running-the-tests-on-stargate--local)
   10. [Enable verbose logging for tests (`[(-l | -logging) | (-L | -logging-with-pred <predicate>)]`)](#10-enable-verbose-logging-for-tests--l---logging---l---logging-with-pred-predicate)
   11. [Skipping the prelude (`[-P | -skip-prelude]`)](#11-skipping-the-prelude--p---skip-prelude)
2. [Common test script usages](#common-test-script-usages)
   1. [Simply running all tests](#simply-running-all-tests)
   2. [Running all non-long-running tests](#running-all-non-long-running-tests)
   3. [Running all tests, but with coverage](#running-all-tests-but-with-coverage)
   4. [Running only unit tests](#running-only-unit-tests)
   5. [Running a specific test file](#running-a-specific-test-file)
   6. [Running some tests without the lengthy setup step](#running-some-tests-without-the-lengthy-setup-step)
   7. [Running tests on stargate](#running-tests-on-stargate)
   8. [Running tests without a specific test tag](#running-tests-without-a-specific-test-tag)
   9. [Running tests with logging](#running-tests-with-logging)

## Test script usage

The API for the test script is as follows:

```fortran
1. scripts/test.sh 
2.  [-all | -light | -coverage] 
3.  [-fand | -for] [-f/F <match>]+ [-g/G <regex>]+
4.  [-w/W <vectorize_whitelist>]
5.  [-b | -bail]
6.  [-R | -no-report]
7.  [-c <http_client>]
8.  [-e <environment>]
9.  [-local]
10. [(-l | -logging) | (-L | -logging-with-pred <predicate>)]]
11. [-P | -skip-prelude]
```

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

### 3. The test filters (`[-fand | -for] [-f/F <match>]+ [-g/G <regex>]+`)

The `astra-db-ts` test suite implements fully custom test filtering, inspired by Mocha's, but improved upon.
- `-f` and `-g` are _not_ mutually exclusive, and multiple of each may be used
- You can invert filters on an individual basis, instead of needing to invert either all filters or none
- Dynamically generated test filtering is properly handled
- Ability to choose if filters are ANDed or ORed together

There are two different mocha-like filters you can use:
- `-f <match>`: This is a basic filter that acts like Mocha's own `-f` flag. It only needs to match a part of the test name (or its parents' names) to succeed
- `-g <regex>`: This is like `-f`, but for regex. Each only needs to match a part of the test name (or its parent' names) to succeed, so use `^$` as necessary

Unlike Mocha, there is no `-i` flag—instead, you can invert filters on a case-by-case basis by using `-F <match>` 
or `-G <regex>`, so that the test (& its parent describes) need to NOT match that string/regex to run.

You can also use multiple filters by simply using multiple of `-f`, `-g`, `-F`, and `-G` as you please. By default,
it'll only run a test if it satisfies all the filters (`-fand`), but you can use the `-for` flag to run a test if
it satisfies any one of the filters.

In case filters overlap, an inverted filter always wins over a regular filter, and the conflicted test won't run.

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

Not necessary if `-local` is set (it'll automatically set the environment to `hcd`).

### 9. Running the tests on Stargate (`[-local]`)

If you're running the tests on a local Stargate instance, you can use this flag to set the `CLIENT_DB_URL` to
`http://localhost:8080` and the `CLIENT_DB_TOKEN` to `cassandra:cassandra` without needing to modify your `.env` file.

It'll also automatically set the environment to `hcd`.

Note that you'll still need to run stargate yourself. See [start-stargate-4-tests.sh.md](./start-stargate-4-tests.sh.md) for more info.

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

## Common test script usages

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

Takes advantage of the naming convention of root-level `describe`/`parallel` blocks' names to be equivalent to the test file's directory + name, relative to `./tests` (e.g. `unit.documents.tables.ser-des.key-transformer`).

Runs in ~10s, and `prelude.test.ts` is automatically skipped, since no integration tests are detected to be run.

If you append the `-light` option (which skips all `(LONG)`-tagged tests), the unit tests will run in just a single second.

```sh
scripts/test.sh -f unit.
```

### Running a specific test file

I use this very frequently.

Takes advantage of the naming convention of root-level `describe`/`parallel` blocks' names to be equivalent to the test file's directory + name, relative to `./tests` (e.g. `unit.documents.tables.ser-des.key-transformer`).

```sh
scripts/test.sh -f integration.documents.tables.ser-des.key-transformer
```

### Running some tests without the lengthy setup step

If running an integration test file, I'll very commonly pair this with the `-P` flag to skip the prelude, if the DB is
already setup, to save a lot of time there, and have the test run in (often) just seconds.

Note that if you're running only unit tests, the prelude will automatically be skipped for you.

```sh
scripts/test.sh -f integration.documents.tables.ser-des.key-transformer -P
```

### Running tests on stargate

Sets the `CLIENT_DB_URL` to `http://localhost:8080` and the `CLIENT_DB_TOKEN` to `cassandra:cassandra` without needing to modify your `.env` file.

Also sets the environment to `hcd` implicitly.

```sh
# Secondary terminal window
scripts/start-stargate-4-tests.sh

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
