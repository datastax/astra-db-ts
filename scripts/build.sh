#!/usr/bin/env sh

set -e

while [ $# -gt 0 ]; do
  case "$1" in
    "-update-report" | "-r")
      update_report=true
      ;;
    "-for-repl")
      for_repl=true
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

# Creates the new version file (shouldn't make a difference, but just in case it's out of sync)
node scripts/utils/build-version-file.cjs > src/version.ts

transpile_project() {
  # shellcheck disable=SC2086
  npx tsc -p "etc/tsconfig.$1.json" $3
  npx tsc-alias -p "etc/tsconfig.$1.json"
  echo "{\"type\": \"$2\"}" > "dist/$1/package.json"
}

# Transpiles the project
if [ "$for_repl" = true ]; then
  transpile_project "cjs" "commonjs" --noCheck
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

  # Removes all .d.ts files except the main rollup .d.ts
  find ./dist/esm -type f -name '*.d.ts' -exec rm {} +

  # Delete the "empty" files with no actual exports (where only types were declared)
  node scripts/utils/del-empty-dist-files.cjs

  # Delete any empty leftover directories
  find ./dist -type d -empty -delete

  # Create the index.d.ts files
  # https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/FalseESM.md
  # https://stackoverflow.com/questions/76596405/typescript-fail-because-imports-in-d-ts-files-are-missing-import-type/76690789#76690789
  echo "export * from '../astra-db-ts.js'; export declare const LIB_BUILD: 'esm';" > "dist/esm/index.d.ts"
  echo "export const LIB_BUILD = 'esm';" >> "dist/esm/version.js"

  echo "export * from '../astra-db-ts.js'; export declare const LIB_BUILD: 'cjs';" > "dist/cjs/index.d.ts"
  echo "exports.LIB_BUILD = 'cjs';" >> "dist/cjs/version.js"

  echo "" > dist/astra-db-ts.js
fi
