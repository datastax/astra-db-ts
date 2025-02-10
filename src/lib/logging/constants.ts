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

import type {
  DataAPIClientEventMap,
  DataAPILoggingEvent,
  DataAPILoggingOutput,
} from '@/src/lib/index.js';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent, CommandWarningsEvent } from '@/src/documents/index.js';
import {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminCommandWarningsEvent,
} from '@/src/administration/events.js';
import { buildOutputsMap } from '@/src/lib/logging/util.js';
import type { ParsedLoggingConfig } from '@/src/lib/logging/cfg-handler.js';
import type { InternalLoggingOutputsMap } from '@/src/lib/logging/logger.js';
import { EqualityProof } from '@/src/lib/utils.js';

/**
 * @internal
 */
export const LoggingEvents = <const>['all', 'adminCommandStarted', 'adminCommandPolling', 'adminCommandSucceeded', 'adminCommandFailed', 'adminCommandWarnings', 'commandStarted', 'commandFailed', 'commandSucceeded', 'commandWarnings'];
void EqualityProof<typeof LoggingEvents[number], Exclude<DataAPILoggingEvent, RegExp>, true>;

/**
 * @internal
 */
export const LoggingEventsWithoutAll = LoggingEvents.filter((e) => e !== 'all');
void EqualityProof<typeof LoggingEventsWithoutAll[number], Exclude<DataAPILoggingEvent, 'all' | RegExp>, true>;

/**
 * @internal
 */
export const LoggingOutputs = <const>['event', 'stdout', 'stderr', 'stdout:verbose', 'stderr:verbose'];
void EqualityProof<typeof LoggingOutputs[number], DataAPILoggingOutput, true>;

/**
 * @internal
 */
export const PrintLoggingOutputs = LoggingOutputs.filter((o) => o !== 'event');
void EqualityProof<typeof PrintLoggingOutputs[number], Exclude<DataAPILoggingOutput, 'event'>, true>;

/**
 * @internal
 */
export const EventConstructors = <const>{
  commandFailed:         CommandFailedEvent,
  commandStarted:        CommandStartedEvent,
  commandWarnings:       CommandWarningsEvent,
  commandSucceeded:      CommandSucceededEvent,
  adminCommandFailed:    AdminCommandFailedEvent,
  adminCommandStarted:   AdminCommandStartedEvent,
  adminCommandPolling:   AdminCommandPollingEvent,
  adminCommandWarnings:  AdminCommandWarningsEvent,
  adminCommandSucceeded: AdminCommandSucceededEvent,
} satisfies Record<keyof DataAPIClientEventMap, unknown>;

/**
 * @internal
 */
export const EmptyInternalLoggingConfig = Object.fromEntries(LoggingEventsWithoutAll.map((e) => [e, buildOutputsMap([])])) as InternalLoggingOutputsMap;

/**
 * @internal
 */
export const LoggingDefaults: ParsedLoggingConfig['layers'] = [{
  events: LoggingEventsWithoutAll.filter((e) => e !== 'commandStarted' && e !== 'commandSucceeded'),
  emits: ['event', 'stderr'],
}, {
  events: ['commandStarted', 'commandSucceeded'],
  emits: ['event'],
}];

/**
 * @internal
 */
export const LoggingDefaultOutputs = <const>{
  adminCommandStarted:   ['event', 'stdout'],
  adminCommandPolling:   ['event', 'stdout'],
  adminCommandSucceeded: ['event', 'stdout'],
  adminCommandFailed:    ['event', 'stderr'],
  adminCommandWarnings:  ['event', 'stderr'],
  commandStarted:        ['event'          ],
  commandFailed:         ['event', 'stderr'],
  commandSucceeded:      ['event'          ],
  commandWarnings:       ['event', 'stderr'],
};
