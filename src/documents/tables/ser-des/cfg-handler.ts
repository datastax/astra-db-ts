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

import { boolean, DecoderType, object, optional } from 'decoders';
import {
  InternalSerDesConfig,
  serDesConcat,
  serDesDecoders,
  serDesEmpty,
  serDesTransform,
} from '@/src/lib/api/ser-des/cfg-handler';
import { OptionsHandler, OptionsHandlerOpts } from '@/src/lib/opts-handler';
import { TableSerDesConfig } from '@/src/documents';

const decoder = optional(object({
  ...serDesDecoders,
  sparseData: optional(boolean),
}));

interface SerDesConfigTypes extends OptionsHandlerOpts {
  Refined: InternalSerDesConfig<TableSerDesConfig>,
  Parseable: TableSerDesConfig | null | undefined,
  Parsed: DecoderType<typeof decoder>,
}

export const TableSerDesCfgHandler = new OptionsHandler<SerDesConfigTypes>({
  decoder: decoder,
  refine(config) {
    return {
      ...serDesTransform(config),
      sparseData: config?.sparseData ?? undefined,
    };
  },
  concat(configs): SerDesConfigTypes['Refined'] {
    return {
      sparseData: configs.reduce<boolean | undefined>((acc, next) => next?.sparseData ?? acc, undefined),
      ...serDesConcat(configs),
    };
  },
  empty: {
    ...serDesEmpty,
    sparseData: undefined,
  },
});
