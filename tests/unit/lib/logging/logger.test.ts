// // Copyright DataStax, Inc.
// //
// // Licensed under the Apache License, Version 2.0 (the "License");
// // you may not use this file except in compliance with the License.
// // You may obtain a copy of the License at
// //
// // http://www.apache.org/licenses/LICENSE-2.0
// //
// // Unless required by applicable law or agreed to in writing, software
// // distributed under the License is distributed on an "AS IS" BASIS,
// // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// // See the License for the specific language governing permissions and
// // limitations under the License.
//
// import { describe, it } from '@/tests/testlib';
// import assert from 'assert';
// import { parseLoggingConfig } from '@/src/lib/logging/parser';
// import { Logger } from '@/src/lib/logging/logger';
// import { DataAPILoggingDefaults, LoggingEventsWithoutAll } from '@/src/lib/logging/constants';
// import { DataAPIClientEventMap, DataAPILoggingConfig } from '@/src/lib';
// import { beforeEach } from 'mocha';
// import TypedEmitter from 'typed-emitter';
// import { CommandStartedEvent } from '@/src/documents';
// import { AdminCommandStartedEvent } from '@/src/administration';
// import { ParsedLoggingConfig } from '@/src/lib/logging/cfg-handler';
//
// describe('unit.lib.logging.logger', () => {
//   describe('parseConfig', () => {
//     it('is a pass-through method', () => {
//       assert.strictEqual(Logger.parseConfig, parseLoggingConfig);
//     });
//   });
//
//   describe('advanceConfig', () => {
//     it('should return undefined if both params are nullish', () => {
//       assert.strictEqual(Logger.advanceConfig(undefined, null!), undefined);
//     });
//
//     it('should append empty array if new config is nullish', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([], undefined), []);
//       assert.deepStrictEqual(Logger.advanceConfig([3 as any], null!), [3]);
//     });
//
//     it('should return config without prepending old config when latter is nullish', () => {
//       assert.deepStrictEqual(Logger.advanceConfig(undefined, []), []);
//     });
//
//     it('should return EventLoggingDefaults if config is just \'all\'', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([3 as any], 'all'), [3, ...DataAPILoggingDefaults]);
//     });
//
//     it('should return EventLoggingDefaults if config is just [\'all\']', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([3 as any], ['all']), [3, ...DataAPILoggingDefaults]);
//     });
//
//     it('should return EventLoggingDefaults alongside overrides if config contains [\'all\']', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([3 as any], ['all', { events: 'commandSucceeded', emits: [] }]), [3, ...DataAPILoggingDefaults, { events: ['commandSucceeded'], emits: [] }]);
//     });
//
//     it('should return normalized layer if config contains [\'all\'] w/ explicit emits', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([], [{ events: 'all', emits: ['event'] }]), [{ events: LoggingEventsWithoutAll, emits: ['event'] }]);
//     });
//
//     it('should error if config[*].events has [\'all\', ...]', () => {
//       assert.throws(() => Logger.advanceConfig([], [{ events: ['commandSucceeded', 'all'], emits: [] }]), { message: 'Nonsensical logging configuration; can not have \'all\' in a multi-element array (@ idx 0)' });
//     });
//
//     it('should normalize config if config is string', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([], 'commandSucceeded'), [{ events: ['commandSucceeded'], emits: ['event'] }]);
//       assert.deepStrictEqual(Logger.advanceConfig([], 'commandFailed'), [{ events: ['commandFailed'], emits: ['event', 'stderr'] }]);
//     });
//
//     it('should normalize config if config is string[]', () => {
//       assert.deepStrictEqual(Logger.advanceConfig([], ['commandSucceeded']), [{ events: ['commandSucceeded'], emits: ['event'] }]);
//       assert.deepStrictEqual(Logger.advanceConfig([], ['commandSucceeded', 'commandFailed']), [{ events: ['commandSucceeded'], emits: ['event'] }, { events: ['commandFailed'], emits: ['event', 'stderr'] }]);
//     });
//
//     it('should handle absolute madness', () => {
//       const config: DataAPILoggingConfig = [
//         'commandSucceeded',
//         { events: 'all', emits: ['stderr'] },
//         { events: ['all'], emits: 'stdout' },
//         'commandFailed',
//         { events: ['commandFailed', 'commandSucceeded'], emits: [] },
//         { events: ['commandSucceeded', 'commandFailed'], emits: 'stdout' },
//         { events: ['commandSucceeded', 'commandFailed'], emits: ['event', 'stderr'] },
//         'all',
//         'commandSucceeded',
//       ];
//       const expected: ParsedLoggingConfig = [
//         3 as any,
//         { events: ['commandSucceeded'], emits: ['event'] },
//         { events: LoggingEventsWithoutAll, emits: ['stderr'] },
//         { events: LoggingEventsWithoutAll, emits: ['stdout'] },
//         { events: ['commandFailed'], emits: ['event', 'stderr'] },
//         { events: ['commandFailed', 'commandSucceeded'], emits: [] },
//         { events: ['commandSucceeded', 'commandFailed'], emits: ['stdout'] },
//         { events: ['commandSucceeded', 'commandFailed'], emits: ['event', 'stderr'] },
//         ...DataAPILoggingDefaults,
//         { events: ['commandSucceeded'], emits: ['event'] },
//       ];
//       assert.deepStrictEqual(Logger.advanceConfig([3 as any], config), expected);
//     });
//   });
//
//   describe('constructor', () => {
//     let stdout: string[] = [], stderr: string[] = [], events: [string, unknown][] = [];
//
//     const fauxConsole = {
//       log(msg) {
//         stdout.push(msg);
//       },
//       error(msg) {
//         stderr.push(msg);
//       },
//     } as Console;
//
//     const emitter = {
//       emit(name, thing) {
//         events.push([name, thing]);
//       },
//     } as TypedEmitter<DataAPIClientEventMap>;
//
//     beforeEach(() => {
//       stdout = [];
//       stderr = [];
//       events = [];
//     });
//
//     it('should error on setting both stdout and stderr for same thing', () => {
//       assert.throws(() => new Logger([{ events: ['commandSucceeded'], emits: ['stdout', 'stderr'] }], emitter, fauxConsole), { message: 'Nonsensical logging configuration; attempted to set both stdout and stderr outputs for \'commandSucceeded\'' });
//     });
//
//     it('should not log when "off"', () => {
//       const logger = new Logger([], emitter, fauxConsole);
//       assert.strictEqual(logger.commandStarted, undefined);
//       assert.strictEqual(logger.adminCommandStarted, undefined);
//       assert.strictEqual(logger.adminCommandFailed, undefined);
//     });
//
//     it('should handle default logging behavior', () => {
//       const logger = new Logger(DataAPILoggingDefaults, emitter, fauxConsole);
//       logger.commandStarted?.({ timeoutManager: { initial: () => ({}) }, command: {} } as any);
//       assert.strictEqual(events.at(-1)?.[0], 'commandStarted');
//       assert.ok(events.at(-1)?.[1] instanceof CommandStartedEvent);
//       logger.adminCommandStarted?.({} as any, true, {});
//       assert.strictEqual(events.at(-1)?.[0], 'adminCommandStarted');
//       assert.ok(events.at(-1)?.[1] instanceof AdminCommandStartedEvent);
//       assert.strictEqual(stderr.at(-1), (<any>events.at(-1)?.[1]).formatted());
//       assert.strictEqual(events.length, 2);
//       assert.strictEqual(stdout.length, 0);
//       assert.strictEqual(stderr.length, 1);
//     });
//
//     it('should not log events if not enabled', () => {
//       const logger = new Logger([{ events: ['commandStarted'], emits: ['stdout'] }], emitter, fauxConsole);
//       logger.commandStarted?.({ timeoutManager: { initial: () => ({}) }, command: {} } as any);
//       assert.strictEqual(events.length, 0);
//       assert.strictEqual(stdout.length, 1);
//       assert.strictEqual(stderr.length, 0);
//     });
//   });
// });
