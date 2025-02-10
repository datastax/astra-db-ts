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
 * A minimal event emitter implementation that allows for subscribing to and emitting events.
 *
 * Avoids a dependency on `events` for maximum compatibility across environments & module systems.
 *
 * Will not be used directly, but rather through the {@link DataAPIClient} to emit events from the {@link DataAPIClientEventMap} for logging/monitoring purposes.
 *
 * @example
 * ```ts
 * const client = new DataAPIClient({ logging: 'all' });
 *
 * client.on('commandFailed', (event) => {
 *   console.error('Command failed:', event.commandName, event.error);
 * });
 * ```
 *
 * @public
 */
export class ClientEmitter<Events extends Record<string, BaseClientEvent>> {
  /**
   * @internal
   */
  readonly #listeners: Partial<Record<keyof Events, ((event: any) => void)[]>> = {};

  /**
   * @internal
   */
  readonly #parent: Pick<ClientEmitter<Events>, 'emit'> | null;

  /**
   * Should not be instantiated be the user directly.
   *
   * @internal
   */
  protected constructor(parent: Pick<ClientEmitter<Events>, 'emit'> | null) {
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
}
