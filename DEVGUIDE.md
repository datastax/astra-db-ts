# Contents
1. [Running the tests](#running-the-tests)
2. [Linting](#linting)
3. [Building API Reference Documentation](#building-api-reference-documentation)

## Running the tests
Prerequisites:
- A JS package manager (npm, bun, etc.)
- A clean Astra instance with two keyspaces—`default_keyspace` and `other_keyspace`
- Copy the `.env.example` file and create a new `.env` file following the example template

```shell
# Run both unit and integration tests
npm run test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run both unit and integration tests with coverage check
npm run test:coverage

# Run tsc with the noEmit flag to check for type errors
npm run test:types
```

### Running tagged tests
Tests can be given certain tags to allow for more granular control over which tests are run. These tags currently include:
- `[long]`/`'LONG'`: Longer running tests that take more than a few seconds to run
- `[admin]`/`'ADMIN'`: Tests that require admin permissions to run
- `[dev]`/`'DEV'`: Tests that require the dev environment to run

To enable these tags, you can set the corresponding environment variables to some values. The env variables are in the
`env.example` file, but they're repeated here for convenience:
- `ASTRA_RUN_DEV_TESTS`
- `ASTRA_RUN_LONG_TESTS`
- `ASTRA_RUN_ADMIN_TESTS`

Or you can run the tests by doing something like
```shell
env ASTRA_RUN_LONG_TESTS=1 npm run test
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

### Linting
Run `npm run lint` to run ESLint.
ESLint will point out any formatting and code quality issues it finds.
You should try to run `npm run lint` before committing to minimize risk of regressions.

## Building API Reference Documentation
API Documentation of this library is generated using [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown)

Run the following to generate API documentation. This takes the `APIReference.hbs` and the library code as input and generates and `APIReference.md` file.

```shell
# Generate API documentation
npm run build:docs

# Optionally serve docs locally
npx markserv APIReference.md
```
