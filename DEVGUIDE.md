# DEVGUIDE.md

## Contents
1. [I can't be bothered to read all of this](#i-cant-be-bothered-to-read-all-of-this)
2. [Building the library](#building-the-library)
3. [Publishing](#publishing)
4. [Miscellaneous](#miscellaneous)
    1. [nix-shell + direnv support](#nix-shell--direnv-support)

## I can't be bothered to read all of this

yeah, fair enough.

## Building the library

At the moment, you need to be using a unix-like system to build the library, as it uses a small shell script,
which can be found in `scripts/build.sh`, and run manually enough on Windows if necessary.

To build it, just run `npm run build`, which does the following:
- Deletes the `dist` directory
- Updates the versioning file (`src/version.ts`)
- Runs `tsc` to compile the TypeScript files & resolves path aliases w/ `tsc-alias`
- Uses `api-extractor` to generate the API report & generate a rolled-up `.d.ts` file
- Runs over the code and trims any extra comments/files to reduce code size
- Deletes any extraneous `.d.ts` files

## Publishing

I heavily recommend using [np](https://github.com/sindresorhus/np) to publish the package. 

Unfortunately, because certain tests in the `astra-db-ts` test suite can fail for reasons outside your control,
such as the `huggingface` embedding provider failing, I **heavily** recommend running the full test suite manually
using the following command: `scripts/test.sh -all -w '.*'`, and, if the tests are all passing to your best judgement,
continue on to publish the package using `np --no-tests`.

The versioning step will automatically update the api report + update the version in `src/version.ts`, so you don't
need to worry about that.

## Miscellaneous

### nix-shell + direnv support

This is in no way required, but just for convenience purposes, a `.envrc` file is present that will
 - If you have nix, use the `shell.nix` to drop you into a nix-shell w/ `nodejs_20` & `jq`
 - Ephemerally add the `scripts/` dir to `PATH`
 - Ephemerally source `.env` into your shell

In case you have `direnv` installed, but don't want to use this, you can of course simply do `direnv block` and never
worry about any of this ever again.
