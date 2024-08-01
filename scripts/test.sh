#!/usr/bin/sh

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# Define necessary commands
test_cmd="npx ts-mocha --paths -p tsconfig.json --recursive tests/prelude.test.ts tests/unit tests/integration tests/postlude.test.ts --extension .test.ts -t 0 --reporter tests/errors-reporter.cjs"

run_lint_cmd="npm run lint"

run_tsc_cmd="npx tsc --noEmit --skipLibCheck"

# Counter to make sure test type isn't set multiple times
test_type_set=0

# Process all of the flags
while [ $# -gt 0 ]; do
  for test_type_flag in -all -light -coverage -code; do
    [ "$1" = "$test_type_flag" ] && test_type_set=$((test_type_set + 1))
  done

  if [ "$test_type_set" -gt 1 ]; then
    echo "Can't set multiple of -all, -light, -coverage, and -code"
    exit 1
  fi

  case "$1" in
    "-all")
      test_type="all"
      ;;
    "-light")
      test_type="light"
      ;;
    "-coverage")
      test_type="coverage"
      ;;
    "-code")
      test_type="code"
      ;;
    "-f" | "~f")
      [ "${1#"~"}" != "$1" ] && filter_type='i' || filter_type='n'
      shift
      filter="f$filter_type\"$1\" $filter"
      ;;
    "-g" | "~g")
      [ "${1#"~"}" != "$1" ] && filter_type='i' || filter_type='n'
      shift
      filter="g$filter_type\"$1\" $filter"
      ;;
    "-fand")
      filter_combinator='and'
      ;;
    "-for")
      filter_combinator='or'
      ;;
    "-b")
      bail_early=1
      ;;
    "~report")
      no_err_report=1
      ;;
    "-w" | "~w")
      [ "${1#"~"}" != "$1" ] && invert_whitelist=1
      shift
      whitelist="$1"
      ;;
    *)
      echo "Invalid flag $1"
      echo ""
      echo "Usage:"
      echo "npm run test -- [-all | -light | -coverage] [-fand | -for] [-/~f <filter>]+ [-/~g <regex>]+ [-/~w <vectorize_whitelist>] [-b] [~report]"
      echo "or"
      echo "npm run test -- <-code>"
      exit
      ;;
  esac
  shift
done

# Ensure the flags are compatible with each other
if [ "$test_type" = "code" ] && { [ -n "$bail_early" ] || [ -n "$filter" ] || [ -n "$filter_combinator" ] || [ -n "$whitelist" ] || [ -n "$no_err_report" ]; }; then
  echo "Can't use a filter, bail, whitelist flags when typechecking/linting"
  exit 1
fi

# Build the actual command to run
case "$test_type" in
  "")
    cmd_to_run="$test_cmd"
    ;;
  "all")
    export CLIENT_RUN_VECTORIZE_TESTS=1 CLIENT_RUN_LONG_TESTS=1 CLIENT_RUN_ADMIN_TESTS=1
    cmd_to_run="$test_cmd"
    ;;
  "light")
    export CLIENT_RUN_VECTORIZE_TESTS='' CLIENT_RUN_LONG_TESTS='' CLIENT_RUN_ADMIN_TESTS=''
    cmd_to_run="$test_cmd"
    ;;
  "coverage")
    export CLIENT_RUN_VECTORIZE_TESTS=1 CLIENT_RUN_LONG_TESTS=1 CLIENT_RUN_ADMIN_TESTS=1
    cmd_to_run="npx nyc $test_cmd -b"
    ;;
  "code")
    cmd_to_run="$run_tsc_cmd ; $run_lint_cmd"
    ;;
esac

if [ -n "$filter" ]; then
  # Drops trailing space to make filter symmetrical
  export CLIENT_TESTS_FILTER="${filter% }"
fi

if [ -n "$filter_combinator" ]; then
  export CLIENT_TESTS_FILTER_COMBINATOR="$filter_combinator"
fi

if [ -n "$bail_early" ]; then
  cmd_to_run="$cmd_to_run -b"
fi

if [ -n "$no_err_report" ]; then
  export CLIENT_NO_ERROR_REPORT=1
fi

# Get embedding providers, if desired, to build the vectorize part of the command
if [ -n "$CLIENT_RUN_VECTORIZE_TESTS" ] && [ "$test_type" != 'code' ]; then
  CLIENT_VECTORIZE_PROVIDERS=$(bash scripts/list-embedding-providers.sh | jq -c)

  export CLIENT_VECTORIZE_PROVIDERS

  if [ -n "$whitelist" ]; then
    export CLIENT_VECTORIZE_WHITELIST="$whitelist"
  fi

  if [ -n "$invert_whitelist" ]; then
    export CLIENT_VECTORIZE_WHITELIST_INVERT=1
  fi
fi

# Run it
echo "$cmd_to_run"
eval "$cmd_to_run"
