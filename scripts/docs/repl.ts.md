# `repl.ts` (The godsend)

An extremely useful script for both debugging & testing purposes. Like, _extremely_ useful.

This script will start a REPL for the project, with:
- The necessary environment variables set
- Helpful imports already loaded & variables initialized
- "Macros" for common tasks already defined

## Contents

1. [Prerequisites](#prerequisites)
2. [Invoking the REPL script](#invoking-the-repl-script)
   1. [Running on local Stargate (`[-local]`)](#running-on-local-stargate--local)
   2. [Enabling verbose logging (`[-l | -logging]`)](#enabling-verbose-logging--l---logging)
   3. [Override the default collection name (`[-c | -coll-name <name>]`)](#override-the-default-collection-name--c---coll-name-name)
   4. [Override the default table name (`[-t | -table-name <name>]`)](#override-the-default-table-name--t---table-name-name)
   5. [Override the default keyspace name (`[-k | -keyspace <name>]`)](#override-the-default-keyspace-name--k---keyspace-name)
3. [Inside the REPL](#inside-the-repl)
   1. [Imports & variables](#imports--variables)
      1. [`$`](#)
      2. [`bn` & `JBI`](#bn--jbi)
      3. [`client`, `db`](#client-db)
      4. [`coll`, `table`, `coll_`, `table_` 🚨](#coll-table-coll_-table_-)
      4. [`dbAdmin`, `admin`, `isAstra`](#dbadmin-admin-isastra)
   2. ["Macros"](#macros)
      1. [`cl`](#cl)
      2. [`cda`/`tda`/`cda_`/`tda_`](#cdatdacda_tda_)
      3. [`cfa`/`tfa`/`cfa_`/`tfa_`](#cfatfacfa_tfa_)
      4. [`cif(doc)`/`tif(row)`](#cifdoctifrow)
      5. [`+<Promise>`](#promise)
   3. [Configuration (`cfg`)](#configuration-cfg)
      1. [`cfg.plusOutput`](#cfgplusoutput)
      2. [`cfg.logging`](#cfglogging)
      3. [`cfg.fa`](#cfgfa)

4. [See also](#see-also)

## Prerequisites

- `node`
- A running Data API instance
- A `.env` with the credentials filled out (unless using `-local`)
- `src/` must be in a buildable state

**Note:** It's also recommended to run at least the test setup step before running the REPL, to ensure that the keyspace,
collection, and table are all valid and set up correctly <small>(assuming you would like to use them in the REPL, and you
haven't overridden the default values)</small>.

## Invoking the REPL script

The API for the REPL script is as follows:

```fortran
scripts/repl.ts [-local] [-l | -logging] [-c | -coll-name <name>]  [-t | -table-name <name>] [-k | -keyspace <name>]
```

### Running on local Stargate (`[-local]`)

If you want to run the REPL against a local Stargate instance, you can use this flag to set the `CLIENT_DB_URL` to
`http://localhost:8080` and the `CLIENT_DB_TOKEN` to `cassandra:cassandra` without needing to modify your `.env` file.

It'll also automatically set the environment to `dse`.

Note that you'll still need to run stargate yourself. See [startgate.ts.md](./startgate.ts.md) for more info.

### Enabling verbose logging (`[-l | -logging]`)

Allows you to log `[admin]CommandStarted` & `[admin]CommandFailed` events to the console. Useful for debugging.

### Override the default collection name (`[-c | -coll-name <name>]`)

One of the utility variables initialized is `coll`, which is set to `db.collection(<name>)`. 

This flag allows you to set the default collection name to something other than `test_coll`, which is the name used
in the `astra-db-ts` test suite.

### Override the default table name (`[-t | -table-name <name>]`)

One of the utility variables initialized is `table`, which is set to `db.table(<name>)`.

This flag allows you to set the default table name to something other than `test_table`, which is the name used
in the `astra-db-ts` test suite.

### Override the default keyspace name (`[-k | -keyspace <name>]`)

Sets the default working keyspace of the `db` utility variable to `<name>` if you don't want to use the default of `default_keyspace`.

## Inside the REPL

Before starting the REPL, `astra-db-ts` will be quickly built, and various utility variables/functions will be defined.

A couple of things of note, however:
- The build process will use `tsc` with `--noCheck` & skip a few other minor steps to speed up the build process for a speedy feedback loop.
- No I/O will actually occur once the REPL is started; it is on the user to ensure the db/collection/table actually exist if they want to use them.

### Imports & variables

Inside the REPL, you will have access to the following imports/variables:

#### `$`

This will be set to the import of the `astra-db-ts` library itself, allowing you to use any part of the library in the REPL.

```ts
> $.uuid(4)
UUID<4>("7ec78dbf-a96b-4e7a-9d72-20e4db54c164")
```

#### `bn` & `JBI`

These will be set to the imports of `bignumber.js` and `json-bigint`, respectively, allowing you to use them in the REPL.

```ts
> JBI.stringify({ num: bn.BigNumber('36.03') })
'{"num":36.03}'
```

#### `client`, `db`

Yeah, these are exactly what you think they are. Just remember that it is entirely on you to ensure that the database actually exists.

```ts
> await db.info()
{ ... }
```

#### `coll`, `table`, `coll_`, `table_` 🚨

Yeah, these are exactly what you think they are. Just remember that it is entirely on you to ensure that the database actually exists.

Running the test script beforehand will set these up for you automatically (assuming the coll/table/ks names are left as default).

```ts
> await table.definition()
{ ... }
```

> [!IMPORTANT]
> These variables are **special**; they are wrapped in a custom `Proxy` which allows property access to be _case-insensitive_ and _partially-complete_.

This means that you can access properties like `table.findOne({})` or `table.findOn({})` or `table.findo({})` and they will all work the same.

The shortest matching property will be used, so `insert` will match `insertOne` instead of `insertMany`.

#### `dbAdmin`, `admin`, `isAstra`

- `isAstra` will be set to `true` if the `CLIENT_DB_ENVIRONMENT` is `'astra' | undefined` and `-local` is not set
- `dbAdmin` will be set to either `AstraDbAdmin` or `DataAPIDbAdmin` depending on `isAstra`
- `admin` will be set to `null` if `isAstra` is `false`; otherwise it will be set to `AstraAdmin`

```ts
> (dbAdmin instanceof $.AstraAdmin) === isAstra
true
```

### "Macros"

"Macros" are glorified utility functions defined in the REPL to make common tasks extremely, _magically_, easy to do.

#### `cl`

Just typing `cl` into the REPL will clear the console. It's like magic.

```sh
# before
> ...
...
> cl

# after
'Cleared console'
> 
```

#### `cda`/`tda`/`cda_`/`tda_`

Just typing in `cda` or `tda` into the REPL will run `await coll/table.deleteMany({})` for you. Ditto for their `_` counterparts.

No explicit `await` required! Just type it in and watch the magic (synchronously) happen.

```ts
> cda
{ deletedCount: -1 }
```

#### `cfa`/`tfa`/`cfa_`/`tfa_`

Just typing in `cfa` or `tfa` into the REPL will run `await coll/table.find({}).toArray()` for you. Ditto for their `_` counterparts.

No explicit `await` required! Just type it in and watch the magic (synchronously) happen.

```ts
> cfa
[ ... ]
```

#### `cif(doc)`/`tif(row)`

This one's actually a function that performs two steps:
- Inserts a doc/row into the collection/table
- Immediately finds the doc/row and returns it

If using `tif`, it'll default row to `{ text: $.UUID.v4().toString(), int: 0, ...row }` so you don't need to worry about explicitly setting the PK if you don't want to.

```ts
> tif({ int: 3, duration: '1w' })
{ 
  text: '7ec78dbf-a96b-4e7a-9d72-20e4db54c164',
  int: 3,
  duration: DataAPIDuration("7d"),
  ...: null,
}
```

#### `+<Promise>`

This one is a minor cheat, but if you run `+<Promise>` in the REPL, it'll print out the full, non-truncated, `await`-ed result.

It'll also return `1` if the promise resolves successfully, and `0` if it rejects.

```ts
> +table.listIndexes()
[
  {
    name: 'bigint_idx_default_keyspace',
    definition: { column: 'bigint', options: {} }
  },
  {
    name: 'vector_idx_default_keyspace',
    definition: {
      column: 'vector',
      options: { metric: 'dot_product', sourceModel: 'other' }
    }
  }
]
1
```

### Configuration (`cfg`)

The `cfg` variable is a utility object that allows you to configure certain aspects the REPL environment.

```ts
> cfg.plusOutput.minimal
"Set plus output to 'minimal'"
> cfg.fa.project({})
'Set *fa projection to {}'
```

#### `cfg.plusOutput`

This configuration object allows you to set the output level of the `+<Promise>` macro.

The available options are:
- `cfg.plusOutput.default`: Prints the default output level
- `cfg.plusOutput.verbose`: Prints the same as the default, but prints the whole error object if the promise rejects
- `cfg.plusOutput.minimal`: Prints only the response or error message, and nothing else

#### `cfg.logging`

This configuration object allows you to manage the logging of events emitted by the various client objects.

The available options are:
- `cfg.logging.on`: Enables logging
- `cfg.logging.off`: Disables logging

The default value is set by the [`-l` flag](#enabling-verbose-logging--l---logging) if it is set, otherwise it will be `false`.

#### `cfg.fa`

This configuration object allows you to set options regarding the [`*fa` utility macros](#cfatfacfa_tfa_) (such as `cfa` or `tfa_`).

The available options are:
- `cfg.fa.project(projection)`: Sets the projection to be used in the `find` query. The default is `{ '*': 1 }`, which means all fields will be returned.

## See also

- [The custom checker script](./check.ts.md)
- [The custom test script](./test.ts.md)
