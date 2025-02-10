import { DataAPIClient } from '@datastax/astra-db-ts';

// -----===-----
// INFO: This one's an extremely basic example, demonstrating how to use the client with the built-in logging.
// -----===-----

// -----===<{ STEP 1: Instantiate the client }>===-----

// Instantiate the client & db with logging defaults enabled
const client = new DataAPIClient({ logging: 'all' });
const db = client.db(process.env.CLIENT_DB_URL!, { token: process.env.CLIENT_DB_TOKEN });

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

  // We can manually listen for the events and log them ourselves
  table.on('commandStarted', (e) => {
    console.log(`Table ${table.name} command started: ${e.format({ timestamp: false })}`);
  });

  // This will print the following to the console:
  // - Table basic_logging_example_table command started: [CommandStarted]: (default_keyspace.basic_logging_example_table) findOne
  await table.findOne({
    name: 'Alice',
  });

  // This will print the following to the console:
  // - Table basic_logging_example_table command started: [CommandStarted]: (default_keyspace.basic_logging_example_table) findOne
  // However, command will intentionally fail, and thus the error will be logged to stderr after the command is done:
  // - 2025-02-10 17:46:43Z [CommandFailed]: (default_keyspace.basic_logging_example_table) findOne (took 247ms) - 'Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed'
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});
} finally {
  // Still though, even though this is arguably an important command, it won't print anything to the console.
  // You'd need to manually listen for the events and log them yourself (or override the default logging config)
  await db.dropTable('basic_logging_example_table');
}
