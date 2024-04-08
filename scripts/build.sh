#!/usr/bin/sh

rm -rf ./dist
node -p "'export const LIB_NAME = ' + JSON.stringify('astra-db-ts') + ';'" > src/version.ts
node -p "'export const LIB_VERSION = ' + JSON.stringify(require('./package.json').version) + ';'" >> src/version.ts
npx tsc --project tsconfig.build.json
npx tsc-alias -p tsconfig.build.json
npm run api-extractor
rm -r ./temp
cd dist || return 1
find . -type f -name '*.d.ts' ! -name 'astra-db-ts.d.ts' -exec rm {} +
cd ..
