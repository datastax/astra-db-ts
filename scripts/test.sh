#!/usr/bin/sh

# Define necessary commands
test_cmd="npx ts-mocha --paths -p tsconfig.json --recursive tests/prelude.test.ts tests/unit tests/integration --extension .test.ts"

all_tests_cmd="env ASTRA_RUN_LONG_TESTS=1 ASTRA_RUN_ADMIN_TESTS=1 ASTRA_RUN_VECTORIZE_TESTS=1 $test_cmd"

light_tests_cmd="env ASTRA_RUN_LONG_TESTS=0 ASTRA_RUN_ADMIN_TESTS=0 ASTRA_RUN_VECTORIZE_TESTS=0 $test_cmd"

run_lint_cmd="npm run lint"

run_tsc_cmd="npx tsc --noEmit --skipLibCheck"

# Counter to make sure test type isn't set multiple times
test_type_set=0

# Process all of the flags
while [ $# -gt 0 ]; do
  for test_type_flag in --all --light --coverage --types --prerelease; do
    [ "$1" = "$test_type_flag" ] && test_type_set=$((test_type_set + 1))
  done

  if [ "$test_type_set" -gt 1 ]; then
    echo "Can't set multiple of --all, --light, --coverage, --types, and --prerelease"
    exit
  fi

  case "$1" in
    "--all")
      test_type="all"
      ;;
    "--light")
      test_type="light"
      ;;
    "--coverage")
      test_type="coverage"
      ;;
    "--types")
      test_type="types"
      ;;
    "--prerelease")
      test_type="prerelease"
      ;;
    "-f")
      shift
      filter="$1"
      ;;
    "-b")
      bail_early=1
      ;;
    "--args")
      shift
      raw_args="$1"
      ;;
    *)
      echo "Invalid flag (expecting --all|--light|--coverage|--types|--prerelease|-f <filter>|-b|--args <args>)"
      ;;
  esac
  shift
done

# Ensure the flags are compatible with each other
if [ "$test_type" = '--types' ] && { [ -n "$bail_early" ] || [ -n "$filter" ] || [ -n "$raw_args" ]; }; then
  echo "Can't use a filter, bail, or args flag when typechecking"
  exit
fi

# Build the actual command to run
case "$test_type" in
  "")
    cmd_to_run="$test_cmd"
    ;;
  "all")
    cmd_to_run="$all_tests_cmd"
    ;;
  "light")
    cmd_to_run="$light_tests_cmd"
    ;;
  "coverage")
    cmd_to_run="npx nyc $all_tests_cmd -b"
    ;;
  "types")
    cmd_to_run="$run_tsc_cmd"
    ;;
  "prerelease")
    cmd_to_run="$run_lint_cmd && $run_tsc_cmd && $all_tests_cmd -b --exit"
    ;;
esac

if [ -n "$filter" ]; then
  cmd_to_run="$cmd_to_run -f '$filter'"
fi

if [ -n "$bail_early" ]; then
  cmd_to_run="$cmd_to_run -b"
fi

if [ -n "$raw_args" ]; then
  cmd_to_run="$cmd_to_run $raw_args"
fi

# Run it
eval "$cmd_to_run"
