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

import assert from 'assert';
import { describe, it } from '@/tests/testlib/index.js';
import { Logger } from '@/src/lib/logging/logger.js';
import type { LoggingConfig } from '@/src/lib/index.js';
import {
  LoggingDefaultOutputs,
  LoggingDefaults,
  LoggingEventsWithoutAll,
  LoggingOutputs,
} from '@/src/lib/logging/constants.js';
import { OptionParseError } from '@/src/lib/opts-handler.js';
import { ensureMonoidalHandlerIsActuallyAMonoid } from '@/tests/testlib/opts-handler/validate-monoid.js';

describe('unit.lib.logging.cfg-handler', () => {
  describe('parse', () => {
    const parseEq = (cfg: LoggingConfig | undefined, layers: unknown) => {
      assert.deepStrictEqual(Logger.cfg.parse(cfg), { layers });
    };

    const parseErr = (cfg: any) => {
      assert.throws(() => Logger.cfg.parse(cfg), OptionParseError);
    };

    it('should return the empty value on null/undefined', () => {
      parseEq(null!, Logger.cfg.empty.layers);
      parseEq(undefined, Logger.cfg.empty.layers);
    });

    it('should substitute "all" with all events', () => {
      parseEq('all', LoggingDefaults);
      parseEq([{ events: 'all', emits: ['event'] }], [{ events: LoggingEventsWithoutAll, emits: ['event'] }]);
    });

    it('should parse a single event', () => {
      for (const event of LoggingEventsWithoutAll) {
        const exp = { events: [event], emits: LoggingDefaultOutputs[event] };
        parseEq(event, [exp]);
        parseEq([event], [exp]);
        parseEq([event, new RegExp(event), event], [exp, exp, exp]);
      }
    });

    it('should allow regex for event names', () => {
      const events1 = LoggingEventsWithoutAll.filter(e => e.startsWith('command'));
      parseEq(/command.*/, events1.map(e => ({ events: [e], emits: LoggingDefaultOutputs[e] })));

      const events2 = ['adminCommandStarted', 'commandStarted', 'adminCommandPolling', 'adminCommandFailed', 'commandFailed'] as const;
      parseEq([/.*Started/, 'adminCommandPolling', /.*Failed/], events2.map(e => ({ events: [e], emits: LoggingDefaultOutputs[e] })));

      const events3 = ['adminCommandStarted', 'commandStarted'] as const;
      parseEq([{ events: /.*Started/, emits: ['event', 'stdout:verbose'] }], [{ events: events3, emits: ['event', 'stdout:verbose'] }]);

      const events4 = ['adminCommandStarted', 'commandStarted', 'adminCommandPolling'] as const;
      parseEq([{ events: [/.*Started/, 'adminCommandPolling'], emits: 'stderr:verbose' }], [{ events: events4, emits: ['stderr:verbose'] }]);
    });

    it('should parse valid outputs', () => {
      for (const emit of LoggingOutputs) {
        const exp = { events: ['commandSucceeded'], emits: [emit] };
        parseEq([{ events: 'commandSucceeded', emits: emit }], [exp]);
        parseEq([{ events: 'commandSucceeded', emits: [emit] }], [exp]);
      }
    });

    it('should throw on invalid configs', () => {
      // Doesn't make sense to have an empty events array
      parseErr([{ events: [], emits: [] }]);

      // Doesn't make sense to have 'all' in events array
      parseErr([{ events: ['all'], emits: [] }]);
      parseErr([{ events: ['commandSucceeded', 'all'], emits: [] }]);

      // Various disallowed types
      parseErr(3);
      parseErr(['all', null]);
      parseErr([3, null]);
      parseErr({ events: 'commandSucceeded', emits: [] });
      parseErr([{ events: 'commandSucceeded' }]);
      parseErr([{ events: ['all'], emits: ['verbose'] }]);
      parseErr([{ events: ['all'], emits: [':verbose'] }]);
      parseErr([{ events: 'commandSucceeded', emits: undefined }]);
      parseErr([{ emits: ['stdout'] }]);
      parseErr([{ events: 'car', emits: [] }]);
      parseErr([{ events: ['commandSucceeded'], emits: ['stdout', 'car'] }]);
      parseErr([{ events: 3, emits: [] }]);
      parseErr([{ events: ['all'], emits: 3 }]);
      parseErr([{ events: ['commandSucceeded', 3], emits: [] }]);
      parseErr([{ events: 'all', emits: [3] }]);
      parseErr([{ events: [null!], emits: [] }]);
      parseErr([{ events: 'all', emits: ['event', 'idk' as any] }]);
      parseErr(['all', { events: ['idk' as any], emits: [] }]);
    });

    it('should parse valid multi-layer configs', () => {
      parseEq([{ events: 'all', emits: ['stderr'] }, { events: 'commandFailed', emits: [] }], [
        { events: LoggingEventsWithoutAll, emits: ['stderr'] },
        { events: ['commandFailed'], emits: [] },
      ]);

      parseEq(['all', { events: 'all', emits: ['stderr'] }, { events: ['adminCommandFailed', 'commandFailed'], emits: [] }, 'commandFailed'], [
        ...LoggingDefaults,
        { events: LoggingEventsWithoutAll, emits: ['stderr'] },
        { events: ['adminCommandFailed', 'commandFailed'], emits: [] },
        { events: ['commandFailed'], emits: LoggingDefaultOutputs.commandFailed },
      ]);

      parseEq(['all', { events: /.*/, emits: ['stderr'] }, { events: [/.*Failed/], emits: [] }, /commandFailed/], [
        ...LoggingDefaults,
        { events: LoggingEventsWithoutAll, emits: ['stderr'] },
        { events: ['adminCommandFailed', 'commandFailed'], emits: [] },
        { events: ['commandFailed'], emits: LoggingDefaultOutputs.commandFailed },
      ]);
    });
  });

  describe('concat', () => {
    const layer1 = Logger.cfg.parse('all');
    const layer2 = Logger.cfg.parse([{ events: 'all', emits: ['stderr'] }]);
    const layer3 = Logger.cfg.parse([{ events: ['commandFailed', 'adminCommandFailed'], emits: [] }]);
    const layer4 = layer1;

    it('should properly concatenate layers from left to right', () => {
      assert.deepStrictEqual(Logger.cfg.concat([layer1, layer2, layer3, layer4]), {
        layers: [layer1.layers, layer2.layers, layer3.layers, layer4.layers].flat(),
      });
    });

    ensureMonoidalHandlerIsActuallyAMonoid(Logger.cfg, [layer1, layer2, layer3, layer4]);
  });
});
