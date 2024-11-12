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
sh scripts/build.sh -light || exit 2

if [ "$1" = "-stargate" ]; then
  export CLIENT_DB_ENVIRONMENT='dse'
  export CLIENT_DB_TOKEN='Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh'
  export CLIENT_DB_URL='http://localhost:8181'
fi

# Start the REPL w/ some utility stuff and stuff
node -i -e "
  require('./node_modules/dotenv/config');

  const $ = require('./dist');
  require('util').inspect.defaultOptions.depth = null;

  let client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT });
  let db = client.db(process.env.CLIENT_DB_URL);
  let dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT });

  const isAstra = process.env.CLIENT_DB_ENVIRONMENT === 'astra';

  if (!isAstra) {
    dbAdmin.createKeyspace('default_keyspace', { updateDbKeyspace: true });
  }

  let admin = (isAstra)
    ? client.admin()
    : null;

  let coll = db.collection('test_coll');
  let table = db.table('test_table');

  Object.defineProperty(this, 'cl', {
    get() {
      console.clear();
      return 'Cleared console';
    },
  });
"
