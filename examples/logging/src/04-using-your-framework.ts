import { CommandEvent, DataAPIClient, EventFormatter, LoggingEvents } from '@datastax/astra-db-ts';
import winston from 'winston';

// -----===-----
// INFO: This one's a bit more advanced example, demonstrating how to integrate the client with your own logging framework.
// INFO: See ./example_winston_output for the expected outputs of this example
// -----===-----

// -----===<{ STEP 1: Setup the logger }>===-----

// Create the logger. Winston is used here for popular example.
// We use both file & console transports for demonstration purposes.
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'http',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error', options: { flags: 'w' } }),
    new winston.transports.File({ filename: 'combined.log', options: { flags: 'w' } }),
  ],
  exitOnError: false,
});

// For development, also log to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    level: 'info',
    format: winston.format.combine(
      winston.format.printf((info) => `${info.timestamp} ${info.message}`),
      winston.format.colorize(),
    ),
  }));
}

// -----===<{ STEP 2: Instantiate the client }>===-----

// Instantiate the client & db with all event logging enabled
const client = new DataAPIClient({ logging: [{ events: 'all', emits: 'event' }] });
const db = client.db(process.env.ASTRA_DB_ENDPOINT!, { token: process.env.ASTRA_DB_TOKEN });

// -----===<{ STEP 3: Plug in the framework }>===-----

// message is equivalent to `event.getMessagePrefix() + ' ' + event.getMessage()`
const eventFormatter: EventFormatter = (event, message) => {
  return `[${event.requestId.slice(0, 8)}] [${event.name}]: ${message}`;
}

// We'll use regex to partition the events into two major categories: 'http/info' and 'error'
// Then, we'll simply use the event emitting capabilities of the client to log the events via the logger
for (const event of LoggingEvents.filter((e) => /.*(Started|Succeeded|Polling)/.test(e))) {
  client.on(event, (e) => {
    // Here, we specify if the events are normal, non-admin commands acted upon existing collections/tables (e.g. insert, find, etc.)
    // then they're fairly mundane and can be logged as 'http' events.
    //
    // The admin events, and events that are not acted upon collections/tables (e.g. create, drop, list, etc.) are logged as 'info' events.
    // This is just a simple example of applying custom logic to enhance the logging output.
    if (e instanceof CommandEvent && (e.target === 'collection' || e.target === 'table')) {
      logger.http(`[astra-db-ts] ${e.format(eventFormatter)}`, e.trimDuplicateFields())
    } else {
      logger.info(`[astra-db-ts] ${e.format(eventFormatter)}`, e.trimDuplicateFields())
    }
  });
}

// And all failed and warning events are logged as 'error' events
for (const event of LoggingEvents.filter((e) => /.*(Failed|Warning)/.test(e))) {
  client.on(event, (e) => logger.error(`[astra-db-ts] ${e.format(eventFormatter)}`, e.trimDuplicateFields()));
}

// -----===<{ STEP 4: Use the client }>===-----

try {
  // Since this is a "keyspace" command, i.e. it doesn't act upon a collection/table, it will be logged as an 'info' event
  const table = await db.createTable('fw_logging_example_table', {
    definition: {
      columns: {
        name: 'text',
        position: 'int',
      },
      primaryKey: 'name',
    },
    ifNotExists: true,
  });

  // Just a normal, mundane, non-failing query, so both its CommandStarted and CommandSucceeded events will be logged as 'http' events
  await table.insertMany([
    { name: 'Alice', position: 0 },
    { name: 'Brian', position: 1 },
    { name: 'Cathy', position: 2 },
  ], { ordered: true });

  // Ditto.
  await table.findOne({
    name: 'Alice',
  });

  // Now this command will log its CommandStarted event as a 'http' event, but it'll fail & throw an error,
  // resulting in no CommandSucceeded event, and instead a CommandFailed event, which will be logged as an 'error' event
  await table.findOne({
    $invalid: 'Alice',
  }).catch(() => {});
} finally {
  // Also a "keyspace" command, so it will be logged as an 'info' event
  await db.dropTable('fw_logging_example_table');
}
