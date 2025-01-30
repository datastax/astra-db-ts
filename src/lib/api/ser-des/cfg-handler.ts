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

import { array, boolean, Decoder, inexact, oneOf, optional } from 'decoders';
import { BaseSerDesConfig, KeyTransformer, RawCodec } from '@/src/lib';
import { anyInstanceOf, function_, oneOrMany, toArray } from '@/src/lib/utils';

export const serDesDecoders = <const>{
  codecs: optional(array(array(inexact({ tag: oneOf(['forName', 'forPath', 'forType', 'custom']) }) as Decoder<RawCodec>))),
  serialize: optional(oneOrMany(function_)),
  deserialize: optional(oneOrMany(function_)),
  mutateInPlace: optional(boolean),
  keyTransformer: optional(anyInstanceOf(KeyTransformer)),
};

export const serDesTransform = (config: BaseSerDesConfig<any, any> | null | undefined): InternalSerDesConfig<BaseSerDesConfig<any, any>> => ({
  codecs: config?.codecs ?? [],
  serialize: config?.serialize ?? [],
  deserialize: config?.deserialize ?? [],
  mutateInPlace: config?.mutateInPlace ?? undefined,
  keyTransformer: config?.keyTransformer ?? undefined,
});

export const serDesConcat = (configs: InternalSerDesConfig<BaseSerDesConfig<any, any>>[]) => {
  return configs.reduce((acc, next) => ({
    codecs: [...acc.codecs, ...next.codecs],
    serialize: [...toArray(next.serialize), ...toArray(acc.serialize)],
    deserialize: [...toArray(next.deserialize), ...toArray(acc.deserialize)],
    mutateInPlace: next.mutateInPlace ?? acc.mutateInPlace,
    keyTransformer: next.keyTransformer ?? acc.keyTransformer,
  }), serDesEmpty);
};

export const serDesEmpty: InternalSerDesConfig<BaseSerDesConfig<any, any>> = {
  codecs: [],
  serialize: [],
  deserialize: [],
  mutateInPlace: undefined,
  keyTransformer: undefined,
};

export type InternalSerDesConfig<Cfg extends BaseSerDesConfig<any, any>> =
  & Required<Pick<Cfg, 'codecs' | 'serialize' | 'deserialize'>>
  & {
    [K in Exclude<keyof Cfg, 'codecs' | 'serialize' | 'deserialize'>]: Cfg[K] | undefined;
  }
