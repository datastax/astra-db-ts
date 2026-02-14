#!/usr/bin/env sh

set -e

lib_dir=$(pwd)
install_pkgs=""

while [ $# -gt 0 ]; do
  case "$1" in
    "create" | "destroy" | "show" | "run")
      action="$1"
      name="$2"
      shift
      ;;
    "-i" | "--install")
      if [ "$action" != "create" ]; then
        echo "The -i/--install option is only valid with the create action."
        exit 1
      fi
      install_pkgs="$2"
      shift
      ;;
    "list")
      action="$1"
      ;;
    *)
      sh scripts/utils/help.sh "$1" playground.sh
      exit $?
      ;;
  esac
  shift
done

if [ -z "$action" ]; then
  echo "Action ((create|destroy|show|run <playground>) | (list)) is required. Use -help for more information."
  exit 1
fi

if [ "$action" = "list" ]; then
  ls -1 etc/playgrounds
  exit 0
fi

dir=etc/playgrounds/"$name"

if [ "$action" = "create" ]; then
  if [ -d "$dir" ]; then
    echo "Playground '$name' already exists; do you want to delete and recreate it? [y/N]"
    read -r response

    if [ "$response" != "y"  ]; then
      exit 1
    fi

    rm -rf "$dir"
  fi

  npx tsx scripts/build.ts

  mkdir -p "$dir"
  cd "$dir" || exit 1

  npm init -y
  npm i -D typescript tsx dotenv
  cp ../../../tsconfig.json .

  npm i "$lib_dir"

  echo "import * as $ from '@datastax/astra-db-ts';
import { dotenv } from 'zx';

dotenv.config('../../../.env');

const client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT as any });
const db = client.db(process.env.CLIENT_DB_URL!);
const admin = client.admin();
const dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT as any });
const coll = db.collection('test_coll');
const table = db.table('test_table');

(async () => {

})();" > index.ts

  for pkg in $(echo "$install_pkgs" | sed "s/,/ /g"); do
    if [ "$pkg" = "dotenv" ]; then
      echo "dotenv is already installed."
    else
      npm i "$pkg"
    fi
  done

  echo "Playground '$name' created."
  exit 0
fi

if [ ! -d "$dir" ]; then
  set -- etc/playgrounds/"$name"*

  if [ "$1" = "etc/playgrounds/$name*" ]; then
    echo "No playground found for '$name'. Choose one of the following:"
    sh "$0" list
    exit 1
  fi

  if [ "$#" -gt 1 ]; then
    echo "Multiple playgrounds found for '$name'. Please specify one of the following:"

    for d in "$@"; do
      echo "- $(basename "$d")"
    done

    exit 1
  fi

  dir=$1
fi

case "$action" in
show)
  if which bat > /dev/null; then
    bat "$dir"/*.ts
  else
    cat "$dir"/*.ts
  fi
  ;;
destroy)
  rm -rf "$dir"
  ;;
run)
  cd "$dir" || exit 1
  npx tsx index.ts
esac
