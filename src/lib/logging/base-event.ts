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
   * @internal
   */
  public declare _propagationState: PropagationState;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string) {
    this.name = name;

    Object.defineProperty(this, '_propagationState', {
      value: PropagationState.Continue,
      enumerable: false,
      writable: true,
    });
  }

  /**
   * Returns the event in a formatted string, as it would be logged to stdout/stderr (if enabled).
   */
  public format(): string {
    return `[${this.name}]`;
  }

  /**
   * Returns the event in a verbose string format, including all properties, as it would be logged to stdout/stderr (if enabled).
   */
  public formatVerbose(): string {
    return JSON.stringify(this, null, 2);
  }

  /**
   * Formats the current date in a way that is suitable for logging.
   */
  public formatPrefix(): string {
    const date = new Date();
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:${date.getUTCSeconds().toString().padStart(2, '0')}Z `;
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
