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
} from './admin/admin-common.js';

export type {
  CreateAstraDatabaseOptions,
  AstraDatabaseConfig,
} from './admin/create-database.js';

export type {
  AstraDropDatabaseOptions,
} from './admin/drop-database.js';

export type {
  AstraDbRegionInfo,
  AstraDbInfo,
  AstraDbAdminInfo,
  BaseAstraDbInfo,
} from './admin/database-info.js';

export type {
  AstraDbCloudProviderFilter,
  AstraDbStatusFilter,
  ListAstraDatabasesOptions,
} from './admin/list-databases.js';

export type {
  AstraCreateKeyspaceOptions,
} from './db-admin/astra-create-keyspace.js';

export type {
  AstraDropKeyspaceOptions,
} from './db-admin/astra-drop-keyspace.js';

export type {
  KeyspaceReplicationOptions,
  DataAPICreateKeyspaceOptions,
} from './db-admin/local-create-keyspace.js';

export type {
  EmbeddingProviderAuthInfo,
  EmbeddingProviderInfo,
  EmbeddingProviderModelInfo,
  EmbeddingProviderModelParameterInfo,
  EmbeddingProviderTokenInfo,
  EmbeddingProviderProviderParameterInfo,
  FindEmbeddingProvidersResult,
} from './db-admin/find-embedding-providers.js';
