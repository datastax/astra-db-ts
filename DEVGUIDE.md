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
# Run both unit and integration tests
npm run test

# Run only unit tests
npm run test -- -f 'unit.'

# Run only integration tests
npm run test -- -f 'integration.'

# Run tsc with the noEmit flag to check for type errors
npm run test:types
```

### Running tagged tests
Tests can be given certain tags to allow for more granular control over which tests are run. These tags currently include:
- `[long]`/`'LONG'`: Longer running tests that take more than a few seconds to run
- `[admin]`/`'ADMIN'`: Tests that require admin permissions to run
- `[dev]`/`'DEV'`: Tests that require the dev environment to run
- `[prod]`/`'PROD'`: Tests that require the dev environment to run
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

Use the following to run tests with ADMIN and LONG tags automatically enabled (note that doesn't include vectorize tests):
```shell
npm run test:all
```

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
You must create a file, `vectorize_tests.json`, in the root folder, with the following format:

```ts
interface Config {
  [providerName: string]: {
    apiKey?: string,
    providerKey?: string,
    parameters?: {
      [modelName: string]: Record<string, string>
    },
  }
}
```

where:
- `providerName` is the name of the provider (e.g. `nvidia`, `openai`, etc.) as found in `findEmbeddingProviders`
- `apiKey` is the API key for the provider (which will be passed in through the header) 
  - optional if no header auth test wanted
- `providerKey` is the provider key for the provider (which will be passed in @ collection creation) 
  - optional if no KMS auth test wanted
- `parameters` is a mapping of model names to their corresponding parameters
  - optional if not required. `azureOpenAI`, for example, will need this.

This file is gitignored by default and will not be checked into VCS.

### Coverage testing

To run coverage testing, run the following command:
```shell
npm run test:coverage
```

This uses `test:all` under the hood, as well as a "bail early" flag as there's not really a point continuing to run 
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
I heavily recommend using [np](https://github.com/sindresorhus/np) to publish the package. Running it will involve running `test:prerelease`, and the
versioning step will update the api report + update the version in `src/version.ts`. 
