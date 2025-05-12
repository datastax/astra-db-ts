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
npx tsx scripts/build.ts -for-repl || exit 2

# Start the REPL w/ some utility stuff and stuff
node -i -e "
  require('./node_modules/dotenv/config');

  const $ = require('./dist/cjs/index.js');
  const sp = require('synchronized-promise');
  require('util').inspect.defaultOptions.depth = null;

  const bn = require('bignumber.js');
  const JBI = require('json-bigint');

  const fetchNative = new $.FetchNative()
  let fetchInfo;

  const fetcher = {
    fetch(info) {
      fetchInfo = info;
      return fetchNative.fetch(info);
    }
  }

  const cfg = {
    plusOutput: {
      _value: 'default',
      get verbose() {
        this._value = 'verbose';
        return 'Set plus output to \'verbose\'';
      },
      get default() {
        this._value = 'default';
        return 'Set plus output to \'default\'';
      },
      get minimal() {
        this._value = 'minimal';
        return 'Set plus output to \'minimal\'';
      },
    },
    logging: {
      _on: !!process.env.LOG_ALL_TO_STDOUT,
      get on() {
        this._on = true;
        return 'Enabled event logging';
      },
      get off() {
        this._on = false;
        return 'Disabled event logging';
      },
    },
    fa: {
      _projection: {
        '*': 1,
      },
      project(projection) {
        this._projection = projection;
        return 'Set *fa projection to ' + JSON.stringify(projection);
      },
    },
  };

  let client = new $.DataAPIClient(process.env.CLIENT_DB_TOKEN, { environment: process.env.CLIENT_DB_ENVIRONMENT, logging: [{ events: 'all', emits: 'event' }], httpOptions: { client: 'custom', fetcher } });
  let db = client.db(process.env.CLIENT_DB_URL, { keyspace: '$default_keyspace_name' });
  let dbAdmin = db.admin({ environment: process.env.CLIENT_DB_ENVIRONMENT });

  const isAstra = !process.env.CLIENT_DB_ENVIRONMENT || process.env.CLIENT_DB_ENVIRONMENT === 'astra';

  let admin = (isAstra)
    ? client.admin()
    : null;

  let coll = withLaxPropertyAccess(db.collection('$default_coll_name'));
  let coll_ = withLaxPropertyAccess(db.collection('$default_coll_name', { keyspace: 'other_keyspace', embeddingApiKey: process.env.TEST_OPENAI_KEY }));
  let table = withLaxPropertyAccess(db.table('$default_table_name'));
  let table_ = withLaxPropertyAccess(db.table('$default_table_name', { keyspace: 'other_keyspace', embeddingApiKey: process.env.TEST_OPENAI_KEY }));

  for (const event of ['commandSucceeded', 'adminCommandSucceeded', 'commandFailed', 'adminCommandFailed', /.*Warning/]) {
    client.on(event, (e) => cfg.logging._on && console.dir(e, { depth: null }));
  }

  Object.defineProperty(this, 'cl', {
    get() {
      console.clear();
      return 'Cleared console';
    },
  });

  for (const [pre, post, obj] of [
    ['c', '', coll],
    ['t', '', table],
    ['c', '_', coll_],
    ['t', '_', table_],
  ]) {
    Object.defineProperty(this, pre + 'da' + post, {
      get: sp(() => obj.deleteMany({})),
    });

    Object.defineProperty(this, pre + 'fa' + post, {
      get: sp(() => obj.find({}).project(cfg.fa._projection).toArray()),
    });

    Object.defineProperty(this, pre + 'if' + post, {
      value: sp(async (doc) => {
        const toInsert = (pre === 't')
          ? { text: $.UUID.v4().toString(), int: 0, ...doc }
          : doc;

        const { insertedId } = await obj.insertOne(toInsert);

        return (pre === 't')
          ? await obj.findOne(insertedId)
          : await obj.findOne({ _id: insertedId });
      }),
    });
  }

  const originalEmit = process.emit;

  process.emit = function (name, data, ...args) {
    if (name === 'warning' && typeof data === 'object' && data.name === 'DeprecationWarning') {
      return false;
    }
    return originalEmit.apply(process, arguments);
  };

  const { styleText } = require('node:util');

  Promise.prototype[Symbol.toPrimitive] = function() {
    let ok = 1;

    switch (cfg.plusOutput._value) {
      case 'default':
        sp(() => this
          .then((r) => {
             console.log(styleText('gray', '\nCommand:'));
             console.dir(JSON.parse(fetchInfo.body), { colors: true });
             console.log(styleText('gray', '\nResponse:'));
             console.dir(r, { colors: true });
             console.log(styleText('gray', '\nSuccess?:'));
          })
          .catch((e) => {
             ok = 0;
             console.log(styleText('gray', '\nCommand:'));
             console.dir(JSON.parse(fetchInfo.body), { colors: true });
             console.log(styleText('gray', '\nError - ' + e.name + ':'));
             console.log(styleText('red', e.message));
             console.log(styleText('gray', '\nSuccess?:'));
          }))();
        break;
      case 'verbose':
        sp(() => this
          .then((r) => {
             console.log(styleText('gray', '\nCommand:'));
             console.dir(JSON.parse(fetchInfo.body), { colors: true });
             console.log(styleText('gray', '\nResponse:'));
             console.dir(r, { colors: true });
             console.log(styleText('gray', '\nSuccess?:'));
          })
          .catch((e) => {
             ok = 0;
             console.log(styleText('gray', '\nCommand:'));
             console.dir(JSON.parse(fetchInfo.body), { colors: true });
             console.log(styleText('gray', '\nError:'));
             console.dir(e, { colors: true });
             console.log(styleText('gray', '\nSuccess?:'));
          }))();
        break;
      case 'minimal':
        sp(() => this
          .then((r) => {
             console.dir(r, { colors: true });
          })
          .catch((e) => {
             ok = 0;
             console.log(styleText('red', e.message));
          }))();
        break;
    }

    return ok;
  }

  function withLaxPropertyAccess(obj) {
    const props = [...Object.getOwnPropertyNames(Object.getPrototypeOf(obj)), ...Object.getOwnPropertyNames(obj)];

    return new Proxy(obj, {
      get(target, prop, receiver) {
        const matching = props
          .filter((k) => k.toLowerCase().startsWith(prop.toLowerCase()))
          .sort((a, b) => a.length - b.length);

        const value = target[matching[0] ?? prop];

        if (typeof value === 'function') {
          return value.bind(target);
        }

        return value;
      }
    });
  }
"
