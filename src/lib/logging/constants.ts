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

import { EqualityProof } from '@/src/lib/validation';
import type {
  DataAPIClientEventMap,
  DataAPILoggingEvent,
  DataAPILoggingOutput,
} from '@/src/lib';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent, CommandWarningsEvent } from '@/src/documents';
import {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminCommandWarningsEvent,
} from '@/src/administration/events';
import { buildOutputsMap } from '@/src/lib/logging/util';
import { ParsedLoggingConfig } from '@/src/lib/logging/cfg-handler';
import { InternalLoggingOutputsMap } from '@/src/lib/logging/logger';

/**
 * @internal
 */
export const LoggingEvents = <const>['all', 'adminCommandStarted', 'adminCommandPolling', 'adminCommandSucceeded', 'adminCommandFailed', 'adminCommandWarnings', 'commandStarted', 'commandFailed', 'commandSucceeded', 'commandWarnings'];

/**
 * @internal
 */
export const LoggingEventsWithoutAll = LoggingEvents.filter((e) => e !== 'all');
void EqualityProof<typeof LoggingEvents[number], DataAPILoggingEvent, true>;

/**
 * @internal
 */
export const LoggingOutputs = <const>['event', 'stdout', 'stderr'];
void EqualityProof<typeof LoggingOutputs[number], DataAPILoggingOutput, true>;

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
export const DataAPILoggingDefaultOutputs = <const>{
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

/**
 * @internal
 */
export const DataAPILoggingDefaults: ParsedLoggingConfig['layers'] = [{
  events: LoggingEventsWithoutAll,
  emits: ['event', 'stderr'],
}, {
  events: ['commandStarted', 'commandSucceeded'],
  emits: ['event'],
}];
