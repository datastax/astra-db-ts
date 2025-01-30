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

import { CommandEventMap } from '@/src/documents';
import { AdminCommandEventMap } from '@/src/administration';
import { OneOrMany } from '@/src/lib/types';
// noinspection ES6UnusedImports
import TypedEventEmitter from 'typed-emitter';

/**
 * #### Overview
 *
 * The `EventMap` of events the {@link DataAPIClient} emits, which is an instance of {@link TypedEventEmitter}, when
 * events logging is enabled (via `logging` options throughout the major class hierarchy).
 *
 * See {@link DataAPILoggingConfig} for more information on how to configure logging, and enable/disable specific events.
 *
 * ###### When to prefer events
 *
 * Events can be thought of as a "generic logging interface" for Data API & DevOps operations.
 *
 * Though the {@link DataAPILoggingConfig}, you can also enable logging to the console, but:
 * - You're forced to use stdout/stderr as outputs
 * - You can't programmatically interact with the logs/data
 * - You can't easily filter or format the logs
 *
 * {@link DataAPIClientEvent}s are a more flexible way to interact with the logs, allowing you to basically plug in, or
 * even build, your own logging system around them.
 *
 * And of course, you're free to use both events and console logging in tandem, if you so choose.
 *
 * ###### Disclaimer
 *
 * **Note that these emit *real* commands, not any abstracted commands, such as `insertMany` or `updateMany`,
 * which may be split into multiple of those commands under the hood.**
 *
 * #### Event types
 *
 * There are two major categories of events emitted by the {@link DataAPIClient}:
 * - {@link CommandEvent}s - Events related to the execution of a command
 *   - i.e. `Db`, `Collection`, `Table` operations
 * - {@link AdminCommandEvent}s - Events related to the execution of an admin command
 *   - i.e. `AstraAdmin`, `DbAdmin` operations
 *
 * Every event may be enabled/disabled individually, independent of one another.
 *
 * View each command's documentation for more information on the specific events they emit.
 *
 * ###### Commands
 *
 * | Name                                       | Description                                                                                       | Default behavior if enabled   |
 * |--------------------------------------------|---------------------------------------------------------------------------------------------------|-------------------------------|
 * | `commandStarted`                           | Emitted when a command is started, before the initial HTTP request is made.                       | Emit as event; does not log   |
 * | `commandSucceeded`                         | Emitted when a command has succeeded (i.e. the status code is 200, and no `errors` are returned). | Emit as event; does not log   |
 * | `commandFailed`                            | Emitted when a command has errored (i.e. the status code is not 200, or `errors` are returned).   | Emit as event; logs to stderr |
 * | `commandWarnings`                          | Emitted when a command has warnings (i.e. when the `status.warnings` field is present).           | Emit as event; logs to stderr |
 *
 * ###### Admin commands
 *
 * | Name                                                              | Description                                                                                                   | Default behavior if enabled     |
 * |-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|---------------------------------|
 * | `adminCommandStarted`                                             | Emitted when an admin command is started, before the initial HTTP request is made.                            | Emits the event; logs to stderr |
 * | `adminCommandPolling`                                             | Emitted when a command is polling in a long-running operation (i.e. {@link AstraAdmin.createDatabase}).       | Emits the event; logs to stderr |
 * | `adminCommandSucceeded`                                           | Emitted when an admin command has succeeded, after any necessary polling (i.e. when an HTTP 200 is returned). | Emits the event; logs to stderr |
 * | `adminCommandFailed`                                              | Emitted when an admin command has failed (i.e. when an HTTP 4xx/5xx is returned, even if while polling).      | Emits the event; logs to stderr |
 * | `adminCommandWarnings`                                            | Emitted when an admin command has warnings (i.e. when the `status.warnings` field is present).                | Emits the event; logs to stderr |
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
 * @see CommandEventMap
 * @see AdminCommandEventMap
 *
 * @public
 */
export type DataAPIClientEventMap =
  & AdminCommandEventMap
  & CommandEventMap;

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
 * (i.e. `[...parentConfig, ...childConfig]`). Each new layer of config is applied on top of the previous one, overwriting
 * any previous settings for the same events.
 *
 * #### Configuration & shorthands
 *
 * There's multiple ways to configure logging, depending on how much control you want:
 *
 * `logging: 'all'`
 * - Enables all event with their default outputs (see below)
 * - Shorthand for specifying all events individually
 *
 * `logging: '<command>' | ['<commands>']`
 * - Enables each individual event with their default outputs (see below)
 *
 * `logging: [{ events: 'all', emits: 'event' }]`
 * - This will emit all events, but only emit them as events, not log them to the console
 *
 * `logging: ['all', [{ events: ['<commands>'], emits: [] }]]`
 * - Enables all events, then subsequently disables the given event(s)
 *
 * As you may see, it's really just a list of configuration "layers".
 *
 * #### Event types
 *
 * See {@link DataAPIClientEventMap} for more information on the types of events emitted.
 *
 * #### Output types
 *
 * The `emits` field can be set to either 'event', 'stdout', or 'stderr'.
 *
 * - 'event' will emit the event to the {@link DataAPIClient} instance
 * - 'stdout' will log the event to stdout
 * - 'stderr' will log the event to stderr
 *
 * ##### Defaults
 *
 * These are used for events that are enabled without specified outputs being provided, e.g:
 * - `logging: ['commandStarted', 'commandSucceeded', 'commandFailed']`
 * - `logging: 'all'`
 *
 * All events are emitted as events by default, through the {@link DataAPIClient}, which is an instance of an {@link EventEmitter}.
 *
 * `commandStarted` and `commandSucceeded` are the only events not logged to `stderr` as well by default; all other events are logged to `stderr`.
 *
 * #### Examples
 *
 * ```ts
 * const client = new DataAPIClient('*TOKEN*', {
 *  logging: [{ events: 'all', emits: 'stdout' }],
 * });
 * const db = client.db('*ENDPOINT*');
 *
 * // Output:
 * // '[CommandStartedEvent]: createCollection in default_keyspace'
 * // '[CommandSucceededEvent]: createCollection in default_keyspace (took ...ms)'
 * await db.createCollection('my_collection');
 * ```
 *
 * @see DataAPIClientEventMap
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
 * See {@link DataAPIClientEventMap} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export type DataAPILoggingEvent = 'all' | keyof DataAPIClientEventMap;

/**
 * Represents the different outputs that can be emitted/logged to by the {@link DataAPIClient}.
 *
 * This can be set to either 'event', 'stdout', or 'stderr'. However, attempting to set both 'stdout' and 'stderr'
 * as an output for a single event will result in an error.
 *
 * See {@link DataAPIClientEventMap} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export type DataAPILoggingOutput = 'event' | 'stdout' | 'stderr';

/**
 * The most explicit way to configure logging, with the ability to set both events and specific outputs.
 *
 * Settings the `emits` field to `[]` will disable logging for the specified events.
 *
 * See {@link DataAPIClientEventMap} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export interface DataAPIExplicitLoggingConfig {
  readonly events: OneOrMany<DataAPILoggingEvent>,
  readonly emits: OneOrMany<DataAPILoggingOutput>,
}
