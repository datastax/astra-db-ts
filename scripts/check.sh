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
      npx tsc --noEmit > /dev/null

      if [ ! $? ]; then
        npx tsc --noEmit
        failed=true
      fi
      ;;
    "lint")
      print_green_with_status "Running linter..."
      npm run lint -- --no-warn-ignored > /dev/null

      if [ ! $? ]; then
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
    "test-ext")
      print_green_with_status "Checking for test files that do not end in '.test.ts'..."
      offenders=$(find tests/unit tests/integration -type f -not -name "*.test.ts")

      if [ -n "$offenders" ]; then
        print_error "The following test files do not end in '.test.ts':"
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
