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
    "test-ext")
      check_types="$check_types test-ext"
      ;;
    "lib-check")
      check_types="$check_types lib-check"
      ;;
    *)
       if [ "$1" != "--help" ] && [ "$1" != "-help" ] && [ "$1" != "-h" ]; then
         echo "Invalid flag $1"
         echo
       fi
       echo "Usage:"
       echo
       echo "$0 [tc] [lint] [licensing] [lib-check]"
       echo
       echo "* tc: runs the type-checker"
       echo "* lint: checks for linting errors"
       echo "* licensing: checks for missing licensing headers"
       echo "* lib-check: ensures library compiles if skipLibCheck: false"
       echo "* test-ext: makes sure test files end in .test.ts"
       echo
       echo "Defaults to running all checks if no specific checks are specified."
       exit
  esac
  shift
done

if [ -z "$check_types" ]; then
  check_types="tc lint licensing lib-check test-ext"
fi

failed=false

for check_type in $check_types; do
  case $check_type in
    "tc")
      echo "Running type-checker..."
      npx tsc --noEmit || failed=true
      ;;
    "lint")
      echo "Running linter..."
      npm run lint -- --no-warn-ignored || failed=true
      ;;
    "licensing")
      echo "Checking for missing licensing headers..."
      offenders=$(find tests/ src/ -type f -exec grep -L "^// Copyright DataStax, Inc." {} +)

      if [ -n "$offenders" ]; then
        echo "The following files are missing licensing headers:"
        echo "$offenders"
        failed=true
      fi
      ;;
    "lib-check")
      echo "Checking library compiles..."

      tmp_dir="tmp-lib-check"
      rm -rf "$tmp_dir" "$main_dir/dist"

      (scripts/build.sh -no-report \
        && mkdir "$tmp_dir" \
        && cd "$tmp_dir" \
        && npm init -y \
        && npm install typescript "$main_dir" \
        && echo "import '@datastax/astra-db-ts'" > src.ts \
        && npx tsc --init --skipLibCheck false --typeRoots "./node_modules/**" --target es2020 \
        && npx tsc) || failed=true

      cd "$main_dir" && rm -rf "$tmp_dir"
      ;;
    "test-ext")
      echo "Checking test file extensions..."
      offenders=$(find tests/unit tests/integration -type f -not -name "*.test.ts")

      if [ -n "$offenders" ]; then
        echo "The following test files do not end in '.test.ts':"
        echo "$offenders"
        failed=true
      fi
      ;;
    "*")
      echo "Invalid check type '$check_type'"
      exit 1
      ;;
  esac
done

if [ "$failed" = true ]; then
  echo "Checks failed"
  exit 1
else
  echo "Checks passed"
fi
