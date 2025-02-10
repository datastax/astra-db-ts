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

import type { BaseClientEvent} from '@/src/lib/index.js';
import { PropagationState } from '@/src/lib/index.js';

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
 * @remarks
 * Having such an implementation avoids a dependency on `events` for maximum compatibility across environments & module systems.
 *
 * @see DataAPIClientEventMap
 *
 * @public
 */
export class HierarchicalEmitter<Events extends Record<string, BaseClientEvent>> {
  /**
   * @internal
   */
  readonly #listeners: Partial<Record<keyof Events, ((event: any) => void)[]>> = {};

  /**
   * @internal
   */
  readonly #parent: Pick<HierarchicalEmitter<Events>, 'emit'> | null;

  /**
   * Should not be instantiated be the user directly.
   *
   * @internal
   */
  protected constructor(parent: Pick<HierarchicalEmitter<Events>, 'emit'> | null) {
    this.#parent = parent;
  }

  /**
   * Subscribe to an event.
   *
   * @param eventName - The event to listen for.
   * @param listener - The callback to invoke when the event is emitted.
   *
   * @returns A function to unsubscribe the listener.
   */
  public on<E extends keyof Events>(eventName: E, listener: (e: Events[E]) => void): () => void {
    if (!this.#listeners[eventName]) {
      this.#listeners[eventName] = [];
    }

    this.#listeners[eventName].push(listener);

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
  public off<E extends keyof Events>(eventName: E, listener: (e: Events[E]) => void): void {
    if (!this.#listeners[eventName]) {
      return;
    }

    const index = this.#listeners[eventName].indexOf(listener);

    if (index !== -1) {
      this.#listeners[eventName].splice(index, 1);
    }
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
  public once<E extends keyof Events>(eventName: E, listener: (e: Events[E]) => void): () => void {
    const onceListener = (event: Events[E]) => {
      this.off(eventName, onceListener);
      listener(event);
    };
    return this.on(eventName, onceListener);
  }

  /**
   * Emit an event.
   *
   * Should probably never be used by the user directly.
   *
   * @param eventName - The event to emit.
   * @param event - Any arguments to pass to the listeners.
   *
   * @returns `true` if the event had listeners, `false` otherwise.
   */
  public emit<E extends keyof Events>(eventName: E, event: Events[E]): void {
    if (this.#listeners[eventName]) {
      for (const listener of this.#listeners[eventName]) {
        listener(event);

        if (event._propagationState === PropagationState.StopImmediate) {
          return;
        }
      }
    }

    if (this.#parent && event._propagationState !== PropagationState.Stop) {
      this.#parent.emit(eventName, event);
    }
  }

  /**
   * Remove all listeners for an event.
   *
   * If no event is provided, all listeners for all events will be removed.
   *
   * @param eventName - The event to remove listeners for.
   */
  public removeAllListeners<E extends keyof Events>(eventName?: E): void {
    if (eventName) {
      delete this.#listeners[eventName];
    } else {
      for (const key in this.#listeners) {
        delete this.#listeners[key];
      }
    }
  }
}
