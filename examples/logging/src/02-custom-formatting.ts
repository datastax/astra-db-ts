import { BaseClientEvent, CommandEvent, DataAPIClient, EventFormatter } from '@datastax/astra-db-ts';

// -----===-----
// INFO: This one shows you how you can override the base event formatter to customize stdout/stderr logging formats
// -----===-----

// -----===<{ STEP 1: Instantiate the client }>===-----

// Instantiate the client & db with stdout/stderr logging enabled
const client = new DataAPIClient({ logging: [{ events: 'all', emits: 'stdout' }] });
const db = client.db(process.env.ASTRA_DB_ENDPOINT!, { token: process.env.ASTRA_DB_TOKEN });

// -----===<{ STEP 2: Create & set your custom formatter }>===-----

// Create the formatter. This is a function that takes an event and the full message, and returns a string to be logged
// (The full message is equivalent to `event.getMessagePrefix() + ' ' + event.getMessage()`)
const formatter: EventFormatter = (event, message) => {
  if (event instanceof CommandEvent) {
    return `[${event.timestamp.toISOString()}] [${event.requestId.slice(0, 8)}] (${event.name}) (on ${event.target}) - ${message}`;
  } else {
    return `[${event.timestamp.toISOString()}] [${event.requestId.slice(0, 8)}] (${event.name}) (${event.url}) - ${message}`;
  }
};

// Set the global default formatter
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
  // - "[2025-02-12T07:44:00.817Z] [66b73e60] (CommandStarted) (on table) - custom_fmt_logging_example_table::insertMany {records=3,ordered=true}"
  // - "[2025-02-12T07:44:01.122Z] [66b73e60] (CommandSucceeded) (on table) - custom_fmt_logging_example_table::insertMany {records=3,ordered=true} (304ms)"
  await table.insertMany([
    { name: 'Alice', position: 0 },
    { name: 'Brian', position: 1 },
    { name: 'Cathy', position: 2 },
  ], { ordered: true });

  // Logs:
  // - "[2025-02-12T07:44:01.123Z] [0cd1e298] (CommandStarted) (on table) - custom_fmt_logging_example_table::findOne"
  // - "[2025-02-12T07:44:01.430Z] [0cd1e298] (CommandFailed) (on table) - custom_fmt_logging_example_table::findOne (306ms) ERROR: 'Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed'"
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});
} finally {
  // Logs:
  // - "[2025-02-12T07:44:01.431Z] [3d3360fc] (CommandStarted) (on keyspace) - default_keyspace::dropTable {name=custom_fmt_logging_example_table,ifExists=false}"
  // - "[2025-02-12T07:44:03.171Z] [3d3360fc] (CommandSucceeded) (on keyspace) - default_keyspace::dropTable {name=custom_fmt_logging_example_table,ifExists=false} (1739ms)"
  await db.dropTable('custom_fmt_logging_example_table');
}
