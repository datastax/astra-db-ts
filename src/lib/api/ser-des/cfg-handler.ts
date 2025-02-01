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
import { BaseSerDesConfig, KeyTransformer, RawCodec, SerDesFn } from '@/src/lib';
import { anyInstanceOf, function_, oneOrMany, toArray } from '@/src/lib/utils';
import { monoids, Parsed, Unparse } from '@/src/lib/opts-handler';

/**
 * @internal
 */
type SomeInternalSerDesConfig = Unparse<ParsedSerDesConfig<BaseSerDesConfig<any, any>>>;

/**
 * @internal
 */
export const serDesDecoders = <const>{
  codecs: optional(array(array(inexact({ tag: oneOf(['forName', 'forPath', 'forType', 'custom']) }) as Decoder<RawCodec>))),
  serialize: optional(oneOrMany(function_)),
  deserialize: optional(oneOrMany(function_)),
  mutateInPlace: optional(boolean),
  keyTransformer: optional(anyInstanceOf(KeyTransformer)),
};

/**
 * @internal
 */
export const serdesMonoidSchema = <const>{
  codecs: monoids.prependingArray<readonly RawCodec[]>(),
  serialize: monoids.prependingArray<SerDesFn<any>>(),
  deserialize: monoids.prependingArray<SerDesFn<any>>(),
  mutateInPlace: monoids.optional<boolean>(),
  keyTransformer: monoids.optional<KeyTransformer>(),
};

/**
 * @internal
 */
export const serDesTransform = (input: BaseSerDesConfig<any, any>): SomeInternalSerDesConfig => ({
  codecs: input.codecs ?? [],
  serialize: toArray(input.serialize).filter((a): a is typeof a & {} => !!a),
  deserialize: toArray(input.deserialize).filter((a): a is typeof a & {} => !!a),
  mutateInPlace: input.mutateInPlace,
  keyTransformer: input.keyTransformer,
});

/**
 * @internal
 */
export type ParsedSerDesConfig<Cfg extends BaseSerDesConfig<any, any>> =
  & Parsed<'SerDes'>
  & Required<Pick<Cfg, 'serialize' | 'deserialize'>>
  & {
    [K in Exclude<keyof Cfg, 'codecs' | 'serialize' | 'deserialize'>]: Cfg[K] | undefined;
  }
  & {
    codecs: Cfg['codecs'] & {},
  };
