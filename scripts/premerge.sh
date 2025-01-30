#!/bin/sh

example_deps_args="npm"
test_args="-b"

while [ $# -gt 0 ]; do
  case "$1" in
    "-build-args")
      shift
      build_args="$1"
      ;;
    "-test-args")
      shift
      test_args="$1"
      ;;
    "-check-args")
      shift
      check_args="$1"
      ;;
    "-example-deps-args")
      shift
      example_deps_args="$1"
      ;;
     *)
      sh scripts/utils/help.sh "$1" premerge.sh
      exit $?
      ;;
  esac
  shift
done

print_green() {
  echo "$(tput setaf 2)$(tput bold)$1$(tput sgr0)"
}

print_green "Building the project..." \
  && sh scripts/build.sh $build_args \
  && print_green "Project built successfully!" \
  && print_green "Checking the project..." \
  && sh scripts/check.sh $check_args \
  && print_green "Project checked successfully!" \
  && print_green "Running tests..." \
  && sh scripts/test.sh $test_args \
  && print_green "Tests passed!" \
  && print_green "Setting example deps to latest npm version..." \
  && sh scripts/update-example-client-dep.sh $example_deps_args \
  && print_green "Example deps set to latest npm version!" \
  || exit 1
