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

import { LIB_NAME, LIB_VERSION } from '@/src/version';

export const REQUESTED_WITH = LIB_NAME + "/" + LIB_VERSION;

export const enum HTTP_METHODS {
  get = 'GET',
  post = 'POST',
}

export const DEFAULT_KEYSPACE = 'default_keyspace';
export const DEFAULT_METHOD = HTTP_METHODS.get;
export const DEFAULT_AUTH_HEADER = process.env['ASTRA_AUTH_HEADER'] || "Token";
export const DEFAULT_TIMEOUT = 30000;
