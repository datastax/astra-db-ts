#!/usr/bin/env sh

main_dir=$(pwd)

while [ $# -gt 0 ]; do
  case "$1" in
    "tc")
      check_types="$check_types tc"
      ;;
    "lint")
      check_types="$check_types lint"
      ;;
    "licensing")
      check_types="$check_types licensing"
      ;;
    "test-exts")
      check_types="$check_types test-exts"
      ;;
    "test-names")
      check_types="$check_types test-names"
      ;;
    "lib-check")
      check_types="$check_types lib-check"
      ;;
    "module-exports-diff")
      check_types="$check_types module-exports-diff"
      ;;
     *)
      sh scripts/utils/help.sh "$1" check.sh
      exit $?
      ;;
  esac
  shift
done

if [ -z "$check_types" ]; then
  check_types="tc lint licensing lib-check test-exts test-names module-exports-diff"
fi

failed=false

print_green() {
  echo "$(tput setaf 2)$(tput bold)$1$(tput sgr0)"
}

print_green_with_status() {
  if [ $failed = true ]; then
    print_green "- $1 :/"
  else
    print_green "- $1 :)"
  fi
}

print_failed() {
  echo "$(tput setaf 1)$1$(tput sgr0)"
  failed=true
}

build_if_not_built() {
  if [ -z "$built" ]; then
    scripts/build.sh > /dev/null
    built=true
  fi
}

for check_type in $check_types; do
  case $check_type in
    "tc")
      print_green_with_status "Running type-checker..."

      if ! npx tsc --noEmit > /dev/null; then
        npx tsc --noEmit
        failed=true
      fi
      ;;
    "lint")
      print_green_with_status "Running linter..."

      if ! npm run lint -- --no-warn-ignored > /dev/null; then
        npm run lint -- --no-warn-ignored
        failed=true
      fi
      ;;
    "licensing")
      print_green_with_status "Checking for missing licensing headers..."
      offenders=$(find tests/ src/ -type f -exec grep -L "^// Copyright DataStax, Inc." {} +)

      if [ -n "$offenders" ]; then
        print_failed "The following files are missing licensing headers:"
        print_failed "$offenders"
      fi
      ;;
    "lib-check")
      print_green_with_status "Ensuring library compiles with skipLibCheck: false..."

      tmp_dir="tmp-lib-check"
      rm -rf "$tmp_dir" "$main_dir/dist"

      build_if_not_built

      if [ "$built" != true ]; then
        print_failed "Could not build library for lib-check phase"
      else
        mkdir "$tmp_dir" \
          && cd "$tmp_dir" \
          && npm init -y > /dev/null \
          && npm install typescript "$main_dir" > /dev/null \
          && echo "import '@datastax/astra-db-ts'" > src.ts \
          && npx tsc --init --skipLibCheck false --typeRoots "./node_modules/**" --target es2020 > /dev/null

        if [ -f tsconfig.json ]; then
          npx tsc || failed=true
        else
          print_failed "Could not set up library for lib-check phase"
        fi
      fi

      cd "$main_dir" && rm -rf "$tmp_dir"
      ;;
    "test-exts")
      print_green_with_status "Checking for test files that do not end in '.test.ts'..."
      offenders=$(find tests/unit tests/integration -type d -name '__*' -prune -o -type f -not -name "*.test.ts" -exec echo "- {}" \;)

      if [ -n "$offenders" ]; then
        print_failed "The following test files do not end in '.test.ts':"
        print_failed "$offenders"
      fi
      ;;
    "test-names")
      print_green_with_status "Checking for test suite names that do not match the test dir + file name..."

      offenders=$(
        find tests/unit tests/integration -type f -name "*.test.ts" | while read -r file; do
          expected_name="$(dirname "$file" | sed 's@^tests/@@' | sed 's@/@\\.@g')\.$(basename "$file" .test.ts)"
          grep -qE "(describe|parallel|background)\\('(\([A-Z-]+\) )*$expected_name" "$file" || echo "- $file"
        done
      )

      if [ -n "$offenders" ]; then
        print_failed "The following test suites do not match the test dir + file name:"
        print_failed "$offenders"
      fi
      ;;
    "module-exports-diff")
      print_green_with_status "Ensuring ESM & CJS modules have the same exports..." # yes this has been a problem before

      build_if_not_built

      if [ "$built" != true ]; then
        print_failed "Could not build library for lib-check phase"
        continue
      fi

      res=$(node -e '
        import("./dist/esm/index.js").then(Object.keys).then(esm => {
          const cjs = Object.keys(require("./dist/cjs/index.js"));

          const inCjsNotInEsm = cjs.filter(key => !esm.includes(key));
          const inEsmNotInCjs = esm.filter(key => !cjs.includes(key));

          if (inCjsNotInEsm.length > 0 || inEsmNotInCjs.length > 0) {
            console.log("The following exports are missing from either ESM or CJS:");
            console.log("In CJS but not ESM:", inCjsNotInEsm);
            console.log("In ESM but not CJS:", inEsmNotInCjs);
            process.exit(1);
          }
        }).catch(() => process.exit(1));
      ')

      if [ -n "$res" ]; then
        print_failed "$res"
      fi
      ;;
    "*")
      print_failed "Invalid check type '$check_type'"
      exit 1
      ;;
  esac
done

if [ "$failed" = true ]; then
  print_failed "$(tput bold)Checks failed :("
  exit 1
else
  print_green "Checks passed :)"
fi
