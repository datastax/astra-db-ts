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
import { DataAPIClientEvents, DataAPILoggingEvent, DataAPILoggingOutput } from '@/src/lib';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent, CommandWarningsEvent } from '@/src/documents';
import {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent, AdminCommandWarningsEvent,
} from '@/src/administration';
import { buildOutputsMap } from '@/src/lib/logging/util';
import { InternalLoggingConfig } from '@/src/client/types/internal';
import { NormalizedLoggingConfig } from '@/src/lib/logging/types';

export const LoggingEvents = <const>['all', 'adminCommandStarted', 'adminCommandPolling', 'adminCommandSucceeded', 'adminCommandFailed', 'adminCommandWarnings', 'commandStarted', 'commandFailed', 'commandSucceeded', 'commandWarnings'];
export const LoggingEventsWithoutAll = LoggingEvents.filter((e) => e !== 'all');
void EqualityProof<typeof LoggingEvents[number], DataAPILoggingEvent, true>;

export const LoggingOutputs = <const>['event', 'stdout', 'stderr'];
void EqualityProof<typeof LoggingOutputs[number], DataAPILoggingOutput, true>;

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
} satisfies Record<keyof DataAPIClientEvents, unknown>;

export const EmptyInternalLoggingConfig = Object.fromEntries(LoggingEventsWithoutAll.map((e) => [e, buildOutputsMap([])])) as InternalLoggingConfig;

export const EventLoggingOutputDefaults = <const>{
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

export const EventLoggingDefaults: NormalizedLoggingConfig[] = [{
  events: ['adminCommandStarted', 'adminCommandPolling', 'adminCommandSucceeded'],
  emits: ['event', 'stdout'],
}, {
  events: ['adminCommandFailed', 'commandFailed', 'commandWarnings', 'adminCommandWarnings'],
  emits: ['event', 'stderr'],
}, {
  events: ['commandStarted', 'commandSucceeded'],
  emits: ['event'],
}];
