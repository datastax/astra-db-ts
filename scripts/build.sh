#!/usr/bin/env sh

while [ $# -gt 0 ]; do
  case "$1" in
    "-update-report" | "-r")
      update_report=true
      ;;
    "-light" | "-l")
      light=true
      ;;
    *)
      sh scripts/utils/help.sh "$1" build.sh
      exit $?
      ;;
  esac
  shift
done

# Cleans the previous build
rm -rf ./dist

# Creates the version file
node scripts/utils/build-version-file.cjs > src/version.ts

# Transpiles the project
if [ "$light" = true ]; then
  npx tsc -p etc/tsconfig.cjs.json || exit 10
  npx tsc-alias -p etc/tsconfig.cjs.json
  echo '{"type": "commonjs"}' > dist/cjs/package.json
else
  npx tsc -p etc/tsconfig.esm.json || exit 20
  npx tsc-alias -p etc/tsconfig.esm.json
  echo '{"type": "module"}' > dist/esm/package.json

  npx tsc -p etc/tsconfig.cjs.json || exit 30
  npx tsc-alias -p etc/tsconfig.cjs.json
  echo '{"type": "commonjs"}' > dist/cjs/package.json
fi

# Replaces alias paths with relative paths (e.g. `@/src/version` -> `../../src/version`)

if [ "$light" != true ]; then
  # Creates the rollup .d.ts, generates an API report in etc/, and cleans up any temp files
  npx api-extractor run -c ./api-extractor.jsonc --local

  # Updates the API report if flag not set
  if [ "$update_report" = true ]; then
    mv -f ./temp/*.api.md ./etc/
  fi
  rm -r ./temp

  # For some reason the rollup .d.ts has some random, unused imports that need to be removed
  node scripts/utils/remove-bad-rollup-imports.cjs dist/astra-db-ts.d.ts

  # Uses a more succinct licence notice + removes block comments (the rollup .d.ts file already contains the ts-doc)
  find ./dist -type f -name '*.js' -exec node scripts/utils/reduce-comments.cjs {} \;

  # Adds the missing license notice to the rollup .d.ts
  node scripts/utils/add-license-bumf.cjs dist/astra-db-ts.d.ts

  # Protects against Symbol.asyncIterator not found
  sed -i.bak -E '/^(\s+)\[Symbol\.asyncIterator\]/i\
    // @ts-ignore-error - May or may not be found depending on TS version & esnext.disposable in lib' dist/astra-db-ts.d.ts
  rm dist/astra-db-ts.d.ts.bak

  # Delete the "empty" files where only types were declared
  node scripts/utils/del-empty-dist-files.cjs

  # Removes all .d.ts files except the main rollup .d.ts
  find ./dist/esm -type f -name '*.d.ts' -exec rm {} +

  # Delete any empty leftover directories
  find ./dist -type d -empty -delete

  # Create the index.d.ts files
  # https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/FalseESM.md
  echo "" > dist/astra-db-ts.js
  echo "export * from '../astra-db-ts.js';" > dist/esm/index.d.ts
  echo "export * from '../astra-db-ts.js';" > dist/cjs/index.d.ts
fi
