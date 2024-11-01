/* eslint-disable @typescript-eslint/no-unused-vars */
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

import { DataAPICommandEvents } from '@/src/documents';
import { AdminCommandEvents } from '@/src/administration';
import { OneOrMany } from '@/src/lib/types';
// noinspection ES6UnusedImports
import TypedEventEmitter from 'typed-emitter';

/**
 * #### Overview
 *
 * The `EventMap` of events the {@link DataAPIClient} emits, which is an instance of {@link TypedEventEmitter}, when
 * events logging is enabled (via `logging` options throughout the major class hierarchy).
 *
 * There are quite a few combinations of ways in which event logging may be enabled in the logging configuration, but
 * there are a few most common ways to do so:
 * - `logging: 'all'` - This will emit all events, but will also log some of them to the console
 * - `logging: [{ events: 'all', emits: 'event' }]` - This will emit all events, without logging any of them to the console
 * - `logging: '<command>'` - This will emit only the events for the specified command, but may also log some of them to the console
 *   - The default behavior for if an event is logged to the console or not varies
 *   - See below section on event types for more info about default behaviors
 *
 * ###### When to prefer events
 *
 * Events can be thought of as a "generic logging interface" for Data API & DevOps operations. Though the {@link DataAPILoggingConfig},
 * you can also enable/disable logging to stdout/stderr, but:
 * - You're forced to use the console as output
 * - You can't programmatically interact with the logs/data
 * - You can't easily filter or format the logs
 *
 * {@link DataAPIClientEvents} are a more flexible way to interact with the logs, allowing you to basically plug in, or
 * even build, your own logging system around them.
 *
 * And of course, you're free to use both events and console logging in tandem, if you so choose.
 *
 * ###### Disclaimer
 *
 * **Note that these emit *real* commands, not any abstracted commands like "insertMany" or "updateMany",
 * which may be split into multiple of those commands under the hood.**
 *
 * This generally applies to normal command events; no admin command events are abstracted as such.
 *
 * #### Event types
 *
 * There are two major categories of events emitted by the {@link DataAPIClient}:
 * - {@link DataAPICommandEvents} - Events related to the execution of a command
 *   - i.e. `Db`, `Collection`, `Table` operations
 * - {@link AdminCommandEvents} - Events related to the execution of an admin command
 *   - i.e. `AstraAdmin`, `DbAdmin` operations
 *
 * Every event may be enabled/disabled individually, independent of one another.
 *
 * ###### `commandStarted` ({@link CommandStartedEvent})
 *
 * Emitted when a command is started, before the initial HTTP request is made.
 *
 * Default behavior when logging is enabled (through 'all' or 'commandStarted'):
 * - Emits the event
 * - Does NOT log to the console
 *
 * ###### `commandSucceeded` ({@link CommandSucceededEvent})
 *
 * Emitted when a command has succeeded (i.e. the status code is 200, and no `errors` are returned).
 *
 * Default behavior when logging is enabled (through 'all' or 'commandSucceeded'):
 * - Emits the event
 * - Does NOT log to the console
 *
 * ###### `commandFailed` ({@link CommandFailedEvent})
 *
 * Emitted when a command has errored (i.e. the status code is not 200, or `errors` are returned).
 *
 * Default behavior when logging is enabled (through 'all' or 'commandFailed'):
 * - Emits the event
 * - Logs to stderr
 *
 * ###### `commandWarnings` ({@link CommandWarningsEvent})
 *
 * Emitted when a command has warnings (i.e. when the `status.warnings` field is present).
 *
 * Warnings may be present even if the command has succeeded.
 *
 * Such warnings include updates/deletes without a filter, or using deprecated command aliases.
 *
 * Default behavior when logging is enabled (through 'all' or 'commandWarnings'):
 * - Emits the event
 * - Logs to stderr
 *
 * ###### `adminCommandStarted` ({@link AdminCommandStartedEvent})
 *
 * Emitted when an admin command is started, before the initial HTTP request is made.
 *
 * Default behavior when logging is enabled (through 'all' or 'adminCommandStarted'):
 * - Emits the event
 * - Logs to stdout
 *
 * ###### `adminCommandPolling` ({@link AdminCommandPollingEvent})
 *
 * Emitted when a command is polling in a long-running operation (i.e. {@link AstraAdmin.createDatabase}).
 *
 * **Note: this is ONLY emitted when using {@link AstraAdmin} & {@link AstraDbAdmin} methods.** Non-Astra-backends
 * do not yet require any command polling.
 *
 * Frequency of polling depends on the command being run, and whether a custom polling interval was set.
 *
 * Default behavior when logging is enabled (through 'all' or 'adminCommandPolling'):
 * - Emits the event
 * - Logs to stdout
 *
 * ###### `adminCommandSucceeded` ({@link AdminCommandSucceededEvent})
 *
 * Emitted when an admin command has succeeded, after any necessary polling (i.e. when an HTTP 200 is returned).
 *
 * Default behavior when logging is enabled (through 'all' or 'adminCommandSucceeded'):
 * - Emits the event
 * - Logs to stdout
 *
 * ###### `adminCommandFailed` ({@link AdminCommandFailedEvent})
 *
 * Emitted when an admin command has failed (i.e. when an HTTP 4xx/5xx is returned, even if while polling).
 *
 * Default behavior when logging is enabled (through 'all' or 'adminCommandFailed'):
 * - Emits the event
 * - Logs to stderr
 *
 * ###### `adminCommandWarnings` ({@link AdminCommandWarningsEvent})
 *
 * Emitted when an admin command has warnings (i.e. when the `status.warnings` field is present).
 *
 * **Note: this is ONLY emitted when using {@link DataAPIDbAdmin} methods.** Astra-backends work using the DevOps API,
 * which does not produce any command warnings.
 *
 * Warnings may be present even if the command has succeeded.
 *
 * Such warnings include using deprecated command aliases, such as those with "namespace" terminology.
 *
 * @example
 * ```ts
 * const client = new DataAPIClient('*TOKEN*', {
 *   logging: [{ events: 'all', emits: 'event' }],
 * });
 * const db = client.db('*ENDPOINT*');
 *
 * client.on('commandStarted', (event) => {
 *   console.log('Command started:', event);
 * });
 *
 * client.on('commandFailed', (event) => {
 *   console.error('Command failed:', event);
 * });
 *
 * client.on('commandSucceeded', (event) => {
 *   console.log('Command succeeded:', event);
 * });
 *
 * // Output:
 * // 'Command started: <...>'
 * // 'Command succeeded: <...>'
 * await db.createCollection('my_collection');
 * ```
 *
 * @see DataAPILoggingConfig
 * @see DataAPICommandEvents
 * @see AdminCommandEvents
 *
 * @public
 */
export type DataAPIClientEvents =
  & DataAPICommandEvents
  & AdminCommandEvents;

/**
 * #### Overview
 *
 * The configuration for logging events emitted by the {@link DataAPIClient}.
 *
 * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
 *
 * #### Configuration inheritance
 *
 * The logging config, at its core, is just a list of events to enable/disable, and where to emit/log them.
 *
 * When they're inherited by child classes, it's done as a simple list merge, with the child's config taking precedence.
 * (e.g. `[...parentConfig, ...childConfig]`). Each new layer of config is applied on top of the previous one, overwriting
 * any previous settings for the same events.
 *
 * #### Configuration & shorthands
 *
 * There's multiple ways to configure logging, depending on how much control you want:
 *
 * `logging: 'all'`
 * - This will emit all events, but will also log some of them to the console
 * - When you use just `'all'`, it simply replaces it with {@link EventLoggingDefaults}
 *
 * `logging: [{ events: 'all', emits: 'event' }]`
 * - This will emit all events, without logging any of them to the console
 *
 * `logging: '<command>' | ['<commands>']`
 * - This will emit only the events for the specified command, but may also log some of them to the console
 * - Each command's behavior is listed below, & defined in {@link EventLoggingDefaults}
 *
 * `logging: ['all', [{ events: ['<commands>'], emits: [] }]]`
 * - This will emit all but the specified events, but will also log some of them to the console
 *
 * Just keep in mind that it's really just a list of configuration "layers".
 *
 * #### Event types
 *
 * See {@link DataAPIClientEvents} for more information on the types of events emitted.
 *
 * #### Output types
 *
 * The `emits` field can be set to either 'event', 'stdout', or 'stderr'.
 *
 * - 'event' will emit the event to the {@link DataAPIClient} instance
 * - 'stdout' will log the event to stdout
 * - 'stderr' will log the event to stderr
 *
 * #### Examples
 *
 * ```ts
 * const client = new DataAPIClient('*TOKEN*', {
 *  logging: [{ events: 'all', emit: 'stdout' }],
 * });
 * const db = client.db('*ENDPOINT*');
 *
 * // Output:
 * // '[CommandStartedEvent]: createCollection in default_keyspace'
 * // '[CommandSucceededEvent]: createCollection in default_keyspace (took ...ms)'
 * await db.createCollection('my_collection');
 * ```
 *
 * @see DataAPIClientEvents
 * @see DataAPILoggingEvent
 * @see DataAPILoggingOutput
 *
 * @public
 */
export type DataAPILoggingConfig = DataAPILoggingEvent | readonly (DataAPILoggingEvent | DataAPIExplicitLoggingConfig)[]

/**
 * Represents the different events that can be emitted/logged by the {@link DataAPIClient}, as well as the convenient
 * shorthand 'all' to configure all events at once.
 *
 * See {@link DataAPIClientEvents} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export type DataAPILoggingEvent = 'all' | keyof DataAPIClientEvents;

/**
 * Represents the different outputs that can be emitted/logged to by the {@link DataAPIClient}.
 *
 * This can be set to either 'event', 'stdout', or 'stderr'. However, attempting to set both 'stdout' and 'stderr'
 * as an output for a single event will result in an error.
 *
 * See {@link DataAPIClientEvents} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export type DataAPILoggingOutput = 'event' | 'stdout' | 'stderr';

/**
 * The most explicit way to configure logging, with the ability to set both events and specific outputs.
 *
 * Settings the `emits` field to `[]` will disable logging for the specified events.
 *
 * See {@link DataAPIClientEvents} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export interface DataAPIExplicitLoggingConfig {
  readonly events: OneOrMany<DataAPILoggingEvent>,
  readonly emits: OneOrMany<DataAPILoggingOutput>,
}

/**
 * @internal
 */
export interface NormalizedLoggingConfig {
  events: readonly DataAPILoggingEvent[],
  emits: readonly DataAPILoggingOutput[],
}
