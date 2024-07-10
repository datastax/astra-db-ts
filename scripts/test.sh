#!/usr/bin/sh

flag="$1"

if [ -n "$1" ]; then
  shift
fi

setup_colls="npx ts-mocha --paths -p tsconfig.json tests/prelude.ts > /dev/null"

test_cmd="$setup_colls && npx ts-mocha --paths -p tsconfig.json --recursive tests/unit tests/integration --extension .test.ts $*"

all_tests_cmd="env ASTRA_RUN_LONG_TESTS=1 ASTRA_RUN_ADMIN_TESTS=1 ASTRA_RUN_VECTORIZE_TESTS=1 $test_cmd"

light_tests_cmd="env ASTRA_RUN_LONG_TESTS=0 ASTRA_RUN_ADMIN_TESTS=0 ASTRA_RUN_VECTORIZE_TESTS=0 $test_cmd"

run_lint()
{
  npm run lint
}

run_tsc()
{
  npx tsc --noEmit --skipLibCheck
}

case "$flag" in
  "")
    eval "$test_cmd"
    ;;
  "--all")
    eval "$all_tests_cmd"
    ;;
  "--light")
    eval "$light_tests_cmd"
    ;;
  "--coverage")
    eval "npx nyc $all_tests_cmd -b"
    ;;
  "--types")
    run_tsc
    ;;
  "--prerelease")
    run_lint && run_tsc && eval eval "$all_tests_cmd -b --exit"
    ;;
  "--")
    eval "$test_cmd"
    ;;
  *)
    echo "Invalid flag (expecting --all|--light|--coverage|--types|--prerelease|--)"
    ;;
esac
