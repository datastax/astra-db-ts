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
 * A minimal event emitter, to avoid a dependency on `events` for maximum compatibility.
 *
 * @public
 */
export class MicroEmitter<Events extends Record<string, (...args: any[]) => void>> {
  /**
   * @internal
   */
  readonly #listeners: Partial<Record<keyof Events, ((...args: any[]) => void)[]>> = {};

  public on<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    if (!this.#listeners[event]) {
      this.#listeners[event] = [];
    }

    this.#listeners[event].push(listener);

    return () => {
      this.off(event, listener);
    };
  }

  public off<E extends keyof Events>(event: E, listener: Events[E]): void {
    if (!this.#listeners[event]) {
      return;
    }

    const index = this.#listeners[event].indexOf(listener);

    if (index !== -1) {
      this.#listeners[event].splice(index, 1);
    }
  }

  public once<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener as Events[E]);
      listener(...args);
    };
    return this.on(event, onceListener as Events[E]);
  }

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
