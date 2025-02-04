#!/usr/bin/env sh

dirs="examples/*/"

lib_dir=$(pwd)
tar_dir=examples/astra-db-ts.tgz

while [ $# -gt 0 ]; do
  case "$1" in
    "tar")
      mode="tar"
      ;;
    "sym")
      mode="sym"
      ;;
    "-d" | "-dirs")
      dirs="$2"
      shift
      ;;
    *)
      sh scripts/utils/help.sh "$1" set-example-client-deps.sh
      exit $?
      ;;
  esac
  shift
done

if [ -z "$mode" ]; then
  echo "Mode (tar|sym) is required. Use -help for more information."
  exit 1
fi

for dir in $dirs; do
  if [ ! -d "$dir" ]; then
    echo "Directory $dir does not exist"
    exit 1
  fi

  if [ "$(dirname "$dir")" != "examples" ]; then
    echo "Directory must be in the examples/ folder"
    exit 1
  fi
done

if ! scripts/build.sh; then
  exit 1
fi

if [ "$mode" = "tar" ]; then
  npm pack
  mv datastax-astra-db-ts-*.tgz "$tar_dir"
else
  rm "$tar_dir"
fi

for dir in $dirs; do
  cd "$dir" || exit 1

  npm rm @datastax/astra-db-ts

  if [ "$mode" = "tar" ]; then
    npm i ../astra-db-ts.tgz
  else
    npm i "$lib_dir"
  fi

  cd - || exit 1
done
