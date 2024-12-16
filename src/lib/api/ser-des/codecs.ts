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

import { BaseDesCtx, SerDesFn } from '@/src/lib';
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
export type SomeCodec<Fns extends CodecSerDesFns> =
  | NameCodec<Fns>
  | PathCodec<Fns>
  | TypeCodec<Fns>
  | CustomGuardCodec<Fns>
  | ClassGuardCodec<Fns>;

/**
 * @public
 */
export type CodecOpts<Fns extends CodecSerDesFns, SerCtx, DesCtx> =
  | Fns & { serializeGuard: (value: unknown, ctx: SerCtx) => boolean, deserializeGuard?: (value: unknown, ctx: DesCtx) => boolean }
  | Fns & { serializeClass: new (...args: any[]) => any,              deserializeGuard?: (value: unknown, ctx: DesCtx) => boolean }
  | Pick<Fns, 'deserialize'>;

/**
 * @public
 */
export type RawCodec<Fns extends CodecSerDesFns> =
  & ({ path: string[] } | { name: string } | { type: string })
  & CodecOpts<Fns, unknown, unknown>;

/**
 * @internal
 */
export const initCodecs = <Fns extends CodecSerDesFns>(rawCodecs: RawCodec<Fns>[]): Codecs<Fns> => {
  const codecs: Codecs<Fns> = { name: {}, path: [], type: {}, classGuard: [], customGuard: [] };

  for (let codec of rawCodecs) {
    codec = prependAnyDeserializeGuard(codec);
    codec = prependAnySerializeGuard(codec);

    switch (true) {
      case 'name' in codec: {
        codecs.name[codec.name] = codec;
        break;
      }
      case 'path' in codec: {
        codecs.path.push(codec);
        break;
      }
      case 'type' in codec: {
        codecs.type[codec.type] = codec;

        if ('serializeClass' in codec) {
          codecs.classGuard.push(codec);
        } else if ('serializeGuard' in codec) {
          codecs.customGuard.push(codec);
        }
        break;
      }
    }
  }

  return codecs;
};

const prependAnyDeserializeGuard = <Fns extends CodecSerDesFns>(codec: RawCodec<Fns>): RawCodec<Fns> => {
  if (!('deserializeGuard' in codec && codec.deserializeGuard)) {
    return codec;
  }

  const guard = codec.deserializeGuard;

  return {
    ...codec,
    deserialize: (value: unknown, ctx: BaseDesCtx<never>) => {
      if (!guard(value, ctx)) {
        return ctx.continue();
      }
      return codec.deserialize(value, ctx);
    },
  };
};

const prependAnySerializeGuard = <Fns extends CodecSerDesFns>(codec: RawCodec<Fns>): RawCodec<Fns> => {
  if ('type' in codec || !('serializeGuard' in codec || 'serializeClass' in codec)) {
    return codec;
  }

  const serializeClass = ('serializeClass' in codec)
    ? codec.serializeClass
    : undefined;

  const guard = ('serializeClass' in codec)
    ? (value: unknown) => value instanceof serializeClass!
    : codec.serializeGuard;

  const _codec = codec;

  return {
    ...codec,
    serialize: (key: string, value: any, ctx: BaseSerCtx<never>) => {
      if (!guard(value, ctx)) {
        return ctx.continue();
      }
      return _codec.serialize(key, value, ctx);
    },
  };
};
