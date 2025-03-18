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

import type { Filter, FindAndRerankCursor, FindCursor, GenericFindOptions, SomeDoc } from '@/src/documents/index.js';
import { CursorError } from '@/src/documents/cursors/abstract-cursor.js';
import { SerDesTarget } from '@/src/lib/api/ser-des/ctx.js';

/**
 * @internal
 */
export type SerializedFilter = [filter: unknown, bigNumsPresent: boolean];

type FindLikeCursor = (FindCursor<any> | FindAndRerankCursor<any>);
type FindLikeCursorConstructor<C extends FindLikeCursor> = new (...args: ConstructorParameters<typeof FindCursor | typeof FindAndRerankCursor>) => C

/**
 * @internal
 */
export const cloneFLC = <R, RC extends FindLikeCursor, Opts extends GenericFindOptions>(cursor: FindLikeCursor, filter: SerializedFilter, options: Opts, mapping?: (doc: SomeDoc) => R): RC => {
  return new (<FindLikeCursorConstructor<RC>>cursor.constructor)(cursor.dataSource, cursor._serdes, filter, options, mapping);
};

/**
 * @internal
 */
export const buildFLCOption = <RC extends FindLikeCursor, K extends keyof RC['_options'] & string>(cursor: FindLikeCursor, key: K, value: RC['_options'][K]): RC => {
  if (cursor.state !== 'idle') {
    throw new CursorError(`Cannot set a new ${key} on a running/closed cursor`, cursor);
  }
  return cloneFLC(cursor, cursor._filter, { ...cursor._options, [key]: value }, cursor._mapping);
};

/**
 * @internal
 */
export const buildFLCPreMapOption = <RC extends FindLikeCursor, K extends keyof RC['_options'] & string>(cursor: FindLikeCursor, key: K, value: RC['_options'][K]): RC => {
  if (cursor._mapping) {
    throw new CursorError(`Cannot set a new ${key} after already using cursor.map(...)`, cursor);
  }
  return buildFLCOption(cursor, key, value);
};

/**
 * @internal
 */
export const buildFLCMap = <RC extends FindLikeCursor>(cursor: FindLikeCursor, map: (doc: any) => unknown): RC => {
  if (cursor.state !== 'idle') {
    throw new CursorError('Cannot set a new mapping on a running/closed cursor', cursor);
  }

  const mapping = cursor._mapping
    ? (doc: SomeDoc) => map(cursor._mapping!(doc))
    : map;

  return cloneFLC(cursor, cursor._filter, cursor._options, mapping);
};

/**
 * @internal
 */
export const buildFLCFilter = <RC extends FindLikeCursor>(cursor: FindLikeCursor, filter: Filter): RC => {
  if (cursor.state !== 'idle') {
    throw new CursorError(`Cannot set a new filter on a running/closed cursor`, cursor);
  }
  return cloneFLC(cursor, cursor._serdes.serialize(filter, SerDesTarget.Filter), cursor._options, cursor._mapping);
};
