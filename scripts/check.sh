#!/usr/bin/env sh

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
    *)
       if [ "$1" != "--help" ] && [ "$1" != "-help" ] && [ "$1" != "-h" ]; then
         echo "Invalid flag $1"
         echo
       fi
       echo "Usage:"
       echo
       echo "$0 [tc] [lint] [licensing]"
       echo
       echo "* tc: runs the type-checker"
       echo "* lint: checks for linting errors"
       echo "* licensing: checks for missing licensing headers"
       echo
       echo "Defaults to running all checks if no specific checks are specified."
       exit
  esac
  shift
done

if [ -z "$check_types" ]; then
  check_types="tc lint licensing"
fi

for check_type in $check_types; do
  case $check_type in
    "tc")
      echo "Running type-checker..."
      npx tsc --noEmit --skipLibCheck || exit 10
      ;;
    "lint")
      echo "Running linter..."
      npm run lint -- --no-warn-ignored || exit 20
      ;;
    "licensing")
      echo "Checking for missing licensing headers..."
      find tests/ src/ -type f -exec grep -L "^// Copyright DataStax, Inc." {} + || exit 30
      ;;
    "*")
      echo "Invalid check type '$check_type'"
      exit 1
      ;;
  esac
done
