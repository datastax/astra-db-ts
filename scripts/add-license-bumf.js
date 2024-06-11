const fs = require('fs');

const bumf = `// Copyright DataStax, Inc.
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

const filePath = process.argv[2];

if (!filePath) {
  throw new Error('no file path provided');
}

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    throw new Error('Error reading file ${filePath}: ${err}');
  }

  fs.writeFile(filePath, bumf + '\n\n' + data, 'utf8', (err) => {
    if (err) {
      throw new Error('Error writing file ${filePath}: ${err}');
    }
  });
});
