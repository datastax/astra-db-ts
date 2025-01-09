#!/usr/bin/env sh

set -e

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# Define necessary commands
test_cmd="ts-mocha --paths -p tsconfig.json --recursive tests/prelude.test.ts tests/unit tests/integration tests/postlude.test.ts --extension .test.ts -t 0 --reporter tests/errors-reporter.cjs"

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
    *)
      if [ "$1" != "--help" ] && [ "$1" != "-help" ] && [ "$1" != "-h" ]; then
        echo "Invalid flag $1"
        echo
      fi
      echo "Usage:"
      echo
      echo "$0"
      echo " (1)  [-all | -light | -coverage]"
      echo " (2)  [-f/F <filter>]+"
      echo " (3)  [-g/G <regex>]+"
      echo " (4)  [-for]"
      echo " (5)  [-w/W <vectorize_whitelist>]"
      echo " (6)  [-b | -bail]"
      echo " (7)  [-R | -no-report]"
      echo " (8)  [-c <http_client>]"
      echo " (9)  [-e <environment>]"
      echo " (10) [-local]"
      echo " (11) [(-l | -logging) | (-L | -logging-with-pred)]"
      echo " (12) [-P | -skip-prelude]"
      echo
      echo "  $(tput setaf 4)(1)$(tput setaf 9) $(tput bold)Either run all tests, light tests, or coverage tests (defaults to 'all')$(tput sgr0)"
      echo
      echo "   '-all' runs all tests; '-light' runs tests without the LONG, ADMIN, or VECTORIZE tags; '-coverage' runs all tests with nyc coverage, and with '-bail' enabled."
      echo
      echo "  $(tput setaf 4)(2), (3)$(tput setaf 9) $(tput bold)Filter tests by substring or regex match$(tput sgr0)"
      echo
      echo "   A custom, more powerful implementation of Mocha's -f & -g flags."
      echo
      echo "   Requires a test's name, or any of its parent suites' names, to either contain the given text, or match the given regex (depending on the filter used)."
      echo
      echo "   No '-i' flag present; use '-F' or '-R' to invert any individual filter."
      echo
      echo "   May use each multiple times, intermixing the two types of filters."
      echo
      echo "  $(tput setaf 4)(4)$(tput setaf 9) $(tput bold)Use 'or' instead of 'and' for filter flags$(tput sgr0)"
      echo
      echo "   By default, when you run something like '$0 -f unit. -f http-client', it will run tests that match both 'unit.' and 'table.'. Use the '-for' flag to instead run all tests that match *either* filter."
      echo
      echo "  $(tput setaf 4)(5)$(tput setaf 9) $(tput bold)Filter which vectorize tests to run (defaults to '\$limit-per-model:1')$(tput sgr0)"
      echo
      echo "   There's a special filtering system just for vectorize tests, called the \"vectorize whitelist\", of which there are two different types."
      echo
      echo "   $(tput smul)* Regex filtering:$(tput rmul)"
      echo
      echo "   Every vectorize test is given a test name representing every branch it took to become that specific test. It is of the following format:"
      echo
      echo "   > 'providerName@modelName@authType@dimension'"
      echo "   > where dimension := 'specified' | 'default' | <some_number>"
      echo "   > where authType := 'header' | 'providerKey' | 'none'"
      echo
      echo "   Again, the regex only needs to match part of each test's name to succeed, so use '^$' as necessary."
      echo
      echo "   $(tput smul) Filter operators:$(tput rmul)"
      echo
      echo "   The vectorize test suite also defines some custom \"filter operators\" to provide filtering that can't be done through basic regex."
      echo
      echo "   They come of the format '-w \$<operator>:<colon_separated_args>':"
      echo
      echo "   > '\$limit:<number>' - This is a limit over the total number of vectorize tests, only running up to the specified amount"
      echo "   > '\$provider-limit:<number>' - This limits the amount of vectorize tests that can be run per provider"
      echo "   > '\$model-limit:<number>' - Akin to the above, but limits per model."
      echo
      echo "  $(tput setaf 4)(6)$(tput setaf 9) $(tput bold)Bail early on first test failure$(tput sgr0)"
      echo
      echo "   Simply sets the bail flag, as it does in Mocha. Forces the test script to exit after a single test failure."
      echo
      echo "  $(tput setaf 4)(7)$(tput setaf 9) $(tput bold)Disable test error reporting to \`./etc/test-reports$(tput sgr0)\`"
      echo
      echo "   By default, the test suite logs the complete error objects of any that may've been thrown during your tests to the \`./etc/test-reports\` directory for greatest debuggability. However, this can be disabled for a single test run using this flag."
      echo
      echo "  $(tput setaf 4)(8)$(tput setaf 9) $(tput bold)Set the http client to use for tests (defaults to 'default:http2')$(tput sgr0)"
      echo
      echo "   By default, tests are run w/ \`fetch-h2\` using HTTP/2, but you can specify a specific HTTP client, which is one of 'default:http1', 'default:http2', or 'fetch'."
      echo
      echo "  $(tput setaf 4)(9)$(tput setaf 9) $(tput bold)Set the database used for tests (defaults to 'astra')$(tput sgr0)"
      echo
      echo "   By default, the test suite assumes you're running on Astra, but you can specify the Data API environment through this flag, which should be one of 'dse', 'hcd', 'cassandra', or 'other'."
      echo
      echo "   You can also provide 'astra', but it wouldn't really do anything. But I'm not your boss or your mother; you can make your own big-boy/girl/other decisions, if you really want to."
      echo
      echo "   Not necessary if '-local' is set."
      echo
      echo "  $(tput setaf 4)(10)$(tput setaf 9) $(tput bold)Use local stargate for tests$(tput sgr0)"
      echo
      echo "   If you're running the tests on a local Stargate instance, you can use this flag to set the CLIENT_DB_URL to 'http://localhost:8080' and the CLIENT_DB_TOKEN to 'cassandra:cassandra' without needing to modify your .env file."
      echo
      echo "   Note that you'll still need to run stargate yourself. See \`scripts/start-stargate-4-tests.sh\`."
      echo
      echo "  $(tput setaf 4)(11)$(tput setaf 9) $(tput bold)Enable verbose logging for tests$(tput sgr0)"
      echo
      echo "   (\`-l\` is equal to \`-L '!isGlobal'\`)"
      echo
      echo "   Documentation TODO."
      echo
      echo "  $(tput setaf 4)(12)$(tput setaf 9) $(tput bold)Skip tests setup to save time (prelude.test.ts)$(tput sgr0)"
      echo
      echo "   By default, the test script will run a \"prelude\" script that sets up the database for the tests. This can be skipped to save some time, using this flag, if the DB is already setup (enough), and you just want to run some tests really quickly."
      exit
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
eval "$cmd_to_run"
