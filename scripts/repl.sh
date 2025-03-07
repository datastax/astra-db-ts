#!/usr/bin/env sh

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

default_coll_name='test_coll'
default_table_name='test_table'
default_keyspace_name='default_keyspace'

while [ $# -gt 0 ]; do
  case "$1" in
    "-local")
      export CLIENT_DB_ENVIRONMENT='hcd'
      export CLIENT_DB_TOKEN='Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh'
      export CLIENT_DB_URL='http://localhost:8181'
      ;;
    "-l" | "-logging")
      export LOG_ALL_TO_STDOUT=true
      ;;
    "-c" | "-coll-name")
      default_coll_name="$2"
      shift
      ;;
    "-t" | "-table-name")
      default_table_name="$2"
      shift
      ;;
    "-k" | "-keyspace-name")
      default_keyspace_name="$2"
      shift
      ;;
     *)
      sh scripts/utils/help.sh "$1" repl.sh
      exit $?
      ;;
  esac
  shift
done

# Make sure env vars present and such
if [ -z "$CLIENT_DB_TOKEN" ] || [ -z "$CLIENT_DB_TOKEN" ]; then
  echo "Missing CLIENT_DB_TOKEN and/or CLIENT_DB_TOKEN"
  exit 1
fi

# Rebuild the client (without types or any extra processing for speed)
sh scripts/build.sh -for-repl || exit 2

# Start the REPL w/ some utility stuff and stuff
node -i -e "
  require('./node_modules/dotenv/config');

  const $ = require('./dist/cjs/index.js');
  const sp = require('synchronized-promise');
  require('util').inspect.defaultOptions.depth = null;

  const bn = require('bignumber.js');
  const JBI = require('json-bigint');

  let client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT, logging: [{ events: 'all', emits: 'event' }] });
  let db = client.db(process.env.CLIENT_DB_URL, { keyspace: '$default_keyspace_name' });
  let dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT });

  const isAstra = !process.env.CLIENT_DB_ENVIRONMENT || process.env.CLIENT_DB_ENVIRONMENT === 'astra';

  let admin = (isAstra)
    ? client.admin()
    : null;

  let coll = db.collection('$default_coll_name');
  let table = db.table('$default_table_name');

  if (process.env.LOG_ALL_TO_STDOUT) {
    for (const event of ['commandSucceeded', 'adminCommandSucceeded', 'commandFailed', 'adminCommandFailed']) {
      client.on(event, (e) => console.dir(e, { depth: null }));
    }
  }

  Object.defineProperty(this, 'cl', {
    get() {
      console.clear();
      return 'Cleared console';
    },
  });

  Object.defineProperty(this, 'cda', {
    get: sp(() => coll.deleteMany({})),
  });

  Object.defineProperty(this, 'tda', {
    get: sp(() => table.deleteMany({})),
  });

  Object.defineProperty(this, 'cfa', {
    get: sp(() => coll.find({}).toArray()),
  });

  Object.defineProperty(this, 'tfa', {
    get: sp(() => table.find({}).toArray()),
  });

  const cif = sp(async (doc) => {
    const { insertedId } = await coll.insertOne(doc);
    return await coll.findOne({ _id: insertedId });
  });

  const tif = sp(async (row) => {
    row = { text: $.UUID.v4().toString(), int: 0, ...row };
    await table.insertOne(row);
    return await table.findOne({ text: row.text, int: row.int });
  });

  const originalEmit = process.emit;

  process.emit = function (name, data, ...args) {
    if (name === 'warning' && typeof data === 'object' && data.name === 'DeprecationWarning') {
      return false;
    }
    return originalEmit.apply(process, arguments);
  };

  Promise.prototype[Symbol.toPrimitive] = function() {
    let ok = 1;
    console.dir(sp(() => this.catch(e => (ok = 0, e)))(), { colors: true });
    return ok;
  }
"
