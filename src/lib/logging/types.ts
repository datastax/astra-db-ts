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
// noinspection DuplicatedCode

import { DataAPICommandEvents } from '@/src/documents';
import { AdminCommandEvents } from '@/src/administration';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * Events include:
 * - `commandStarted` - Emitted when a command is started, before the initial HTTP request is made.
 * - `commandSucceeded` - Emitted when a command has succeeded.
 * - `commandFailed` - Emitted when a command has errored.
 * - `adminCommandStarted` - Emitted when an admin command is started, before the initial HTTP request is made.
 * - `adminCommandPolling` - Emitted when a command is polling in a long-running operation (i.e. create database).
 * - `adminCommandSucceeded` - Emitted when an admin command has succeeded, after any necessary polling.
 * - `adminCommandFailed` - Emitted when an admin command has errored.
 *
 * @public
 */
export type DataAPIClientEvents =
  & DataAPICommandEvents
  & AdminCommandEvents;

export type DataAPILoggingConfig = DataAPILoggingEvent | readonly (DataAPILoggingEvent | DataAPIExplicitLoggingConfig)[]

export type DataAPILoggingEvent = 'all' | keyof DataAPIClientEvents;
export type DataAPILoggingOutput = 'event' | 'stdout' | 'stderr';

export interface DataAPIExplicitLoggingConfig {
  readonly events: DataAPILoggingEvent | readonly DataAPILoggingEvent[],
  readonly emits: DataAPILoggingOutput | readonly DataAPILoggingOutput[],
}

export interface NormalizedLoggingConfig {
  events: readonly DataAPILoggingEvent[],
  emits: readonly DataAPILoggingOutput[],
}
