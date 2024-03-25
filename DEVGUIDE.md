# Contents
1. [Running the tests](#running-the-tests)
2. [Linting](#linting)
3. [Building API Reference Documentation](#building-api-reference-documentation)

## Running the tests
Prerequisites:
- A JS package manager (npm, bun, etc.)
- An Astra instance with two keyspaces—`default_keyspace` and `other_keyspace`
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
