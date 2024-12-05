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
 * @internal
 */
export type NameCodec<Fns extends CodecSerDesFns> = { serialize?: Fns['serialize'], deserialize: Fns['deserialize'] } & {
  codecType: 'name',
  name: string,
}

/**
 * @internal
 */
export type TypeCodec<Fns extends CodecSerDesFns> = Pick<Fns, 'deserialize'> & {
  codecType: 'type',
  type: string,
}

/**
 * @internal
 */
export type CustomGuardCodec<Fns extends CodecSerDesFns> = Pick<Fns, 'serialize'> & {
  codecType: 'type',
  type: string,
  serializeGuard: (value: unknown, ctx: BaseSerCtx<Fns>) => boolean,
}

/**
 * @internal
 */
export type ClassGuardCodec<Fns extends CodecSerDesFns> = Pick<Fns, 'serialize'> & {
  codecType: 'type',
  type: string,
  serializeClass: new (...args: any[]) => any,
}

/**
 * @internal
 */
export type CodecSerDesFns = Record<'serialize' | 'deserialize', (...args: any[]) => ReturnType<SerDesFn<any>>>;

/**
 * @internal
 */
export interface CodecHolder<Fns extends CodecSerDesFns = any> {
  get:
    | NameCodec<Fns>
    | TypeCodec<Fns>
    | CustomGuardCodec<Fns>
    | ClassGuardCodec<Fns>
}
