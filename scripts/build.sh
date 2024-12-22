#!/usr/bin/env sh

# Cleans the previous build
rm -rf ./dist

# Creates the version file
node scripts/utils/build-version-file.js > src/version.ts

# Transpiles the project
if [ "$1" = "-light" ]; then
  npx tsc --project tsconfig.production.json -d false --noCheck
else
  npx tsc --project tsconfig.production.json
fi

# Replaces alias paths with relative paths (e.g. `@/src/version` -> `../../src/version`)
npx tsc-alias -p tsconfig.production.json

if [ "$1" != "-light" ]; then
  # Creates the rollup .d.ts, generates an API report in etc/, and cleans up any temp files
  npx api-extractor run -c ./api-extractor.jsonc --local && rm -r ./temp

  # Uses a more succinct licence notice + removes block comments (the rollup .d.ts file already contains the ts-doc)
  find ./dist -type f -name '*.js' -exec node scripts/utils/reduce-comments.js {} \;

  # Adds the missing license notice to the rollup .d.ts
  node scripts/utils/add-license-bumf.js dist/astra-db-ts.d.ts

  # Protects against Symbol.asyncDispose not found
  sed -i -E '/^(\s+)\[Symbol\.(asyncD|d)ispose\]/i\// @ts-ignore-error - May or may not be found depending on TS version & esnext.disposable in lib' dist/astra-db-ts.d.ts

  # Delete the "empty" files where only types were declared
  node scripts/utils/del-empty-dist-files.js

  # Removes all .d.ts files except the main rollup .d.ts
  cd dist || return 1
  find . -type f -name '*.d.ts' ! -name 'astra-db-ts.d.ts' -exec rm {} +
  cd ..

  # Delete any empty leftover directories
  find ./dist -type d -empty -delete
fi
