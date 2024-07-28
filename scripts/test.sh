#!/usr/bin/sh

# Define necessary commands
test_cmd="npx ts-mocha --paths -p tsconfig.json --recursive tests/prelude.test.ts tests/unit tests/integration tests/postlude.test.ts --extension .test.ts -t 90000 --reporter tests/errors-reporter.cjs"

all_tests_cmd="CLIENT_RUN_LONG_TESTS=1 CLIENT_RUN_ADMIN_TESTS=1 CLIENT_RUN_VECTORIZE_TESTS=1 $test_cmd"

light_tests_cmd="CLIENT_RUN_LONG_TESTS= CLIENT_RUN_ADMIN_TESTS= CLIENT_RUN_VECTORIZE_TESTS= $test_cmd"

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
    "-f" | "~f")
      [ "${1#"~"}" != "$1" ] && invert_filter=1
      shift
      filter="$1"
      ;;
    "-g" | "~g")
      [ "${1#"~"}" != "$1" ] && invert_filter=1
      shift
      regex="$1"
      ;;
    "-b")
      bail_early=1
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
      echo "npm run test -- [--all | --light | --coverage | --prerelease] [-f <filter> | -g <regex>] [-i] [-w <vectorize_whitelist>] [-b]"
      echo "or"
      echo "npm run test -- <--types>"
      exit
      ;;
  esac
  shift
done

# Ensure the flags are compatible with each other
if [ "$test_type" = '--types' ] && { [ -n "$bail_early" ] || [ -n "$filter" ] || [ -n "$regex" ] || [ -n "$filter_invert" ] || [ -n "$whitelist" ]; }; then
  echo "Can't use a filter, bail, whitelist flags when typechecking"
  exit
fi

if [ -n "$filter" ] && [ -n "$regex" ]; then
  echo "Can't have both a 'filter' and a 'regex' flag"
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
  cmd_to_run="CLIENT_TESTS_FILTER='$filter' CLIENT_TESTS_FILTER_TYPE='match' $cmd_to_run"
fi

if [ -n "$regex" ]; then
  cmd_to_run="CLIENT_TESTS_FILTER='$regex' CLIENT_TESTS_FILTER_TYPE='regex' $cmd_to_run"
fi

if [ -n "$invert_filter" ]; then
  cmd_to_run="CLIENT_TESTS_FILTER_INVERT=1 $cmd_to_run"
fi

if [ -n "$bail_early" ]; then
  cmd_to_run="$cmd_to_run -b"
fi

if [ -n "$whitelist" ]; then
  cmd_to_run="CLIENT_VECTORIZE_WHITELIST='$whitelist' $cmd_to_run"
fi

if [ -n "$invert_whitelist" ]; then
  cmd_to_run="CLIENT_VECTORIZE_WHITELIST_INVERT=1 $cmd_to_run"
fi

# Run it
echo "$cmd_to_run"
eval "$cmd_to_run"
