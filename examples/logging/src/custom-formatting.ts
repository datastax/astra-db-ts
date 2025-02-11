import { BaseClientEvent, CommandEvent, DataAPIClient, EventFormatter } from '@datastax/astra-db-ts';

// -----===-----
// INFO: This one shows you how you can override the base event formatter to customize stdout/stderr logging formats
// -----===-----

// -----===<{ STEP 1: Instantiate the client }>===-----

// Instantiate the client & db with stdout/stderr logging enabled
const client = new DataAPIClient({ logging: [{ events: 'all', emits: 'stdout' }] });
const db = client.db(process.env.CLIENT_DB_URL!, { token: process.env.CLIENT_DB_TOKEN });

// -----===<{ STEP 2: Create & set your custom formatter }>===-----

// Create
const formatter: EventFormatter = (event, message) => {
  if (event instanceof CommandEvent) {
    return `[${event.timestamp.toISOString()}] [${event.requestId.slice(0, 8)}] (${event.name}) (on ${event.target}) - ${message}`;
  } else {
    return `[${event.timestamp.toISOString()}] [${event.requestId.slice(0, 8)}] (${event.name}) (${event.path}) - ${message}`;
  }
};

// Set
BaseClientEvent.setDefaultFormatter(formatter);

// -----===<{ STEP 3: Profit }>===-----

try {
  // And formatting your events is as easy as that!
  // Though for production use, you might want to use a more advanced setup, like in the 'using-your-framework' example.
  // But this is great for smaller projects, or quick debugging.
  const table = await db.createTable('custom_fmt_logging_example_table', {
    definition: {
      columns: {
        name: 'text',
        position: 'int',
      },
      primaryKey: 'name',
    },
    ifNotExists: true,
  });

  // Logs:
  // - [2025-02-11T07:45:25.212Z] [4f729318] (CommandStarted) (on table) - (default_keyspace.custom_fmt_logging_example_table) insertMany 3 records (ordered)
  // - [2025-02-11T07:45:26.055Z] [4f729318] (CommandSucceeded) (on table) - (default_keyspace.custom_fmt_logging_example_table) insertMany 3 records (ordered) (took 842ms)
  await table.insertMany([
    { name: 'Alice', position: 0 },
    { name: 'Brian', position: 1 },
    { name: 'Cathy', position: 2 },
  ], { ordered: true });

  // Logs:
  // - [2025-02-11T07:45:26.056Z] [0007b713] (CommandStarted) (on table) - (default_keyspace.custom_fmt_logging_example_table) findOne
  // - [2025-02-11T07:45:26.303Z] [0007b713] (CommandFailed) (on table) - (default_keyspace.custom_fmt_logging_example_table) findOne (took 246ms) - 'Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed'
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});
} finally {
  // Logs:
  // - [2025-02-11T07:45:26.304Z] [f60b6441] (CommandStarted) (on keyspace) - (default_keyspace) dropTable custom_fmt_logging_example_table
  // - [2025-02-11T07:45:28.037Z] [f60b6441] (CommandSucceeded) (on keyspace) - (default_keyspace) dropTable custom_fmt_logging_example_table (took 1733ms)
  await db.dropTable('custom_fmt_logging_example_table');
}
