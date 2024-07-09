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

export interface FindEmbeddingProvidersResult {
  embeddingProviders: Record<string, EmbeddingProviderInfo>,
}

export interface EmbeddingProviderInfo {
  displayName: string,
  url: string,
  supportedAuthentication: Record<string, EmbeddingProviderAuthInfo>,
  parameters: EmbeddingProviderParameterInfo[],
  models: EmbeddingProviderModelInfo[],
}

export interface EmbeddingProviderAuthInfo {
  enabled: boolean,
  tokens: EmbeddingProviderTokenInfo[],
}

export interface EmbeddingProviderTokenInfo {
  accepted: string,
  forwarded: string,
}

export interface EmbeddingProviderParameterInfo {
  name: string,
  type: string,
  required: boolean,
  defaultValue: string,
  validation: Record<string, unknown>[],
  help: string,
}

export interface EmbeddingProviderModelInfo {
  name: string,
  vectorDimension: number | null,
  parameters: EmbeddingProviderParameterInfo[],
}
