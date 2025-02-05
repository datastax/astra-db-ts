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
 * client.on('commandFailed', (evt) => {
 *   console.error('Command failed:', evt.commandName, evt.error);
 * });
 * ```
 *
 * @public
 */
export class MicroEmitter<Events extends Record<string, (...args: any[]) => void>> {
  /**
   * @internal
   */
  readonly #listeners: Partial<Record<keyof Events, ((...args: any[]) => void)[]>> = {};

  /**
   * Subscribe to an event.
   *
   * @param event - The event to listen for.
   * @param listener - The callback to invoke when the event is emitted.
   *
   * @returns A function to unsubscribe the listener.
   */
  public on<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    if (!this.#listeners[event]) {
      this.#listeners[event] = [];
    }

    this.#listeners[event].push(listener);

    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Unsubscribe from an event.
   *
   * @param event - The event to unsubscribe from.
   * @param listener - The listener to remove.
   */
  public off<E extends keyof Events>(event: E, listener: Events[E]): void {
    if (!this.#listeners[event]) {
      return;
    }

    const index = this.#listeners[event].indexOf(listener);

    if (index !== -1) {
      this.#listeners[event].splice(index, 1);
    }
  }

  /**
   * Subscribe to an event once.
   *
   * The listener will be automatically unsubscribed after the first time it is called.
   *
   * Note that the listener will be unsubscribed BEFORE the actual listener callback is invoked.
   *
   * @param event - The event to listen for.
   * @param listener - The callback to invoke when the event is emitted.
   *
   * @returns A function to prematurely unsubscribe the listener.
   */
  public once<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener as Events[E]);
      listener(...args);
    };
    return this.on(event, onceListener as Events[E]);
  }

  /**
   * Emit an event.
   *
   * Should probably never be used by the user directly.
   *
   * @param event - The event to emit.
   * @param args - Any arguments to pass to the listeners.
   *
   * @returns `true` if the event had listeners, `false` otherwise.
   */
  public emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean {
    if (!this.#listeners[event]) {
      return false;
    }
    for (const listener of this.#listeners[event]) {
      listener(...args);
    }
    return true;
  }
}
