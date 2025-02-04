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
 * Generic event map type.
 *
 * @public
 */
export type EventMap = Record<string, (...args: any[]) => void>;

/**
 * Type-safe event emitter.
 *
 * Vendored from https://github.com/andywer/typed-emitter
 *
 * @public
 */
export interface TypedEmitter<Events extends EventMap> {
  addListener<E extends keyof Events> (event: E, listener: Events[E]): this
  on<E extends keyof Events> (event: E, listener: Events[E]): this
  once<E extends keyof Events> (event: E, listener: Events[E]): this
  prependListener<E extends keyof Events> (event: E, listener: Events[E]): this
  prependOnceListener<E extends keyof Events> (event: E, listener: Events[E]): this

  off<E extends keyof Events>(event: E, listener: Events[E]): this
  removeAllListeners<E extends keyof Events> (event?: E): this
  removeListener<E extends keyof Events> (event: E, listener: Events[E]): this

  emit<E extends keyof Events> (event: E, ...args: Parameters<Events[E]>): boolean
  eventNames (): (keyof Events | string | symbol)[]
  rawListeners<E extends keyof Events> (event: E): Events[E][]
  listeners<E extends keyof Events> (event: E): Events[E][]
  listenerCount<E extends keyof Events> (event: E): number

  getMaxListeners (): number
  setMaxListeners (maxListeners: number): this
}
