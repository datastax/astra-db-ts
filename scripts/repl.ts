#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Opts } from './utils/arg-parse.js';
import { Step, Steps } from './utils/steps.js';
import 'dotenv/config';

const opts = new Opts('repl.ts')
  .real({
    Local: [['-local'], 'boolean', false],
    Logging: [['-l', '-logging'], 'boolean', false],
    CollName: [['-c', '-coll-name'], 'string', 'test_coll'],
    TableName: [['-t', '-table-name'], 'string', 'test_table'],
    KeyspaceName: [['-k', '-keyspace-name'], 'string', 'default_keyspace'],
    Exec: [['-e', '-exec'], 'string', undefined],
    NoBuild: [['-B', '-no-build'], 'boolean', false],
  })
  .parse();

if (opts.Local) {
  process.env.CLIENT_DB_ENVIRONMENT = 'hcd';
  process.env.CLIENT_DB_TOKEN = 'Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh';
  process.env.CLIENT_DB_URL = 'http://localhost:8181';
}

if (!process.env.CLIENT_DB_TOKEN || !process.env.CLIENT_DB_URL) {
  console.error('Missing CLIENT_DB_TOKEN and/or CLIENT_DB_URL');
  process.exit(1);
}

await new Steps()
  .do(SetupConfig(), {
    spinner: 'Setting up config...',
  })
  .if(!opts.NoBuild, BuildClient(), {
    spinner: 'Building the client...',
  })
  .do(LaunchRepl())
  .run();

interface Config {
  token: string,
  url: string,
  env: string,
  embeddingApiKey?: string,
}

function SetupConfig(): Step<never, Config> {
  return async () => {
    if (opts.Local) {
      return {
        token: 'Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh',
        url: 'http://localhost:8181',
        env: 'hcd',
        embeddingApiKey: process.env.CLIENT_EMBEDDING_API_KEY,
      }
    }

    if (!process.env.CLIENT_DB_TOKEN || !process.env.CLIENT_DB_URL) {
      console.error('Missing CLIENT_DB_TOKEN and/or CLIENT_DB_URL');
      process.exit(1);
    }

    return {
      token: process.env.CLIENT_DB_TOKEN,
      url: process.env.CLIENT_DB_URL,
      env: process.env.CLIENT_DB_ENVIRONMENT || 'astra',
      embeddingApiKey: process.env.CLIENT_EMBEDDING_API_KEY,
    }
  };
}

function BuildClient(): Step {
  return async () => {
    try {
      await $`npx tsx scripts/build.ts -for-repl`.quiet();
    } catch (error) {
      console.error(chalk.red('Failed to build the client'));
      process.exit(2);
    }
  };
}

function LaunchRepl(): Step<Config> {
  return async (cfg) => {
    const replScript = _buildReplScript(cfg);

    if (opts.Exec) {
      const execScript = _buildExecScript(opts.Exec);
      await $({ stdio: 'inherit' })`node -e ${replScript + '\n' + execScript}`;
    } else {
      await $({ stdio: 'inherit' })`node -i -e ${replScript}`;
    }
  };

  function _buildExecScript(script: string): string {
    return `(async () => { const r = (${script}); console.log(r instanceof Promise ? await r : r); })();`
  }

  function _buildReplScript(cfg: Config): string {
    return `
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
            return 'Set plus output to \\'verbose\\'';
          },
          get default() {
            this._value = 'default';
            return 'Set plus output to \\'default\\'';
          },
          get minimal() {
            this._value = 'minimal';
            return 'Set plus output to \\'minimal\\'';
          },
        },
        logging: {
          _on: ${opts.Logging},
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

      let client = new $.DataAPIClient('${cfg.token}', { environment: '${cfg.env}', logging: [{ events: 'all', emits: 'event' }], httpOptions: { client: 'custom', fetcher } });
      let db = client.db('${cfg.url}', { keyspace: '${opts.KeyspaceName}' });
      let dbAdmin = db.admin({ environment: '${cfg.env}' });

      const isAstra = '${cfg.env}' === 'astra';

      let admin = (isAstra)
        ? client.admin()
        : null;

      let coll = withLaxPropertyAccess(db.collection('${opts.CollName}'));
      let coll_ = withLaxPropertyAccess(db.collection('${opts.CollName}', { keyspace: 'other_keyspace', embeddingApiKey: '${cfg.embeddingApiKey}' }));
      let table = withLaxPropertyAccess(db.table('${opts.TableName}'));
      let table_ = withLaxPropertyAccess(db.table('${opts.TableName}', { keyspace: 'other_keyspace', embeddingApiKey: '${cfg.embeddingApiKey}' }));

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
                 console.log(styleText('gray', '\\nCommand:'));
                 console.dir(JSON.parse(fetchInfo.body), { colors: true });
                 console.log(styleText('gray', '\\nResponse:'));
                 console.dir(r, { colors: true });
                 console.log(styleText('gray', '\\nSuccess?:'));
              })
              .catch((e) => {
                 ok = 0;
                 console.log(styleText('gray', '\\nCommand:'));
                 console.dir(JSON.parse(fetchInfo.body), { colors: true });
                 console.log(styleText('gray', '\\nError - ' + e.name + ':'));
                 console.log(styleText('red', e.message));
                 console.log(styleText('gray', '\\nSuccess?:'));
              }))();
            break;
          case 'verbose':
            sp(() => this
              .then((r) => {
                 console.log(styleText('gray', '\\nCommand:'));
                 console.dir(JSON.parse(fetchInfo.body), { colors: true });
                 console.log(styleText('gray', '\\nResponse:'));
                 console.dir(r, { colors: true });
                 console.log(styleText('gray', '\\nSuccess?:'));
              })
              .catch((e) => {
                 ok = 0;
                 console.log(styleText('gray', '\\nCommand:'));
                 console.dir(JSON.parse(fetchInfo.body), { colors: true });
                 console.log(styleText('gray', '\\nError:'));
                 console.dir(e, { colors: true });
                 console.log(styleText('gray', '\\nSuccess?:'));
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
          get(target, prop) {
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
    `;
  }
}
