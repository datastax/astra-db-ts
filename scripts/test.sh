#!/usr/bin/env sh

set -e

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# Define necessary commands
test_cmd="mocha --import=tsx/esm -r tsconfig-paths --recursive tests/prelude.test.ts tests/unit tests/integration tests/postlude.test.ts --extension .test.ts -t 0 --reporter tests/errors-reporter.cjs --exit "

# Counter to make sure test type isn't set multiple times
test_type_set=0

# Process all of the flags
while [ $# -gt 0 ]; do
  for test_type_flag in -all -light -coverage; do
    [ "$1" = "$test_type_flag" ] && test_type_set=$((test_type_set + 1))
  done

  if [ "$test_type_set" -gt 1 ]; then
    echo "Can't set multiple of -all, -light, -coverage"
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
      bail_early=1
      ;;
    "-f" | "-F")
      [ "$1" = "-F" ] && filter_type='i' || filter_type='n'
      shift
      filter="f$filter_type\"$1\" $filter"
      ;;
    "-g" | "-G")
      [ "$1" = "-G" ] && filter_type='i' || filter_type='n'
      shift
      filter="g$filter_type\"$1\" $filter"
      ;;
    "-u")
      filter="f$filter_type\"unit.\" $filter"
      test_type="light"
      ;;
    "-fand")
      filter_combinator='and'
      ;;
    "-for")
      filter_combinator='or'
      ;;
    "-b" | "-bail")
      bail_early=1
      ;;
    "-R" | "-no-report")
      no_err_report=1
      ;;
    "-w" | "-W")
      [ "$1" = "-W" ] && invert_whitelist=1
      shift
      whitelist="$1"
      ;;
    "-c")
      shift
      http_client="$1"
      ;;
    "-e")
      shift
      environment="$1"
      ;;
    "-l" | "-logging")
      logging="!isGlobal"
      ;;
    "-L" | "-logging-with-pred")
      shift
      logging="$1"
      ;;
    "-P" | "-skip-prelude")
      skip_prelude=1
      ;;
    "-local")
      local=1
      ;;
    "-watch")
      test_type="light"
      watch=1
      ;;
     *)
      sh scripts/utils/help.sh "$1" test.sh
      exit $?
      ;;
  esac
  shift
done

# Build the actual command to run
case "$test_type" in
  "" | "all")
    export CLIENT_RUN_VECTORIZE_TESTS=1 CLIENT_RUN_LONG_TESTS=1 CLIENT_RUN_ADMIN_TESTS=1
    cmd_to_run="npx $test_cmd"
    ;;
  "light")
    export CLIENT_RUN_VECTORIZE_TESTS='' CLIENT_RUN_LONG_TESTS='' CLIENT_RUN_ADMIN_TESTS=''
    cmd_to_run="npx $test_cmd"
    ;;
  "coverage")
    export CLIENT_RUN_VECTORIZE_TESTS=1 CLIENT_RUN_LONG_TESTS=1 CLIENT_RUN_ADMIN_TESTS=1
    cmd_to_run="npx nyc $test_cmd"
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

if [ -n "$http_client" ]; then
  export CLIENT_TEST_HTTP_CLIENT="$http_client"
fi

if [ -n "$environment" ]; then
  export CLIENT_DB_ENVIRONMENT="$environment"
fi

if [ -n "$local" ]; then
  export USING_LOCAL_STARGATE=1
fi

if [ -n "$logging" ]; then
  export LOGGING_PRED="$logging"
fi

if [ -n "$skip_prelude" ]; then
  export SKIP_PRELUDE=1
fi

if [ -n "$watch" ]; then
  cmd_to_run="$cmd_to_run --watch --watch-files 'tests/**/*.test.ts'"

  if [ -z "$filter" ]; then
    echo "A filter must be used with watch mode to prevent accidentally running all tests. '-f unit.' at the very least is highly recommended."
    exit 1
  fi
fi

# Get embedding providers, if desired, to build the vectorize part of the command
if [ -n "$CLIENT_RUN_VECTORIZE_TESTS" ] && [ "$test_type" != 'code' ]; then
  CLIENT_VECTORIZE_PROVIDERS=$(bash scripts/utils/list-embedding-providers.sh | jq -c)

  export CLIENT_VECTORIZE_PROVIDERS

  if [ -n "$whitelist" ]; then
    export CLIENT_VECTORIZE_WHITELIST="$whitelist"
  fi

  if [ -n "$invert_whitelist" ]; then
    export CLIENT_VECTORIZE_WHITELIST_INVERT=1
  fi
fi

export CLIENT_DYNAMIC_JS_ENV_CHECK=1

# Run it
eval "$cmd_to_run"
