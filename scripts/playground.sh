#!/usr/bin/env sh

lib_dir=$(pwd)

while [ $# -gt 0 ]; do
  case "$1" in
    "-c" | "-create")
      action="create"
      name="$2"
      shift
      ;;
    "-d" | "-destroy")
      action="destroy"
      name="$2"
      shift
      ;;
    "-r" | "-run")
      action="run"
      name="$2"
      shift
      ;;
    *)
      sh scripts/utils/help.sh "$1" playground.sh
      exit $?
      ;;
  esac
  shift
done

if [ -z "$action" ]; then
  echo "Action (-c|-r|-d <playground>) is required. Use -help for more information."
  exit 1
fi

dir=etc/playgrounds/"$name"

case "$action" in
create)
  if [ -d "$dir" ]; then
    echo "Playground '$name' already exists; do you want to delete and recreate it? [y/N]"
    read -r response

    if [ "$response" != "y"  ]; then
      exit 1
    fi

    rm -rf "$dir"
  fi

  scripts/build.sh

  mkdir -p "$dir"
  cd "$dir" || exit 1

  npm init -y
  npm i -D typescript tsx dotenv
  cp ../../../tsconfig.json .

  npm i "$lib_dir"

  echo "import * as $ from '@datastax/astra-db-ts';
import dotenv from 'dotenv';

dotenv.configDotenv({ path: '../../../.env' });

const client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT as any });
const db = client.db(process.env.CLIENT_DB_URL!);
const admin = client.admin();
const dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT as any });
const coll = db.collection('test_coll');
const table = db.table('test_table');

(async () => {

})();" > index.ts
  ;;
destroy)
  if [ ! -d "$dir" ]; then
    echo "Playground '$2' not found"
    exit 1
  fi

  rm -rf "$dir"
  ;;
run)
  if [ ! -d "$dir" ]; then
    echo "Playground '$1' not found"
    exit 1
  fi

  cd etc/playgrounds/"$1" || exit 1
  npx tsx index.ts
esac
