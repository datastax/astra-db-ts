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
 * The base class of all events that may be emitted/logged by the {@link DataAPIClient}.
 *
 * See {@link DataAPIClientEventMap} & {@link DataAPILoggingConfig} for much more info.
 *
 * @public
 */
export abstract class DataAPIClientEvent {
  /**
   * The name of the event.
   */
  public readonly name: string;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string) {
    this.name = name;
  }

  /**
   * Returns the event in a formatted string, as it would be logged to stdout/stderr (if enabled).
   */
  public formatted(): string {
    return `${DataAPIClientEvent.formattedPrefix()}[${this.name}]`;
  }

  /**
   * Formats the current date in a way that is suitable for logging.
   *
   * @internal
   */
  public static formattedPrefix(): string {
    const date = new Date();
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:${date.getUTCSeconds().toString().padStart(2, '0')}Z `;
  }
}
