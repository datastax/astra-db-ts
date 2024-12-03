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
  esac
  shift
done

# Start the REPL w/ some utility stuff and stuff
node -i -e "
  require('./node_modules/dotenv/config');

  const $ = require('./dist');
  require('util').inspect.defaultOptions.depth = null;

  (async () => {
    try {
      let client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT, logging: [{ events: 'all', emits: 'event' }] });
      let db = client.db(process.env.CLIENT_DB_URL);
      let dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT });

      const isAstra = process.env.CLIENT_DB_ENVIRONMENT === 'astra';

      if (!isAstra) {
        await dbAdmin.createKeyspace('default_keyspace', { updateDbKeyspace: true });
      }

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
    } catch (e) {
      console.error(e);
      console.error('Failed to initialize client');
      console.error('...');
      console.error('...');
      console.error('...');
      console.error('Running in fallback mode');
    }
  })();

  Object.defineProperty(this, 'cl', {
    get() {
      console.clear();
      return 'Cleared console';
    },
  });
"
