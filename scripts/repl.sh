#!/usr/bin/sh

# Properly sources the .env file to bring env variables into scope
if [ -f .env ]; then
  eval "$(tr -d '\r' < .env)"
fi

# Make sure env vars present and such
if [ -z "$CLIENT_DB_TOKEN" ] || [ -z "$CLIENT_DB_TOKEN" ]; then
  echo "Missing CLIENT_DB_TOKEN and/or CLIENT_DB_TOKEN"
  exit 1
fi

# If not built already, build the client
if [ ! -d "dist" ]; then
  sh scripts/build.sh || exit 2
fi

# Start the REPL w/ some utility stuff and stuff
node -i -e "
  require('./node_modules/dotenv').config();

  const $ = require('./dist');

  let client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT });
  let db = client.db(process.env.CLIENT_DB_URL);
  let admin = client.admin();
  let dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT });

  Object.defineProperty(this, 'cl', {
    get() {
      console.clear();
      return 'Cleared console';
    },
  });
"
