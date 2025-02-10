import { DataAPIClient } from '@datastax/astra-db-ts';

// -----===-----
// INFO: This one's a more contrived example, demonstrating how the client can be used in a hierarchical logging setup.
// -----===-----

// -----===<{ STEP 1: Instantiate the client }>===-----

// Instantiate the client & db with all event logging enabled
const client = new DataAPIClient({ logging: [{ events: 'all', emits: 'event' }] });
const db = client.db(process.env.CLIENT_DB_URL!, { token: process.env.CLIENT_DB_TOKEN });

// We'll create command failure listeners at the client, db, and table levels
// When an event is emitted from the table, it'll first invoke all the listeners on the table, then the db, and finally the client.
// Similar to the DOM.
client.on('commandFailed', (e) => {
  console.log('[client] Command failed (#3):', e.error.message);
});
db.on('commandFailed', (e) => {
  console.log('[db] Command failed (#2):', e.error.message);
});

try {
  // -----===<{ STEP 2: Create the table }>===-----

  // We'll create the table and add the event listener at the table level
  const table = await db.createTable('hr_logging_example_table', {
    definition: {
      columns: {
        name: 'text',
        position: 'int',
      },
      primaryKey: 'name',
    },
    ifNotExists: true,
  });

  table.on('commandFailed', (e) => {
    console.log('[table] Command failed (#1):', e.error.message);
  });

  // -----===<{ STEP 3: Use the client }>===-----

  // Just a normal, mundane, non-failing query, so nothing will be logged
  await table.insertMany([
    { name: 'Alice', position: 0 },
    { name: 'Brian', position: 1 },
    { name: 'Cathy', position: 2 },
  ], { ordered: true });

  // Now this command will fail, and print the following three lines to the console:
  // - [table] Command failed (#1): Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed
  // - [db] Command failed (#2): Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed
  // - [client] Command failed (#3): Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});

  // -----===<{ STEP 4: Stopping propagation }>===-----

  // We can stop the event propagation at any level
  // To demonstrate it, let's remove the table listener and re-add it with a stopPropagation call
  table.removeAllListeners();

  table.on('commandFailed', (e) => {
    console.log('[table] Command failed (#only):', e.error.message);
    e.stopPropagation(); // we can also do `e.stopImmediatePropagation()` to stop all further listeners, even on the same level (if there were more)
  });

  // This command will fail again, but now only the table listener will be invoked, and only one line will be printed to the console:
  // - [table] Command failed (#only): Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});
} finally {
  // Nothing logged here again, assuming the command succeeds
  await db.dropTable('hr_logging_example_table');
}
