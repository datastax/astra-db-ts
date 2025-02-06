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

# Creates the new version file
node scripts/utils/build-version-file.cjs > src/version.ts

transpile_project() {
  npx tsc -p "etc/tsconfig.$1.json"
  npx tsc-alias -p "etc/tsconfig.$1.json"
  echo "{\"type\": \"$2\"}" > "dist/$1/package.json"
}

# Transpiles the project
if [ "$light" = true ]; then
  transpile_project "cjs" "commonjs"
else
  transpile_project "esm" "module" &
  transpile_project "cjs" "commonjs" &
  wait

  # Creates the rollup .d.ts, generates an API report in etc/, and cleans up any temp files
  npx api-extractor run -c ./api-extractor.jsonc --local
  if [ "$update_report" = true ]; then
    mv -f ./temp/*.api.md ./etc/
  fi
  rm -r ./temp

  # Adds licence header to rollup .d.ts
  # Also, for some reason, the rollup .d.ts has some random, unused imports that need to be removed
  node scripts/utils/process-rollup.cjs dist/astra-db-ts.d.ts

  # Uses a more succinct licence notice + removes block comments (the rollup .d.ts file already contains the ts-doc)
  find ./dist -type f -name "*.js" -print0 | xargs -P 10 -0 -I {} node scripts/utils/reduce-comments.cjs {}

  # Protects against Symbol.asyncIterator not found
  sed -i.bak '/^[[:space:]]*\[Symbol\.asyncIterator\]/i\
    // @ts-ignore-error - May or may not be found depending on TS lib version
  ' dist/astra-db-ts.d.ts
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
