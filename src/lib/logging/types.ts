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

import type { CommandEventMap } from '@/src/documents/index.js';
import type { AdminCommandEventMap } from '@/src/administration/index.js';
import type { OneOrMany } from '@/src/lib/types.js';

/**
 * #### Overview
 *
 * An enumeration of the events that may be emitted by the {@link DataAPIClient}, or any of its children classes, when logging is enabled.
 *
 * See {@link LoggingConfig} for more information on how to configure logging, and enable/disable specific events.
 *
 * ###### When to prefer events
 *
 * Events can be thought of as a "generic logging interface" for Data API & DevOps operations.
 *
 * Though the {@link LoggingConfig}, you can also enable logging to the console, but:
 * - You're forced to use stdout/stderr as outputs
 * - You can't programmatically interact with the log data
 * - You can't filter or format the logs
 *
 * {@link BaseClientEvent}s are a more flexible way to interact with the logs, allowing you to basically plug in, or
 * even build, your own logging system around them.
 *
 * And, of course, you're free to use both events and console logging in tandem, if you so choose.
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
 * @see LoggingConfig
 * @see CommandEventMap
 * @see AdminCommandEventMap
 *
 * @public
 */
export type DataAPIClientEventMap =
  & AdminCommandEventMap
  & CommandEventMap;

/**
 * ##### Overview
 *
 * The configuration for logging events emitted by the {@link DataAPIClient}.
 *
 * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
 *
 * ##### Configuration inheritance
 *
 * Logging is configured through a list of hierarchical rules, determining which events to emit where. Each rule layer overrides previous rules for the same events.
 *
 * Logging configuration is inherited by child classes, but may be overridden at any level (e.g. pass a base config to the `DataAPIClient` constructor, and then override it for a specific `Collection`).
 *
 * ##### Configuration & shorthands
 *
 * There are multiple ways to configure logging, and the rules may be combined in various ways:
 *
 * `logging: 'all'`
 * - This will enable all events with default behaviors (see below)
 *
 * `logging: [{ events: 'all', emits: 'event' }]`
 * - This will enable all events, but only emit them as events
 *
 * `logging: '<event>' | ['<events>']`
 * - This will enable only the specified event(s) with default behaviors
 *
 * `logging: /regex/ | [/regex/]`
 * - This will enable only the matching event(s) with default behaviors
 *
 * `logging: [{ events: ['<events>'], emits: ['<outputs>'] }]`
 * - This will allow you to define the specific outputs for specific events
 *
 * `logging: ['all', { events: ['<events>'], emits: [] }]`
 * - Example of how `'all'` may be used as a base configuration, to be overridden by specific rules
 * - The empty `emits` array effectively disables outputs for the specified events
 *
 * ##### Event types & defaults
 *
 * See {@link DataAPIClientEventMap} for more information on the types of events emitted & their defaults.
 *
 * As a TL;DR, when enabled, all events are emitted as events by default, and `commandStarted` and `commandSucceeded` are the only events not logged to `stderr` as well by default; all other events are logged to `stderr`.
 *
 * ##### Output types
 *
 * The `emits` field can be set to either `'event'`, `'stdout'`, `'stderr'`, or their verbose variants.
 *
 * - `'event'` will emit the event to each {@link HierarchicalEmitter} in the hierarchy
 *   - e.g. first to the `Collection`, then the `Db`, then the `DataAPIClient`
 *   - See {@link HierarchicalEmitter} for more information on how events are emitted
 * - `'stdout'` & `'stderr'` will log the event to stdout or stderr, respectively
 *   - The `'stdout:verbose'` & `'stderr:verbose'` variants will use a verbose format containing all the events properties
 *   - These are useful for debugging, but may be overwhelming for normal use
 *
 * ##### Examples
 *
 * Hierarchical usage example:
 *
 * @example
 * ```ts
 * // Create a `DataAPIClient` with emission enabled for all failed/warning commands
 * const client = new DataAPIClient('*TOKEN*', {
 *   logging: [{ events: /.*(Failed|Warning)/, emits: ['stderr:verbose', 'event']}],
 * });
 *
 * client.on('commandFailed', (event) => {
 *   console.error('Some command failed:', event.commandName);
 * });
 *
 * // Override the logging config for this `Db` to emit *all* events as events
 * const db = client.db('*ENDPOINT*', {
 *   logging: [{ events: 'all', emits: 'event' }],
 * });
 *
 * db.on('commandStarted', (event) => {
 *   console.log('Command started:', event.commandName);
 * });
 *
 * db.on('commandSucceeded', (event) => {
 *   console.log('Command succeeded:', event.commandName);
 * });
 *
 * // Resulting output:
 * // 'Command started: "createCollection"'
 * // 'Some command failed: "createCollection"'
 * await db.createCollection('$invalid-name$');
 * ```
 *
 * Various configuration examples:
 *
 * @example
 * ```ts
 * // Sets sane defaults for logging
 * const client = new DataAPIClient({
 *   logging: 'all',
 * });
 *
 * // Just emit all events as events
 * const client = new DataAPIClient({
 *   logging: [{ events: 'all', emits: 'event' }],
 * });
 *
 * // Define specific outputs for specific events
 * const client = new DataAPIClient({
 *   logging: [
 *     { events: ['commandStarted', 'commandSucceeded'], emits: ['stdout', 'event'] },
 *     { events: ['commandFailed'], emits: ['stderr', 'event'] },
 *   ],
 * });
 *
 * // Use 'all' as a base configuration, and override specific events
 * const client = new DataAPIClient({
 *   logging: ['all', { events: /.*(Started|Succeeded)/, emits: [] }],
 * });
 *
 * // Enable specific events with default behaviors
 * const client = new DataAPIClient({
 *   logging: ['commandSucceeded', 'adminCommandStarted'],
 * });
 * ```
 *
 * @see DataAPIClientEventMap
 * @see LoggingEvent
 * @see LoggingOutput
 *
 * @public
 */
export type LoggingConfig = LoggingEvent | readonly (LoggingEvent | ExplicitLoggingConfig)[]

/**
 * ##### Overview
 *
 * Represents the different events that can be emitted/logged by the {@link DataAPIClient}, as well as the convenient
 * shorthand 'all' to configure all events at once.
 *
 * Additionally, you can use a regular expression to match multiple events at once.
 *
 * See {@link DataAPIClientEventMap} & {@link LoggingConfig} for much more info.
 *
 * ##### Regular expressions
 *
 * Regular expressions are a powerful way to match multiple events at once. For example:
 *
 * ```ts
 * const client = new DataAPIClient({
 *   logging: [{ events: `/.*(Started|Succeeded)/`, emits: 'stderr:verbose' }],
 * });
 * ```
 *
 * is equivalent to:
 *
 * ```ts
 * const client = new DataAPIClient({
 *   logging: [{
 *     events:
 *       [ 'commandStarted', 'commandSucceeded'
 *       , 'adminCommandStarted', 'adminCommandSucceeded'
 *       ],
 *     emits: 'stderr:verbose',
 *   }],
 * });
 * ```
 *
 * @see LoggingConfig
 * @see LoggingOutput
 *
 * @public
 */
export type LoggingEvent = 'all' | keyof DataAPIClientEventMap | RegExp;

/**
 * ##### Overview
 *
 * Represents the different outputs that can be emitted/logged to by the {@link DataAPIClient}.
 *
 * This can be set to either `'event'`, `'stdout'`, `'stderr'`, `'stdout:verbose'`, or `'stderr:verbose'`.
 *
 * See {@link DataAPIClientEventMap} & {@link LoggingConfig} for much more info.
 *
 * @see LoggingConfig
 * @see LoggingEvent
 *
 * @public
 */
export type LoggingOutput = 'event' | 'stdout' | 'stderr' | 'stdout:verbose' | 'stderr:verbose';

/**
 * ##### Overview
 *
 * The most explicit way to configure logging, with the ability to set both events and specific outputs.
 *
 * Setting the `emits` field to `[]` will disable logging for the specified events.
 *
 * See {@link DataAPIClientEventMap} & {@link LoggingConfig} for much more info.
 *
 * @see LoggingConfig
 * @see LoggingEvent
 * @see LoggingOutput
 *
 * @public
 */
export interface ExplicitLoggingConfig {
  readonly events: LoggingEvent | (Exclude<LoggingEvent, 'all'>)[],
  readonly emits: OneOrMany<LoggingOutput>,
}
