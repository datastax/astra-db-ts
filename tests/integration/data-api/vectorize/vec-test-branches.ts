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

import { EmbeddingProviderInfo, EmbeddingProviderModelInfo } from '@/src/devops';
import { AWSEmbeddingHeadersProvider, EmbeddingAPIKeyHeaderProvider, EmbeddingHeadersProvider } from '@/src/data-api';
import { ENVIRONMENT } from '@/tests/testlib';
import { VectorizeTestSpec } from '@/tests/integration/data-api/vectorize/vectorize.test';

interface ModelBranch {
  providerName: string,
  modelName: string,
  branchName: string,
  warmupErr?: RegExp,
}

export const branchOnModel = (fullSpec: VectorizeTestSpec) => ([providerName, providerInfo]: [string, EmbeddingProviderInfo]): FinalVectorizeTestBranch[] => {
  const spec = fullSpec[providerName];

  if (!spec) {
    console.warn(`No credentials found for provider ${providerName}; skipping models `)
    return [];
  }

  const modelBranches = providerInfo.models.map((model) => ({
    providerName: providerName,
    modelName: model.name,
    branchName: `${providerName}@${model.name}`,
    warmupErr: spec.warmupErr ? RegExp(spec.warmupErr) : undefined,
  }));

  return modelBranches.flatMap(addParameters(spec, providerInfo));
}

interface WithParams extends ModelBranch {
  parameters?: Record<string, string>,
}

const addParameters = (spec: VectorizeTestSpec[string], providerInfo: EmbeddingProviderInfo) => (branch: ModelBranch): FinalVectorizeTestBranch[] => {
  const params = spec.parameters;
  const matchingParam = Object.keys(params ?? {}).find((regex) => RegExp(regex).test(branch.modelName))!;

  if (params && !matchingParam) {
    throw new Error(`can not find matching param for ${branch.branchName}`);
  }

  const withParams = [{
    ...branch,
    parameters: spec.parameters?.[matchingParam],
  }];

  return withParams.flatMap(branchOnAuth(spec, providerInfo));
}

interface AuthBranch extends WithParams {
  authType: 'header' | 'providerKey' | 'none',
  header?: EmbeddingHeadersProvider,
  providerKey?: string,
}

const branchOnAuth = (spec: VectorizeTestSpec[string], providerInfo: EmbeddingProviderInfo) => (branch: WithParams): FinalVectorizeTestBranch[] => {
  const auth = providerInfo['supportedAuthentication'];
  const branches: AuthBranch[] = []

  const ehp = resolveHeaderProvider(spec);

  if (auth['HEADER']?.enabled && ehp) {
    branches.push({ ...branch, authType: 'header', header: ehp, branchName: `${branch.branchName}@header` });
  }

  if (auth['SHARED_SECRET']?.enabled && spec.sharedSecret?.providerKey && ENVIRONMENT === 'astra') {
    branches.push({ ...branch, authType: 'providerKey', providerKey: spec.sharedSecret?.providerKey, branchName: `${branch.branchName}@providerKey`, });
  }

  if (auth['NONE']?.enabled && ENVIRONMENT === 'astra') {
    branches.push({ ...branch, authType: 'none', branchName: `${branch.branchName}@none` });
  }

  const modelInfo = providerInfo.models.find((m) => m.name === branch.modelName)!;

  return branches.flatMap(branchOnDimension(spec, modelInfo));
}

const resolveHeaderProvider = (spec: VectorizeTestSpec[string]) => {
  const headers = Object.entries(spec?.headers ?? []).sort();

  if (headers.length === 0) {
    return null;
  }

  if (headers.length === 1 && headers[0][0] === 'x-embedding-api-key') {
    return new EmbeddingAPIKeyHeaderProvider(headers[0][1]);
  }

  if (headers.length === 2 && headers[0][0] === 'x-embedding-access-id' && headers[1][0] === 'x-embedding-secret-id') {
    return new AWSEmbeddingHeadersProvider(headers[0][1], headers[1][1]);
  }

  throw new Error(`No embeddings header provider resolved for headers ${headers}`);
}

interface DimensionBranch extends AuthBranch {
  dimension?: number,
}

const branchOnDimension = (spec: VectorizeTestSpec[string], modelInfo: EmbeddingProviderModelInfo) => (branch: AuthBranch): FinalVectorizeTestBranch[] => {
  const vectorDimParam = modelInfo.parameters.find((p) => p.name === 'vectorDimension');
  const defaultDim = Number(vectorDimParam?.defaultValue);

  if (vectorDimParam && !defaultDim) {
    const matchingDim = Object.keys(spec.dimension ?? {}).find((regex) => RegExp(regex).test(branch.modelName))!;

    if (!spec.dimension || !matchingDim) {
      throw new Error(`No matching "dimension" parameter found in spec for ${branch.branchName}}`);
    }

    return [{ ...branch, dimension: spec.dimension[matchingDim], branchName: `${branch.branchName}@specified` }];
  }

  if (vectorDimParam && defaultDim) {
    return [{ ...branch, branchName: `${branch.branchName}@default` }, { ...branch, dimension: defaultDim, branchName: `${branch.branchName}/${defaultDim}`, }];
  }

  return [{ ...branch, branchName: `${branch.branchName}@default` }];
}

export type FinalVectorizeTestBranch = DimensionBranch;
