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

export type {
  AstraAdminBlockingOptions,
  AstraDbCloudProvider,
  AstraDbStatus,
  AstraPollBlockingOptions,
  AstraNoBlockingOptions,
} from './admin/admin-common';

export type {
  CreateAstraDatabaseOptions,
  AstraDatabaseConfig,
} from './admin/create-database';

export type {
  AstraDbRegionInfo,
  AstraDbInfo,
  AstraDbAdminInfo,
  BaseAstraDbInfo,
} from './admin/database-info';

export type {
  AstraDbCloudProviderFilter,
  AstraDbStatusFilter,
  ListAstraDatabasesOptions,
} from './admin/list-databases';

export type {
  AdminSpawnOptions,
} from '../../client/types/spawn-admin';

export type {
  AstraCreateKeyspaceOptions,
} from './db-admin/astra-create-keyspace';

export type {
  KeyspaceReplicationOptions,
  LocalCreateKeyspaceOptions,
} from './db-admin/local-create-keyspace';

export type {
  EmbeddingProviderAuthInfo,
  EmbeddingProviderInfo,
  EmbeddingProviderModelInfo,
  EmbeddingProviderModelParameterInfo,
  EmbeddingProviderTokenInfo,
  EmbeddingProviderProviderParameterInfo,
  FindEmbeddingProvidersResult,
} from './db-admin/find-embedding-providers';
