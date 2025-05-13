# `check.ts` (The custom checker script)

A script that checks various aspects of the project to ensure that it is in a good state, including: 
- Type-checking,
- Linting,
- Compilation,
- Enforcement of various project conventions.

This script should be run, at the very least, before merging any changes into the main branch or releasing, but ideally,
much more often than just that.

## Contents

1. [Check script usage](#check-script-usage)
2. [Available checks](#available-checks)
   1. [Run type-checker (`tc`)](#run-type-checker-tc)
   2. [Run linter (`lint`)](#run-linter-lint)
   3. [Check licensing headers (`licensing`)](#check-licensing-headers-licensing)
   4. [Ensure library compilation (`lib-check`)](#ensure-library-compilation-lib-check)
   5. [Check test extension conventions (`test-exts`)](#check-test-extension-conventions-test-exts)
   6. [Check test naming conventions (`test-names`)](#check-test-naming-conventions-test-names)
3. [See also](#see-also)

## Check script usage

The API for the check script is as follows, where all checks are run by default if no arguments are provided:

```fortran
scripts/check.ts [tc] [lint] [licensing] [lib-check] [test-exts] [test-names]
```

One or more of the above checks may be specified otherwise, to run only the specified checks in the order they are provided.

The check script will return a non-zero exit code if any of the checks fail, and will print out the results of each check as it runs.

## Available checks

### Run type-checker (`tc`)

If set, `tsc` will be run with `--noEmit` to ensure that the `src` and `test` folders type-check correctly.

### Run linter (`lint`)

If set, `eslint` will be run over the `src` and `test` folders to ensure that the code follows proper conventions.

### Check licensing headers (`licensing`)

If set, the script will check that all files in the `src` and `test` folders have the correct apache 2.0 licensing headers.

```
// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
```

### Ensure library compilation (`lib-check`)

If set, the script will build the library, and set it as the dependency of a newly created TS project with `skipLibCheck: false`
to ensure that the library compiles correctly, and may be used in other projects without issue.

### Check test extension conventions (`test-exts`)

If set, the script will check that all test files in the `test` folder have the `.test.ts` extension.

However, this excludes files that reside within "special" directories, which start with a '__' prefix, such as `__common` or `__lib`.
- This allows us to define test utilities within the test folders themselves

For example, the first path will get flagged, but the second one is okay:

```bash
# WARNING
tests/unit/documents/__common/find-cursor.ts

# OK
tests/unit/documents/__common/find-cursor.ts
```

### Check test naming conventions (`test-names`)

If set, the script will check that all file-level test suites in the `test` folder have the correct naming convention.

It is expected that each file-level test suite will have a name that matches the file path relative to the `tests/` directory,
with slashes replaced by dots, and the `.test.ts` extension removed.

For example, the file `tests/unit/documents/utils.test.ts` should have a file-level test suite named `unit.documents.utils`.

```ts
describe('unit.documents.utils', () => {
  // Tests here
});
```

This works even if the root-level suite is a `parallel` or `background` block.

## See also

- [The custom test script](./test.ts.md)
- [The all-in-one "premerge" script](./premerge.ts.md)
