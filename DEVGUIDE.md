# DEVGUIDE.md

##  Contents
1. [Running the tests](#running-the-tests)
2. [Typechecking & Linting](#typechecking--linting)
3. [Building the library](#building-the-library)
4. [Publishing](#publishing)

## Running the tests

### Prerequisites

- `npm`/`npx`
- A running Data API instance
- A `.env` with the credentials filled out

<sub>*DISCLAIMER: The test suite will create any necessary namespaces/collections, and any existing collections in
the database will be deleted.*</sub>

<sub>*Also, if you for some reason already have an existing namespace called 'slania', it too will be deleted. Not
sure why you'd have a namespace named that, but if you do, I like your taste in music.*</sub>

### I can't be bothered to read all of this

1. Just make sure `CLIENT_APPLICATION_URI` and `CLIENT_APPLICATION_TOKEN` are set in your `.env` file
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
3.  [-fand | -for] [-/~f <filter>]+ [-/~g <regex>]+ 
4.  [-/~w <vectorize_whitelist>] 
5.  [-b] 
6.  [~report] 
7.  [-c <http_client>] 
8.  [-e <environment>]
```

#### 1. The test file

While you can use `npm run test` or `bun run test` if you so desire, attempting to use the test script's flags with it
may be a bit iffy, as the inputs are first "de-quoted" (evaluated) when you use the shell command, but they're 
"de-quoted" again when the package manager runs the actual shell command. 

Just use `scripts/test.sh` (or `sh scripts/test.sh`) directly if you're using command-line flags and want to
avoid a headache.

#### 2. The test types

There are three main test types:
- `-all`: This is a shorthand for running enabling the `[LONG]`, `[ADMIN]`, and `[VECTORIZE]` tests (alongside all the normal tests that always run)
- `-light`: This is a shorthand for disabling the aforementioned tests. This runs only the normal tests, which are much quicker to run in comparison
- `-coverage`: This runs all tests, but uses `nyc` to test for coverage statistics. Enabled the `-b` (bail) flag, as no point continuing if a test fails

By default, just running `scripts/test.sh` will be like using `-light`, but you can set the default config for which tests
to enable in your `.env` file, through the `CLIENT_RUN_*_TESTS` env vars.

#### 3. The test filters

The `astra-db-ts` test suite implements fully custom test filtering, inspired by Mocha's, but improved upon.

You can add a basic filter using `-f <filter>` which acts like Mocha's own `-f` flag. Like Mocha, we also support `-g`,
which is like `-f`, but for regex. Each only needs to match a part of the test name (or its parent describes' names) to
succeed, so use `^$` as necessary.

Unlike Mocha, there is no `-i` flag—instead, you can invert a filter by using `~f <filter>` or `~g <regex>`, so that the
test needs to NOT match that string/regex to run.

You can also use multiple filters by simply using multiple of `-f`, `-g`, `~f`, and `~g` as you please. By default,
it'll only run a test if it satisfies all the filters (`-fand`), but you can use the `-for` flag to run a test if
it satisfies any one of the filters.

In case filters overlap, an inverted filter always wins over a regular filter, and the conflicted test won't run.

#### 4. The vectorize whitelist

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

#### 5. Bailing

Simply sets the bail flag, as it does in Mocha. Forces the test script to exit after a single test failure.

#### 6. Disabling error reporting

By default, the test suite logs the complete error objects of any that may've been thrown during your tests to the
`./etc/test-reports` directory for greatest debuggability. However, this can be disabled for a test run using the
`~report` flag.

#### 7. The http client

By default, `astra-db-ts` will run its tests on `fetch-h2` using `HTTP/2`, but you can specify a specific client, which
is one of `default:http1`, `default:http2`, or `fetch`.

#### 8. The test environment

By default, `astra-db-ts` assumes you're running on Astra, but you can specify the Data API environment through this
flag. It should be one of `dse`, `hcd`, `cassandra`, or `other`. You can also provide `astra`, but it would't really
do anything. But I'm not the boss of you; you can make your own big-boy/girl/other decisions.

## Typechecking & Linting


