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

import type { BaseClientEvent, LoggingConfig } from '@/src/lib/index.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import type { ParsedLoggingConfig } from '@/src/lib/logging/cfg-handler.js';

/**
 * ##### Overview
 *
 * A lightweight event system that allows hierarchical event propagation (similar to DOM event bubbling).
 *
 * Events triggered on a child (e.g., a `Collection`) will propagate up to its parent (e.g., the parent `Db` and its parent `DataAPIClient`),
 * unless explicitly stopped.
 *
 * _This allows to quickly (and granular-ly) enable listen for events at any level of the hierarchy_, and stop propagation at any level if needed.
 *
 * ##### Event Hierarchy
 *
 * Events follow a structured hierarchy:
 *
 * - `Collection | Table` → `Db` → `Client`
 * - `AstraAdmin | DbAdmin` → `Client`
 *
 * If, for instance, you have two different `Collection` objects which both point to the same collection, _only the one that triggered the event will be notified._
 *
 * @example
 * ```ts
 * const client = new DataAPIClient({ logging: 'all' });
 *
 * client.on('commandFailed', (event) => {
 *   console.error('Some command failed:', event.commandName, event.error);
 * });
 *
 * const db = client.db('*ENDPOINT*', { token: '*TOKEN*' });
 * const collection = db.collection('test_coll');
 *
 * collection.on('commandFailed', (event) => {
 *   event.stopPropagation(); // Prevents bubbling up to the client
 *   console.error('test_coll command failed:', event.commandName, event.error);
 * });
 *
 * collection.insertOne({ '$invalid-key': 'value' });
 * ```
 *
 * ##### On errors in listeners
 *
 * If an error is thrown in a listener, it will be silently ignored and will not stop the propagation of the event.
 *
 * If you need to handle errors in listeners, you must wrap the listener in a try/catch block yourself.
 *
 * @remarks
 * Having a custom implementation avoids a dependency on `events` for maximum compatibility across environments & module systems.
 *
 * @see DataAPIClientEventMap
 *
 * @public
 */
export class HierarchicalLogger<Events extends Record<string, BaseClientEvent>> {
  /**
   * @internal
   */
  public internal: InternalLogger<Events>;

  /**
   * Should not be instantiated be the user directly.
   *
   * @internal
   */
  protected constructor(parent: HierarchicalLogger<Events> | null, config: ParsedLoggingConfig) {
    this.internal = new InternalLogger(config, parent?.internal, console);
  }

  public updateLoggingConfig(config: LoggingConfig) {
    this.internal = this.internal.withUpdatedConfig(InternalLogger.cfg.parse(config));
  }

  /**
   * Subscribe to an event.
   *
   * @param eventName - The event to listen for.
   * @param listener - The callback to invoke when the event is emitted.
   *
   * @returns A function to unsubscribe the listener.
   */
  public on<E extends keyof Events>(eventName: E, listener: (event: Events[E]) => void): () => void {
    this.internal.on(eventName, listener);

    return () => {
      this.off(eventName, listener);
    };
  }

  /**
   * Unsubscribe from an event.
   *
   * @param eventName - The event to unsubscribe from.
   * @param listener - The listener to remove.
   */
  public off<E extends keyof Events>(eventName: E, listener: (event: Events[E]) => void): void {
    return this.internal.off(eventName, listener);
  }

  /**
   * Subscribe to an event once.
   *
   * The listener will be automatically unsubscribed after the first time it is called.
   *
   * Note that the listener will be unsubscribed BEFORE the actual listener callback is invoked.
   *
   * @param eventName - The event to listen for.
   * @param listener - The callback to invoke when the event is emitted.
   *
   * @returns A function to prematurely unsubscribe the listener.
   */
  public once<E extends keyof Events>(eventName: E, listener: (event: Events[E]) => void): () => void {
    const off = this.on(eventName, (event) => {
      off();
      listener(event);
    });
    return off;
  }

  /**
   * Remove all listeners for an event.
   *
   * If no event is provided, all listeners for all events will be removed.
   *
   * @param eventName - The event to remove listeners for.
   */
  public removeAllListeners<E extends keyof Events>(eventName?: E): void {
    return this.internal.removeAllListeners(eventName);
  }
}
