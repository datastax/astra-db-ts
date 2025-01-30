#!/usr/bin/env sh

script_dir=$(dirname "$0")

case "$1" in
  "-h" | "-help" | "--help")
    programs="glow mdcat mdless bat cat"

    for program in $programs; do
      if which "$program" > /dev/null 2>&1; then
        "$program" "$(dirname "$script_dir")/docs/$2.md"
        exit 0
      fi
    done
    ;;
  *)
    echo "Invalid option '$1'"
    echo
    echo "Use 'scripts/$2 -help' to see all available options/flags & examples of general usage for $2"
    exit 1
    ;;
esac
