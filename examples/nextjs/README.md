# astra-db-ts w/ Next.js

## Overview

`astra-db-ts` works natively with Next.js (including its different available runtimes), with no
`events` polyfill needed to make it work. This is a simple example of how it can be used to interact
with an Astra database; it'll simply list out all the collections in a given database.

## Getting started

### Prerequisites:

- Make sure you have an existing Astra Database running @ [astra.datastax.com](https://astra.datastax.com/).
    - You'll need an API key and a database endpoint URL to get started.

### How to use this example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.env.example` file to `.env` and fill in the required values.

4. Run `npm run dev` to start the local development server.

5. Visit `http://localhost:3000` in your browser to see the example in action.

### Steps to start your own project:

1. Use the typical `npx create-next-app@latest` to create a new Next.js project.

2. Install `@datastax/astra-db-ts` by running `npm i @datastax/astra-db-ts`.

3. You should be able to use `@datastax/astra-db-ts` in your project as normal now.
