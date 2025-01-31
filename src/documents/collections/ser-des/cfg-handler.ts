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

import { DecoderType, either, object, oneOf, optional, record } from 'decoders';
import {
  InternalSerDesConfig,
  serDesConcat,
  serDesDecoders,
  serDesEmpty,
  serDesTransform,
} from '@/src/lib/api/ser-des/cfg-handler';
import { OptionsHandler, OptionsHandlerOpts } from '@/src/lib/opts-handler';
import { CollSerDesConfig } from '@/src/documents';
import { function_ } from '@/src/lib/utils';

const CollNumReps = ['number', 'bigint', 'bignumber', 'string', 'number_or_string'] as const;

const decoder = optional(object({
  ...serDesDecoders,
  enableBigNumbers: optional(either(function_, record(oneOf(CollNumReps)))),
}));

interface SerDesConfigTypes extends OptionsHandlerOpts {
  Refined: InternalSerDesConfig<CollSerDesConfig>,
  Parseable: CollSerDesConfig | null | undefined,
  Parsed: DecoderType<typeof decoder>,
}

export const CollSerDesCfgHandler = new OptionsHandler<SerDesConfigTypes>({
  decoder: decoder,
  refine(config) {
    return {
      ...serDesTransform(config),
      enableBigNumbers: config?.enableBigNumbers ?? undefined,
    };
  },
  concat(configs): SerDesConfigTypes['Refined'] {
    return {
      enableBigNumbers: configs.reduce<CollSerDesConfig['enableBigNumbers']>((acc, next) => next?.enableBigNumbers ?? acc, undefined),
      ...serDesConcat(configs),
    };
  },
  empty: {
    ...serDesEmpty,
    enableBigNumbers: undefined,
  },
});
