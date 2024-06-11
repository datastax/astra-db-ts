#!/usr/bin/sh

# Cleans the previous build
rm -rf ./dist

# Creates the version file
node scripts/build-version-file.js > src/version.ts

# Transpiles the project
yes | npx tsc --project tsconfig.build.json

# Replaces alias paths with relative paths (e.g. `@/src/version` -> `../../src/version`)
yes | npx tsc-alias -p tsconfig.build.json

# Creates the rollup .d.ts, generates an API report in etc/, and cleans up any temp files
npm run api-extractor && rm -r ./temp

# Uses a more succinct licence notice + removes block comments (the rollup .d.ts file already contains the ts-doc)
find ./dist -type f -name '*.js' -exec node scripts/reduce-comments.js {} \;

# Removes all .d.ts files except the main rollup .d.ts
cd dist || return 1
find . -type f -name '*.d.ts' ! -name 'astra-db-ts.d.ts' -exec rm {} +
cd ..
