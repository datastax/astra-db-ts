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
export type PathCodec<Fns extends CodecSerDesFns> = { serialize?: Fns['serialize'], deserialize: Fns['deserialize'] } & {
  codecType: 'path',
  path: string[],
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
export type CustomGuardCodec<Fns extends CodecSerDesFns> = Fns & {
  codecType: 'type',
  type: string,
  serializeGuard: (value: unknown, ctx: BaseSerCtx<Fns>) => boolean,
}

/**
 * @internal
 */
export type ClassGuardCodec<Fns extends CodecSerDesFns> = Fns & {
  codecType: 'type',
  type: string,
  serializeClass: new (...args: any[]) => any,
}

/**
 * @internal
 */
export interface Codecs<Fns extends CodecSerDesFns> {
  name: Record<string, NameCodec<Fns>>;
  path: PathCodec<Fns>[];
  type: Record<string, TypeCodec<Fns>>;
  classGuard: ClassGuardCodec<Fns>[];
  customGuard: CustomGuardCodec<Fns>[];
}

export type CodecSerDesFns = Record<'serialize' | 'deserialize', (...args: any[]) => ReturnType<SerDesFn<any>>>;

export interface CodecHolder<Fns extends CodecSerDesFns> {
  get:
    | NameCodec<Fns>
    | PathCodec<Fns>
    | TypeCodec<Fns>
    | CustomGuardCodec<Fns>
    | ClassGuardCodec<Fns>
}

/**
 * @internal
 */
export const initCodecs = <Fns extends CodecSerDesFns>(chs: CodecHolder<Fns>[]): Codecs<Fns> => {
  const codecs: Codecs<Fns> = { name: {}, path: [], type: {}, classGuard: [], customGuard: [] };
  const rawCodecs = chs.map(ch => ch.get);

  for (const codec of rawCodecs) {
    switch (codec.codecType) {
      case 'name':
        codecs.name[codec.name] = codec;
        break;
      case 'path':
        codecs.path.push(codec);
        break;
      case 'type':
        codecs.type[codec.type] = codec;

        if ('serializeClass' in codec) {
          codecs.classGuard.push(codec);
        } else if ('serializeGuard' in codec) {
          codecs.customGuard.push(codec);
        }

        break;
    }
  }

  return codecs;
};
