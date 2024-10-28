#!/usr/bin/env sh

tarball_dir=$(pwd)

case "$1" in
build)
  if [ -z "$2" ]; then
    echo "Usage: $0 build <name>"
    exit 1
  fi

  npm run build
  npm pack

  rm -rf etc/playgrounds/"$2"
  mkdir -p etc/playgrounds/"$2"
  cd etc/playgrounds/"$2" || exit 1

  npm init -y
  npm i -D typescript tsx dotenv
  cp ../../../tsconfig.json .

  npm i "${tarball_dir}"/datastax-astra-db-ts-*.tgz
  rm "${tarball_dir}"/datastax-astra-db-ts-*.tgz

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
update)
  if [ -z "$2" ]; then
    echo "Usage: $0 update <name>"
    exit 1
  fi

  if [ ! -d etc/playgrounds/"$2" ]; then
    echo "Playground '$2' not found"
    exit 1
  fi

  npm run build
  npm pack

  cd etc/playgrounds/"$2" || exit 1

  npm i "${tarball_dir}"/datastax-astra-db-ts-*.tgz
  rm "${tarball_dir}"/datastax-astra-db-ts-*.tgz
  ;;
destroy)
  if [ -z "$2" ]; then
    echo "Usage: $0 destroy <name>"
    exit 1
  fi

  if [ ! -d etc/playgrounds/"$2" ]; then
    echo "Playground '$2' not found"
    exit 1
  fi

  rm -rf etc/playgrounds/"$2"
  ;;
*)
  if [ -z "$1" ]; then
    echo "Usage: $0 <name>"
    exit 1
  fi

  if [ ! -d etc/playgrounds/"$1" ]; then
    echo "Playground '$1' not found"
    exit 1
  fi

  cd etc/playgrounds/"$1" || exit 1
  npx tsx index.ts
esac
