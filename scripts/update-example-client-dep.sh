#!/usr/bin/env sh

# Convenience script which auto-updates the `astra-db-ts` dependencies in all of the examples/ to use either:
# - the local astra-db-ts for testing purposes (which should always be reverted before merging)
# - the npm-published astra-db-ts so it can actually be used by normal people

# Saves the current absolute file path
cwd=$(pwd)

case "$1" in
npm)
  # Change dependencies to use the latest version on npm
  for dir in examples/*; do
    cd "$cwd/$dir" || exit 1
    npm rm @datastax/astra-db-ts
    npm i @datastax/astra-db-ts
  done
  ;;
local)
  # Creates a single tarball file to install in all of the examples
  tarball_dir=$(pwd)
  npm run build
  npm pack

  dirs="$2"

  if [ -z "$dirs" ]; then
    dirs="examples/*"
  fi

  # Does said installation
  for dir in $dirs; do
    if [ ! -d "$dir" ]; then
      echo "Directory $dir does not exist"
      continue
    fi
    cd "$cwd/$dir" || exit 1
    npm i "${tarball_dir}"/datastax-astra-db-ts-*.tgz
    npm i @datastax/astra-db-ts
  done

  # Cleanup (tarball no longer required)
  rm "${tarball_dir}"/datastax-astra-db-ts-*.tgz
  ;;
*)
  echo 'Invalid args-must pass either "npm" or "local"'
  ;;
esac
