# Contents
1. [Running the tests](#running-the-tests)
2. [Linting](#linting)
3. [Building the library](#building-the-library)
4. [Publishing](#publishing)

## Running the tests
Prerequisites:
- A JS package manager (npm, bun, etc.)
- A clean AstraDB instance with two keyspaces—`default_keyspace` and `other_keyspace`
- Copy the `.env.example` file and create a new `.env` file following the example template

```shell
npm run test -- [--all | --light | --coverage | --prerelease] [-f <filter>] [-w <vectorize_whitelist>] [-b] [--args <raw_args>]
# or
npm run test -- <--types>
```

```shell
# Run both unit and integration tests
npm run test

# Run only unit tests
npm run test -- -f 'unit.'

# Run only integration tests
npm run test -- -f 'integration.'

# Run all possible tests
npm run test -- --all

# Run all possible integration tests
npm run test -- --all -f 'integration.'

# Run all tests that aren't admin/long/vectorize
npm run test -- --light -f 'integration.'

# Run tsc with the noEmit flag to check for type errors
npm run test -- --types
```

(bun does not need the extra initial `--` like npm does).

### Running the tests on local Stargate
You can do `sh scripts/start-stargate-4-tests.sh` to spin up an ephemeral Data API on DSE instance which automatically
creates the required keyspaces and destroys itself on exit.

Then, be sure to set the following vars in `.env` exactly, then run the tests as usual.
```dotenv
APPLICATION_URI=http://localhost:8181
APPLICATION_TOKEN=Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh
APPLICATION_ENVIRONMENT=dse
```

### Running tagged tests
Tests can be given certain tags to allow for more granular control over which tests are run. These tags currently include:
- `[long]`/`'LONG'`: Longer running tests that take more than a few seconds to run
- `[admin]`/`'ADMIN'`: Tests that require admin permissions to run
- `[dev]`/`'DEV'`: Tests that require the dev environment to run
- `[not-dev]`/`'NOT-DEV'`: Tests that require the dev environment to run
- `[vectorize]`/`'VECTORIZE'`: Tests that require a specific vectorize-enabled kube to run

To enable these some of these tags, you can set the corresponding environment variables to some values. The env 
variables are in the `env.example` file, but they're repeated here for convenience:
- `ASTRA_RUN_VECTORIZE_TESTS`
- `ASTRA_RUN_LONG_TESTS`
- `ASTRA_RUN_ADMIN_TESTS`

Or you can run the tests by doing something like
```shell
env ASTRA_RUN_LONG_TESTS=1 npm run test
```

The `PROD` and `DEV` tags are enabled/disabled automatically, inferred from the astra endpoint URL.

### Adding your own tagged tests
To enforce the tags, use the `assertTestsEnabled` function from `test/fixtures.ts`, which will skip the function if the
given tag is not enabled. 

It's also encouraged to add the corresponding tag to the test name, so that it's clear why the test is being skipped.

For example:
```typescript
describe('[long] createCollection + dropCollection', () => {
  // Note that it's important to use an actual function here, not an arrow function
  before(async function () {
    assertTestsEnabled(this, 'LONG');
  });

  // ...
});
```

If a new tag really, really, needs to be added, it can be done by adding a new environment variable of the proper
format, and updating the `assertTestsEnabled` function. However, this should be done sparingly, as it can make the
test suite harder to manage.

### Running vectorize tests
To run vectorize tests, you need to have a vectorize-enabled kube running, with the correct tags enabled.

Ensure `ASTRA_RUN_VECTORIZE_TESTS` and `ASTRA_RUN_LONG_TESTS` are enabled as well (or just pass the `--all` flag to
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

This file is gitignored by default and will not be checked into VCS.

See `vectorize_test_spec.example.json` for, guess what, an example.

This spec is cross-referenced with `findEmbeddingProviders` to create a suite of tests branching off each possible
parameter, with tests names of the format `providerName@modelName@authType@dimension`, where each section is another
potential branch.

These branches can be narrowed down with the `VECTORIZE_WHITELIST` env var (or pass `-w <vectorize_whitelist>` to
the test script). It's a regex parameter which only needs to match part of the test name to whitelist (so use `^$` as 
necessary). 

An example would be `VECTORIZE_WHITELIST=^.*@(header|none)@(default|specified)` to only run the vectorize tests using
the header auth (or no-auth for nvidia), and only using the default/specified version of the dimension, essentially 
stopping creating additional branches off of authentication and vector dimension to reduce the number of near-duplicate
tests run.

Defaults to just `*`.

### Coverage testing

To run coverage testing, run the following command:
```shell
npm run test -- --coverage
```

This uses `test --all` under the hood, as well as a "bail early" flag as there's not really a point continuing to run 
tests if one of them fails, as the coverage report will be impacted.

## Linting
Run `npm run lint` to run ESLint. ESLint will point out any formatting and code quality issues it finds.

## Building the library
At the moment, you need to be using a unix-like system to build the library, as it uses a small shell script,
which can be found in `scripts/build.sh`, and run manually enough on Windows if necessary.

To build it, just run `npm run build`, which does the following:
- Deletes the `dist` directory
- Updates the versioning file (`src/version.ts`)
- Runs `tsc` to compile the TypeScript files & resolves path aliases w/ `tsc-alias`
- Uses `api-extractor` to generate the API report & generate a rolled-up `.d.ts` file
- Deletes any extraneous `.d.ts` files

## Publishing
I heavily recommend using [np](https://github.com/sindresorhus/np) to publish the package. Running it will involve running `test --prerelease`, and the
versioning step will update the api report + update the version in `src/version.ts`. 
