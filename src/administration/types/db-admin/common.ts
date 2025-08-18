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
 * The lifecycle status of a model indicating its current support level.
 *
 * - `'SUPPORTED'`: The model is actively supported and recommended for use
 * - `'DEPRECATED'`: The model is still functional but deprecated and may be removed in the future
 * - `'END_OF_LIFE'`: The model is no longer supported and should not be used
 *
 * @example
 * ```ts
 * // A model with active support
 * status: 'SUPPORTED'
 *
 * // A model that's deprecated but still works
 * status: 'DEPRECATED'
 *
 * // A model that's no longer available
 * status: 'END_OF_LIFE'
 * ```
 *
 * @public
 */
export type ModelLifecycleStatus = 'SUPPORTED' | 'DEPRECATED' | 'END_OF_LIFE';
