const fs = require('fs');
const strip = require('strip-comments');

const longBumf = `// Copyright DataStax, Inc.
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
// limitations under the License.`;

const shortBumf = `// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0`;

const filePath = process.argv[2];

if (!filePath) {
  throw new Error('no file path provided');
}

const fileContent = fs.readFileSync(filePath, 'utf8');
const withShortenedLicense = fileContent.replace(longBumf, shortBumf);
const withStrippedBlockComments = strip.block(withShortenedLicense);
fs.writeFileSync(filePath, withStrippedBlockComments, 'utf8');
