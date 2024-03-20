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

export type DatabaseCloudProvider = 'AWS' | 'CGP' | 'AZURE';

export type DatabaseTier = 'developer' | 'A5' | 'A10' | 'A20' | 'A40' | 'C10' | 'C20' | 'C40' | 'D10' | 'D20' | 'D40' | 'serverless';

export type DatabaseStatus = 'ACTIVE' | 'PENDING' | 'PREPARING' | 'PREPARED' | 'INITIALIZING' | 'PARKED' | 'PARKING' | 'UNPARKING' | 'TERMINATED' | 'TERMINATING' | 'RESIZING' | 'ERROR' | 'MAINTENANCE' | 'SUSPENDED' | 'UNKNOWN';

export type DatabaseAction = 'park' | 'unpark' | 'resize' | 'resetPassword' | 'addKeyspace' | 'addDatacenters' | 'terminateDatacenter' | 'getCreds' | 'terminate' | 'removeKeyspace' | 'removeMigrationProxy' | 'launchMigrationProxy';
