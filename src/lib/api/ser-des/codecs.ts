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

import { SerDesFn } from '@/src/lib';
import { BaseSerCtx } from '@/src/lib/api/ser-des/ctx';

/**
 * @public
 */
export type NameCodec<Fns extends CodecSerDesFns> = { serialize?: Fns['serialize'], deserialize: Fns['deserialize'] } & {
  name: string,
}

/**
 * @public
 */
export type PathCodec<Fns extends CodecSerDesFns> = { serialize?: Fns['serialize'], deserialize: Fns['deserialize'] } & {
  path: string[],
}

/**
 * @public
 */
export type TypeCodec<Fns extends CodecSerDesFns> = Pick<Fns, 'deserialize'> & {
  type: string,
}

/**
 * @public
 */
export type CustomGuardCodec<Fns extends CodecSerDesFns> = Fns & {
  type: string,
  serializeGuard: (value: unknown, ctx: BaseSerCtx<Fns>) => boolean,
}

/**
 * @public
 */
export type ClassGuardCodec<Fns extends CodecSerDesFns> = Fns & {
  type: string,
  serializeClass: new (...args: any[]) => any,
}

/**
 * @public
 */
export interface Codecs<Fns extends CodecSerDesFns> {
  name: Record<string, NameCodec<Fns>>;
  path: PathCodec<Fns>[];
  type: Record<string, TypeCodec<Fns>>;
  classGuard: ClassGuardCodec<Fns>[];
  customGuard: CustomGuardCodec<Fns>[];
}

/**
 * @public
 */
export type CodecSerDesFns = Record<'serialize' | 'deserialize', (...args: any[]) => ReturnType<SerDesFn<any>>>;

/**
 * @public
 */
export type CodecOpts<Fns extends CodecSerDesFns, SerCtx, DesCtx> =
  | Fns & { serializeGuard: (value: unknown, ctx: SerCtx) => boolean, deserializeGuard?: (value: unknown, ctx: DesCtx) => boolean }
  | Fns & { serializeClass: new (...args: any[]) => any,      deserializeGuard?: (value: unknown, ctx: DesCtx) => boolean }
  | Pick<Fns, 'deserialize'>;

/**
 * @public
 */
export type RawCodec<Fns extends CodecSerDesFns> =
  & ({ path: string[] } | { name: string } | { type: string })
  & CodecOpts<Fns, unknown, unknown>;
