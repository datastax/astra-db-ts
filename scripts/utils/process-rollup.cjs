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

const tsVersionFunction = 'declare function astraDbTsRequiresTypeScriptV5OrGreater<const AstraDbTsRequiresTypeScriptV5OrGreater>(_: AstraDbTsRequiresTypeScriptV5OrGreater): void;'

const filePath = process.argv[2];

if (!filePath) {
  throw new Error('no file path provided');
}

const fileContent = fs.readFileSync(filePath, 'utf8');

const importRegex = /^import.*from\s+(['"](?:decoders|\.{1,2}[^'"]*)['"]);\s*\n/gm;
const withoutImports = fileContent.replace(importRegex, '');

const privateRegex = /^\s+#private;\s*\n/gm;
const withoutPrivate = withoutImports.replace(privateRegex, '');

const withTSVersionFunction = tsVersionFunction + '\n\n' + withoutPrivate;

const withLicense = bumf + '\n\n' + withTSVersionFunction;

fs.writeFileSync(filePath, withLicense, 'utf8');
