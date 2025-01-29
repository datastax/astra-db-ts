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
       echo "* test-exts: makes sure test files end in .test.ts"
       echo "* test-names: makes sure test suite names match the test dir + file name"
       echo
       echo "Defaults to running all checks if no specific checks are specified."
       exit
  esac
  shift
done

if [ -z "$check_types" ]; then
  check_types="tc lint licensing lib-check test-exts test-names"
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

print_error() {
  echo "$(tput setaf 1)$1$(tput sgr0)"
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
        print_error "The following files are missing licensing headers:"
        print_error "$offenders"
        failed=true
      fi
      ;;
    "lib-check")
      print_green_with_status "Ensuring library compiles with skipLibCheck: false..."

      tmp_dir="tmp-lib-check"
      rm -rf "$tmp_dir" "$main_dir/dist"

      scripts/build.sh -no-report > /dev/null

      if [ ! $? ]; then
        print_error "Could not build library for lib-check phase"
        failed=true
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
          print_error "Could not set up library for lib-check phase"
          failed=true
        fi
      fi

      cd "$main_dir" && rm -rf "$tmp_dir"
      ;;
    "test-exts")
      print_green_with_status "Checking for test files that do not end in '.test.ts'..."
      offenders=$(find tests/unit tests/integration -type f -not -name "*.test.ts" -exec echo "- {}" \;)

      if [ -n "$offenders" ]; then
        print_error "The following test files do not end in '.test.ts':"
        print_error "$offenders"
        failed=true
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
        print_error "The following test suites do not match the test dir + file name:"
        print_error "$offenders"
        failed=true
      fi
      ;;
    "*")
      print_error "Invalid check type '$check_type'"
      exit 1
      ;;
  esac
done

if [ "$failed" = true ]; then
  print_error "$(tput bold)Checks failed :("
  exit 1
else
  print_green "Checks passed :)"
fi
