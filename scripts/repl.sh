#!/usr/bin/env sh

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# Make sure env vars present and such
if [ -z "$CLIENT_DB_TOKEN" ] || [ -z "$CLIENT_DB_TOKEN" ]; then
  echo "Missing CLIENT_DB_TOKEN and/or CLIENT_DB_TOKEN"
  exit 1
fi

# Rebuild the client (without types or any extra processing for speed)
sh scripts/build.sh -light -no-report || exit 2

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
    *)
      if [ "$1" != "--help" ] && [ "$1" != "-help" ] && [ "$1" != "-h" ]; then
        echo "Invalid flag $1"
        echo
      fi
      echo "Usage: sh scripts/repl.sh [-local] [-l | -logging]"
      echo
      echo "* -local: Sets the environment to 'hcd' and attempts to use a locally running stargate instance"
      echo "* -l | -logging: Logs helpful events to stdout"
      echo
      echo "Useful commands:"
      echo
      echo "cl: Clears the console"
      echo "cda: Deletes all documents in the test collection"
      echo "tda: Deletes all documents in the test table"
      echo "cfa: Finds all documents in the test collection"
      echo "tfa: Finds all documents in the test table"
      echo "cif(doc): Inserts a row into the test collection and returns the inserted document"
      echo "tif(row): Inserts a row into the test table and returns the inserted document"
      exit
  esac
  shift
done

# Start the REPL w/ some utility stuff and stuff
node -i -e "
  require('./node_modules/dotenv/config');

  const $ = require('./dist');
  const sp = require('synchronized-promise')
  require('util').inspect.defaultOptions.depth = null;

  let client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT, logging: [{ events: 'all', emits: 'event' }] });
  let db = client.db(process.env.CLIENT_DB_URL);
  let dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT });

  const isAstra = process.env.CLIENT_DB_ENVIRONMENT === 'astra';

  let admin = (isAstra)
    ? client.admin()
    : null;

  let coll = db.collection('test_coll');
  let table = db.table('test_table');

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
    get() {
      return sp(() => coll.deleteMany({}))();
    },
  });

  Object.defineProperty(this, 'tda', {
    get() {
      return sp(() => table.deleteMany({}))();
    },
  });

  Object.defineProperty(this, 'cfa', {
    get() {
      return sp(() => coll.find({}).toArray())();
    },
  });

  Object.defineProperty(this, 'tfa', {
    get() {
      return sp(() => table.find({}).toArray())();
    },
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
"
