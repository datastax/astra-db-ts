// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { DataAPIClientEvent } from '@/src/lib/index.js';
import type { SomeDoc } from '@/src/documents/index.js';

/**
 * @internal
 */
export const enum PropagationState {
  Continue = 0,
  Stop = 1,
  StopImmediate = 2
}

/**
 * ##### Overview
 *
 * A function that formats an event into a string.
 *
 * Used with {@link BaseClientEvent.format}, which dictates how the event should be logged to stdout/stderr.
 *
 * There are two ways to use this method:
 * - Pass it to {@link BaseClientEvent.format} if you're manually formatting an event.
 * - Set it as the default formatter using {@link BaseClientEvent.setDefaultFormatter} if you want all events to use the same formatter.
 *   - This is useful if you want to use the default stdout/stderr logging, but still want to customize the format.
 *
 * ##### Default format
 *
 * The default format is `[timestamp] [requestId[0..8]] [eventName]: message`.
 * - The `timestamp` is of the format `YYYY-MM-DD HH:MM:SS TZ`.
 * - The `requestId` is the first 8 characters of the requestId.
 * - The `eventName` is the name of the event.
 * - The `message` is the message generated by the event.
 *
 * For example:
 * ```
 * 2025-02-11 12:24:59 IST [e31bc40e] [CommandFailed]: (default_keyspace.basic_logging_example_table) findOne (took 249ms) - 'Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed'
 * ```
 *
 * ##### Custom formatter example
 *
 * @example
 * ```ts
 * // Define a custom formatter
 * const customFormatter: EventFormatter = (event, message) => {
 *  return `[${event.requestId.slice(0, 8)}] (${event.name}) - ${message}`;
 * }
 *
 * // Set the custom formatter as the default
 * BaseClientEvent.setDefaultFormatter(customFormatter);
 *
 * // Now all events will use the custom formatter
 * const coll = db.collection('*COLLECTION_NAME*', {
 *   logging: [{ events: 'all', emits: 'stdout' }],
 * });
 *
 * // Logs:
 * // - [e31bc40e] (CommandStarted) - (default_keyspace.basic_logging_example_table) findOne
 * // - [e31bc40e] (CommandFailed) - (default_keyspace.basic_logging_example_table) findOne (took 249ms) - 'Invalid filter expression: filter clause path ('$invalid') contains character(s) not allowed'
 * coll.findOne({ $invalid: 1 });
 * ```
 *
 * @see LoggingConfig
 * @see BaseClientEvent.setDefaultFormatter
 *
 * @public
 */
export type EventFormatter = (event: DataAPIClientEvent, fullMessage: string) => string;

/**
 * ##### Overview
 *
 * The base class of all events that may be emitted/logged by some {@link HierarchicalLogger} (e.g. a `DataAPIClient`, `DbAdmin`, `Collection`, etc.)
 *
 * Using events over direct logging allows for more flexibility in how the events are handled, such as:
 * - Logging to different outputs (e.g., files, external log aggregators)
 * - Integrating with custom logging frameworks (e.g., winston, Bunyan)
 * - Filtering or modifying events dynamically
 *
 * Each event is associated with a unique `requestId`, which can be used to track a specific request across multiple event emissions.
 *
 * See {@link DataAPIClientEventMap} & {@link LoggingConfig} for much more info.
 *
 * @public
 */
export abstract class BaseClientEvent {
  /**
   * Poor man's sealed class. Ensures you can't extend this class without first updating `DataAPIClientEventMap`.
   *
   * Imagine that:
   * - `BaseClientEvent` is a Java sealed class
   * - `DataAPIClientEvent` is Java's `permits` keyword.
   *
   * An implementing class would do something like this:
   *
   * ```ts
   * export class CommandWarningsEvent extends BaseClientEvent {
   *   declare _permits: this;
   * }
   * ```
   *
   * If you forget to add `declare _permits: this`, or `this` is not assignable to `DataAPIClientEvent`, TypeScript will statically error.
   *
   * @internal
   */
  protected declare abstract _permits: DataAPIClientEvent;

  /**
   * @internal
   */
  private static _defaultFormatter = defaultFormatFn;

  /**
   * ##### Overview
   *
   * Sets the default formatter for all events.
   *
   * Useful especially if you want to change the format of events as they're logged to `stdout`/`stderr` (see {@link LoggingOutputs}).
   *
   * See {@link EventFormatter} for much more info.
   *
   * ##### Disclaimer
   *
   * This method sets a static property on the class, so it will affect _all_ instances of `BaseClientEvent`, regardless of the class. Be careful when using this method in a shared environment.
   *
   * @example
   * ```ts
   * BaseClientEvent.setDefaultFormatter((event, msg) => `[${event.name}] ${msg}`);
   * ```
   *
   * @param formatter - A function that transforms an event into a log string.
   */
  public static setDefaultFormatter(formatter: EventFormatter): void {
    BaseClientEvent._defaultFormatter = formatter;
  }

  /**
   * The name of the event (e.g., `'CommandStarted'`, `'CommandFailed'`).
   */
  public readonly name: string;

  /**
   * The timestamp of when the event was created.
   */
  public readonly timestamp: Date;

  /**
   * ##### Overview
   *
   * A unique identifier for the request that triggered this event.
   *
   * It helps correlate multiple events occurring within the same request lifecycle.
   *
   * ##### Disclaimer
   *
   * High-level operations, such as `collection.insertMany(...)`, may generate multiple requests internally. Each of these requests will have its own unique `requestId`.
   *
   * ##### Example
   *
   * As an example, a `CommandStarted` event may be emitted when a command is started, and a `CommandSucceeded` event may be emitted when the command has succeeded. Both of these events will have the same `requestId`.
   *
   * If logged to a file (e.g. winston with a file transport and json format), you could then filter all events with the same `requestId` to see the entire lifecycle of a single command.
   *
   * @example
   * ```typescript
   * // Set up event listeners on the collection
   * collection.on('commandStarted', (e) => {
   *   console.log(`Command started with requestId: ${e.requestId}`);
   * });
   * collection.on('commandSucceeded', (e) => {
   *   console.log(`Command succeeded with requestId: ${e.requestId}`);
   * });
   *
   * // Logs:
   * // - Command started with requestId: dac0d3ba-79e8-4886-87b9-20237c507eba
   * // - Command succeeded with requestId: dac0d3ba-79e8-4886-87b9-20237c507eba
   * await collection.insertOne({ name: 'Alice' });
   *
   * // Logs:
   * // - Command started with requestId: 1fe46a92-8187-4eaa-a3c2-80a964b68eba
   * // - Command succeeded with requestId: 1fe46a92-8187-4eaa-a3c2-80a964b68eba
   * await collection.insertOne({ name: 'Bob' });
   * ```
   */
  public readonly requestId: string;

  /**
   * Any extra information that may be useful for logging/debugging purposes.
   *
   * Some commands may set this; others may not. **Guaranteed to always have at least one key if not undefined.**
   */
  public readonly extraLogInfo?: Record<string, any>;

  /**
   * @internal
   */
  public declare _propagationState: PropagationState;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string, requestId: string, extra: Record<string, unknown> | undefined) {
    this.name = name;
    this.requestId = requestId;
    this.extraLogInfo = (extra && Object.keys(extra).length > 0) ? extra : undefined;
    this.timestamp = new Date();

    Object.defineProperty(this, '_propagationState', {
      value: PropagationState.Continue,
      enumerable: false,
      writable: true,
    });
  }

  public abstract getMessagePrefix(): string;
  public abstract getMessage(): string;

  /**
   * ##### Overview
   *
   * Formats the event into a human-readable string, as it would be logged to `stdout`/`stderr` (if enabled).
   *
   * See {@link EventFormatter} & {@link BaseClientEvent.setDefaultFormatter} for more information about custom formatting.
   *
   * @param formatter - Optional custom formatter function.
   * @returns The formatted event string.
   */
  public format(formatter: EventFormatter = BaseClientEvent._defaultFormatter): string {
    return formatter(this as any, this.getMessagePrefix() + ' ' + this.getMessage());
  }

  /**
   * ##### Overview
   *
   * Converts the event to a verbose JSON format, as it would be logged to `stdout:verbose`/`stderr:verbose` (if enabled).
   *
   * Useful for debugging. The output is pretty-printed JSON with newlines, so perhaps not ideal for structured logging though.
   *
   * @returns A JSON string with full event details.
   */
  public formatVerbose(): string {
    const clone = { ...this, timestamp: formatTimestampSimple(this.timestamp) };
    this._modifyEventForFormatVerbose?.(clone);
    return JSON.stringify(clone, null, 2);
  }

  /**
   * @internal
   */
  protected abstract _modifyEventForFormatVerbose(event: SomeDoc): void;

  /**
   * ##### Overview
   *
   * Stops the event from bubbling up to the parent listener (e.g. `Collection` → `Db` → `DataAPIClient`).
   *
   * @example
   * ```ts
   * client.on('commandStarted', (e) => {
   *   console.log('Command started (client listener)');
   * });
   *
   * db.on('commandStarted', (e) => {
   *   console.log('Command started (db listener)');
   *   e.stopPropagation();
   * });
   *
   * collection.on('commandStarted', (e) => {
   *   console.log('Command started (collection listener)');
   * });
   *
   * // Logs:
   * // - Command started (collection listener)
   * // - Command started (db) listener
   * collection.insertOne({ name: 'Alice' });
   * ```
   *
   * @see stopImmediatePropagation
   */
  public stopPropagation(): void {
    this._propagationState = PropagationState.Stop;
  }

  /**
   * ##### Overview
   *
   * Stops the event from bubbling up to the parent listener (e.g. `Collection` → `Db` → `DataAPIClient`) and prevents any further listeners from being called.
   *
   * @example
   * ```ts
   * db.on('commandStarted', (e) => {
   *   console.log('Command started (db listener)');
   * });
   *
   * collection.on('commandStarted', (e) => {
   *   console.log('Command started (collection listener #1)');
   *   e.stopImmediatePropagation();
   * });
   *
   * collection.on('commandStarted', (e) => {
   *   console.log('Command started (collection listener #2)');
   * });
   *
   * // Logs:
   * // - Command started (collection listener #1)
   * collection.insertOne({ name: 'Alice' });
   * ```
   *
   * @see stopPropagation
   */
  public stopImmediatePropagation(): void {
    this._propagationState = PropagationState.StopImmediate;
  }

  public trimDuplicateFields(): this {
    return this;
  }
}

function defaultFormatFn(event: DataAPIClientEvent, fullMessage: string) {
  return `${formatTimestampSimple(event.timestamp)} [${event.requestId.slice(0, 8)}] [${event.name}]: ${fullMessage}`;
}

/**
 * Formats the timestamp as `YYYY-MM-DD HH:MM:SS TZ` (e.g. `2025-02-12 13:13:57 CDT`).
 */
function formatTimestampSimple(date: Date) {
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).replace(',', '');
}
