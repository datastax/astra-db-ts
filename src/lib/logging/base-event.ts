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

/**
 * @internal
 */
export const enum PropagationState {
  Continue = 0,
  Stop = 1,
  StopImmediate = 2
}

/**
 * @public
 */
export interface EventFormatOptions {
  timestamp?: boolean;
  name?: boolean;
}

/**
 * The base class of all events that may be emitted/logged by the {@link DataAPIClient}.
 *
 * See {@link DataAPIClientEventMap} & {@link LoggingConfig} for much more info.
 *
 * @public
 */
export abstract class BaseClientEvent {
  /**
   * The name of the event.
   */
  public readonly name: string;

  /**
   * The unique identifier of the request that caused this event.
   *
   * This is generated for each request and is used to correlate events across the lifecycle of a request.
   *
   * Represented by a UUID v4 string.
   *
   * **Note that this represents _real_ requests to the Data/DevOps API**. Methods such as `collection.insertMany(...)` may generate multiple requests under the hood, each with their own unique `requestId`.
   */
  public readonly requestId: string;

  /**
   * @internal
   */
  public declare _propagationState: PropagationState;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string, requestId: string) {
    this.name = name;
    this.requestId = requestId;

    Object.defineProperty(this, '_propagationState', {
      value: PropagationState.Continue,
      enumerable: false,
      writable: true,
    });
  }

  /**
   * Returns the event in a formatted string, as it would be logged to stdout/stderr (if enabled).
   */
  public format(options?: EventFormatOptions): string {
    let formatted = '';

    if (options?.timestamp !== false) {
      const date = new Date();
      return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:${date.getUTCSeconds().toString().padStart(2, '0')}Z `;
    }

    if (options?.name !== false) {
      formatted += `[${this.name}]: `;
    }

    return formatted;
  }

  /**
   * Returns the event in a verbose string format, including all properties, as it would be logged to stdout/stderr (if enabled).
   */
  public formatVerbose(): string {
    return JSON.stringify(this, null, 2);
  }

  /**
   * Stops the event from bubbling up to the parent listener (e.g. `Collection` → `Db` → `DataAPIClient`).
   */
  public stopPropagation(): void {
    this._propagationState = PropagationState.Stop;
  }

  /**
   * Stops the event from bubbling up to the parent listener (e.g. `Collection` → `Db` → `DataAPIClient`) and prevents any further listeners from being called.
   */
  public stopImmediatePropagation(): void {
    this._propagationState = PropagationState.StopImmediate;
  }
}
