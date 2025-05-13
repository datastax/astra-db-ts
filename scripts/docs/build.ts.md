# `build.ts` (The messy build script)

`astra-db-ts` uses a multistep build process to properly dual support ESM & CJS while keeping the package size (relatively) slim.

## Contents

1. [Usage](#usage)
   1. [Updating the API report (`[-r | -update-report]`)](#updating-the-api-report--r---update-report)
   2. [Building for the REPL (`[-for-repl]`)](#building-for-the-repl--for-repl)
2. [Steps](#steps)
   1. [1. Clean](#1-clean)
   2. [2. Transpile](#2-transpile)
   3. [3. API Extractor](#3-api-extractor)
   4. [4. Processing the rollup `.d.ts` file](#4-processing-the-rollup-dts-file)
   5. [5. File cleanup](#5-file-cleanup)
   6. [6. Creating the `index.d.ts` files](#6-creating-the-indexdts-files)
3. [See also](#see-also)

## Usage

In the vast majority of cases, the build script can be used simply, with no arguments: `scripts/build.ts`.

### Updating the API report (`[-r | -update-report]`)

However, at the very least before merging, the API report needs to be updated. This may be done by running the build script with the `-update-report` (or `-r`) flag: `scripts/build.ts -update-report`.

If you use `scripts/premerge.ts`, it will automatically do this for you.

### Building for the REPL (`[-for-repl]`)

This is simply a flag which enables a much faster build process, emitting only CJS code with no type checking or type output.

This is useful for the REPL, as it allows for a much faster startup time, but should not be used for any other purpose.

## Steps

There are a number of steps that the build script goes through, in order to ensure that the package is built correctly, and for the best developer experience.

The final output will look like this:

```hs
dist/
├── cjs/
│  ├── *transpiled files* -- with the .js extension
│  ├── index.d.ts         -- containing `export * from "../astra-db-ts.js"; export declare const LIB_BUILD = "cjs";`
│  ├── package.json       -- containing `{"type": "commonjs"}`
├── esm/
│  ├── *transpiled files* -- with the .js extension
│  ├── index.d.ts         -- containing `export * from "../astra-db-ts.js"; export declare const LIB_BUILD = "esm";`
│  ├── package.json       -- containing `{"type": "module"}`
├── astra-db-ts.d.ts      -- the rollup .d.ts file
└── astra-db-ts.js        -- a faux .js file for the index.d.ts files to reference
```

### 1. Clean

The first step is to clean the `dist` directory, removing all files and directories within it.

This will also update the `version.ts` file to ensure it is in sync with the `package.json` file.

### 2. Transpile

This will asynchronously transpile the TypeScript source files into both CJS and ESM JavaScript outputs.

Note that only the ESM build will actually output declaration files (as it would be redundant to output them for the CJS build).

Then, [tsc-alias](https://github.com/justkey007/tsc-alias) is run over the output files to convert path aliases into relative paths (e.g. `@src/client/index.js` -> `../client/index.js`).

Then, a minimal `package.json` file is created in each distribution, with only the `type` field set to either `"module"` or `"commonjs"`.

### 3. API Extractor

[API Extractor](https://api-extractor.com/) will be run over the declaration files output by the ESM build to generate a rollup `.d.ts` file containing all the project's types definitions.

It will also generate an API report, which is used to determine if the package's API has changed. It will only update the existing one if the `-r` flag is passed.

The rollup `.d.ts` file, `astra-db-ts.d.ts` will live in the root of the `dist` directory.

### 4. Processing the rollup `.d.ts` file

There are two things that need to be done to the rollup `.d.ts` file:

1. An Apache license header needs to be added to the top of the file.
2. A faux "typescript version validator" function needs to be added before all the other exports.
3. Invalid exports need to be removed.

This function declaration is added to the top of the file to ensure that a readable parser error is thrown if the user tries to use the library with a version of TypeScript that is less than 5.0.0.

```ts
declare function astraDbTsRequiresTypeScriptV5OrGreater<const AstraDbTsRequiresTypeScriptV5OrGreater>(_: AstraDbTsRequiresTypeScriptV5OrGreater): void;
```

Also, for reasons unknown to me, API Extractor will output invalid exports in the rollup `.d.ts` file.

Such imports may include those as the following, which are never even used in the public API (hence my confusion):

```ts
import { CollectionSerDesConfig as CollectionSerDesConfig_2 } from '../../documents/collections/ser-des/ser-des.js';
import { Decoder } from 'decoders';
import type { DecoderType } from 'decoders';
import { Monoid as Monoid_2 } from '../../lib/opts-handler.js';
```

They are removed via regex matching to prevent potential issues for when the user uses the library.

### 5. File cleanup

"File cleanup" consists of a few steps majorly reduce package size by removing redundant files & comments:

1. Replace all apache licence headers with a more concise version.
    - This shaves ~200kB off the unpacked size
2. Remove all block comments from the `.js` files
    - This shaves ~500kB off the unpacked size
3. Delete all `.d.ts` files that are not the rollup `.d.ts` file
    - This also shaves ~500kB off the unpacked size
4. Remove all "empty" JS files (those that have no exports) & empty directories
    - This build step is admittedly more fragile, and less necessary, than the others
    - This removes ~170 unnecessary files/directories

Together, these bring the unpacked size down from ~2.4MB to ~1.1MB (as of time of writing).

### 6. Creating the `index.d.ts` files

Due to how TypeScript resolves type declarations, the single rollup `astra-db-ts.d.ts` file [_cannot_](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/FalseESM.md#common-causes) directly be used to provide types for both the ESM & CJS outputs at once.

To work around this, the build script will create two `index.d.ts` files, one for each output type, which will re-export the types from the rollup file.

However, because that would be too easy, neither of the following, however simple they may seem, [will work](https://stackoverflow.com/questions/76596405/typescript-fail-because-imports-in-d-ts-files-are-missing-import-type/76690789#76690789):

```ts
// This will not work because it is a `.d.ts` file
export * from '../astra-db-ts.d.ts';

// This will not work because TypeScript will think only the types of everything are be exported; not their actual values
export type * from '../astra-db-ts.d.ts';
```

Instead, an empty `astra-db-ts.js` file is created in the root directory, and the following is written to the `index.d.ts` files:

```ts
export * from '../astra-db-ts.js';
```

Because that is on par with the level of intuitiveness present in the rest of the JS/TS ecosystem.

Regardless, it works, and saves us from having to duplicate the >600MB rollup file.

Also, a `LIB_BUILD` export is manually written to each distribution for each distribution here for debugging purposes. It will contain either `'esm'` or `'cjs'` depending on the build type.

## See also

- [The all-in-one "premerge" script](./premerge.ts.md)
- [The development REPL](./repl.ts.md)
