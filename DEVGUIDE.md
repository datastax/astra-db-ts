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


