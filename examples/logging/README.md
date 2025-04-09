# astra-db-ts logging

## Overview

> [!WARNING]  
> This example pertains to `astra-db-ts` version 2.0.0 and later.
>
> Previous versions of `astra-db-ts` had only event-based, emitted through the `DataAPIClient`, if `dbOptions.monitorCommands` were `true`.

`astra-db-ts` provides a highly configurable logging system with two main behaviors:
- Logging directly to `stdout`/`stderr`
- Emitting events for you to handle in your own way

These are a few examples of how you can use and configure the logging system in `astra-db-ts`:
1. Basic usage example
2. Custom formatting of logs
3. Hierarchical usage (listening to events at any level, and stopping propagation to parent listeners)
4. Plugging in your own logger (e.g. `winston`)

## Getting started

### Prerequisites:

- Make sure you have an existing Astra Database running @ [astra.datastax.com](https://astra.datastax.com/).
  - You'll need an API key and a database endpoint URL to get started.

### How to use this example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.env.example` file to `.env` and fill in the required values.

4. Run `npm run start` to run the logging examples.

### More information:

You may view more documentation on the [official DataStax documentation site](https://docs.datastax.com/en/astra-db-serverless/api-reference/typescript-client.html),
and in the TSDoc for the `astra-db-ts` library itself (e.g. `LoggingConfig`, `DataAPIClientEventMap`, `BaseClientEvent`)
