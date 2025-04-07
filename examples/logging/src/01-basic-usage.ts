import { DataAPIClient } from '@datastax/astra-db-ts';

// -----===-----
// INFO: This one's an extremely basic example, demonstrating how to use the client with the built-in logging.
// -----===-----

// -----===<{ STEP 1: Instantiate the client }>===-----

// Instantiate the client & db with logging defaults enabled
// See the documentation for `DataAPILoggingConfig` for more information on the available options
// (or hover over the `logging` property in your IDE!)
const client = new DataAPIClient({ logging: 'all' });
const db = client.db(process.env.ASTRA_DB_ENDPOINT!, { token: process.env.ASTRA_DB_TOKEN });

// -----===<{ STEP 2: Profit }>===-----

try {
  // It's really as easy as that, at least if you want quick, sane defaults.
  // For production use, you might want to use a more advanced setup, like in the 'using-your-framework' example.
  // For example, this `createTable` command won't print anything to the console with the current default setup.
  const table = await db.createTable('basic_logging_example_table', {
    definition: {
      columns: {
        name: 'text',
        position: 'int',
      },
      primaryKey: 'name',
    },
    ifNotExists: true,
  });

  // Nor will this
  await table.insertMany([
    { name: 'Alice', position: 0 },
    { name: 'Brian', position: 1 },
    { name: 'Cathy', position: 2 },
  ], { ordered: true });

  // -----===<{ STEP 3: Let's go a bit further }>===-----

  // We can also manually listen for events and handle them ourselves, for the greatest control over logging.
  table.on('commandStarted', (e) => {
    console.log(`Table ${table.name} command started: ${e.format((_, msg) => msg)}`);
  });

  // This will print the following to the console:
  // - "Table basic_logging_example_table command started: basic_logging_example_table::findOne"
  await table.findOne({
    name: 'Alice',
  });

  // This will print the following to the console:
  // - "Table basic_logging_example_table command started: basic_logging_example_table::findOne"
  //
  // However, the command will (intentionally) fail, and thus the error will be logged to stderr after the command is done:
  // - "2025-02-12 13:13:57 CDT [2006e52e] [CommandFailed]: basic_logging_example_table::findOne (307ms) ERROR: 'Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed'"
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});
} finally {
  // Even though this is arguably an important command, it won't print anything to the console.
  // You'd need to either manually listen for the events and log them yourself, or override the default logging config to print `commandStarted` events.
  await db.dropTable('basic_logging_example_table');
}
