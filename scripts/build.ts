#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Step, Steps } from './utils/steps.js';
import { dist, etc, LicenceHeaders, packageJson, src } from './utils/constants.js';
import fs from 'fs/promises';
import { trimIndent } from './utils/utils.js';
import strip from 'strip-comments';
import { Args } from './utils/arg-parse.js';

const opts = new Args('build.ts')
  .boolean('UpdateReport', {
    flags: ['-update-report', '-r'],
  })
  .boolean('BuildingForREPL', {
    flags: ['-for-repl'],
  })
  .parse();

if (opts.BuildingForREPL) {
  await new Steps()
    .do(Clean(), {
      spinner: 'Cleaning previous build...',
    })
    .do(Transpile('cjs', { noCheck: true }), {
      spinner: 'Transpiling to CommonJS...',
    })
    .run();
} else {
  await new Steps()
    .do(Clean(), {
      spinner: 'Cleaning previous build...',
    })
    .doAll([Transpile('cjs'), Transpile('esm')], {
      spinner: 'Transpiling to CommonJS and ESM...',
    })
    .do(Rollup(), {
      spinner: 'Running API extractor and processing rollup declaration file...',
    })
    .do(CleanupDist(), {
      spinner: 'Cleaning up dist folder...',
    })
    .doAll([CreateIndexFile('cjs'), CreateIndexFile('esm')], {
      spinner: 'Creating index files...',
    })
    .run()
}

function Clean(): Step {
  return async () => {
    await $`rm -rf ${dist}`;
    await fs.writeFile(`${src}/version.ts`, _mkVersionFileText());
  };

  function _mkVersionFileText() {
    return [
      LicenceHeaders.Long,
      ``,
      `/**`,
      ` * The name of the library.`,
      ` *`,
      ` * @public`,
      ` */`,
      `export const LIB_NAME = 'astra-db-ts';`,
      ``,
      `/**`,
      ` * The version of the library.`,
      ` *`,
      ` * @public`,
      ` */`,
      `export const LIB_VERSION = '${packageJson.version}';`,
    ].join('\n')
  }
}

function Transpile(outputFormat: 'cjs' | 'esm', opts?: { noCheck?: boolean }): Step {
  const moduleType = outputFormat === 'cjs' ? 'commonjs' : 'module';

  return async () => {
    await transpile();
    await runTSCAlias();
    await createPackageJSON();
  }

  async function transpile() {
    if (!!opts?.noCheck) {
      await $`npx tsc -p ${etc}/tsconfig.${outputFormat}.json --noCheck`;
    } else {
      await $`npx tsc -p ${etc}/tsconfig.${outputFormat}.json`;
    }
  }

  async function runTSCAlias() {
    await $`npx tsc-alias -p ${etc}/tsconfig.${outputFormat}.json`;
  }

  async function createPackageJSON() {
    await fs.writeFile(`${dist}/${outputFormat}/package.json`, JSON.stringify({ type: moduleType }));
  }
}

function Rollup(): Step {
  return async () => {
    await _runAPIExtractor();

    if (opts.UpdateReport) {
      await _saveAPIReport();
    }
    await $`rm -r ./temp`;

    await _processRollup();
  }

  async function _runAPIExtractor() {
    await $`npx api-extractor run -c ./api-extractor.jsonc --local`;
  }

  async function _saveAPIReport() {
    await $`mv -f ./temp/*.api.md ./etc`;
  }

  async function _processRollup() {
    const rollupContent = await fs.readFile(`${dist}/astra-db-ts.d.ts`, 'utf-8');

    const updatedContent = [
      _removeUnnecessaryImports,
      _removeHashtagPrivate,
      _prependTSVersionFunction,
      _prependLicense,
    ].reduce((content, fn) => fn(content), rollupContent);

    await fs.writeFile(`${dist}/astra-db-ts.d.ts`, updatedContent);
  }

  function _removeUnnecessaryImports(content: string) {
    return content.replace(/^import.*from\s+(['"](?:decoders|\.{1,2}[^'"]*)['"]);\s*\n/gm, '');
  }

  function _removeHashtagPrivate(content: string) {
    return content.replace(/^\s+#private;\s*\n/gm, '');
  }

  function _prependTSVersionFunction(content: string) {
    const tsVersionFunction = 'declare function astraDbTsRequiresTypeScriptV5OrGreater<const AstraDbTsRequiresTypeScriptV5OrGreater>(_: AstraDbTsRequiresTypeScriptV5OrGreater): void;'
    return tsVersionFunction + '\n\n' + content;
  }

  function _prependLicense(content: string) {
    return LicenceHeaders.Long + '\n\n' + content;
  }
}

function CleanupDist(): Step {
  const _targetContentCJS = trimIndent`
    "use strict";
    // Copyright Datastax, Inc
    // SPDX-License-Identifier: Apache-2.0
    Object.defineProperty(exports, "__esModule", { value: true });`;

  const _targetContentESM = trimIndent`
    // Copyright Datastax, Inc
    // SPDX-License-Identifier: Apache-2.0
    export {};`;

  return async () => {
    await _deleteLeftoverDeclarationFiles();
    await _reduceComments();
    await _deleteEmptyFiles(`${dist}/cjs`, _targetContentCJS + '\n');
    await _deleteEmptyFiles(`${dist}/esm`, _targetContentESM + '\n');
    await _deleteEmptyDirectories();
  }

  async function _deleteLeftoverDeclarationFiles() {
    await $`find ${dist}/esm -type f -name '*.d.ts' -exec rm {} +`;
  }

  async function _reduceComments() {
    const files = (await $`find ${dist} -type f -name "*.js" -print`).lines();

    await Promise.all(files.map(async (file) => {
      const content = await fs.readFile(file, 'utf8');
      const updatedContent = strip.block(content.replace(LicenceHeaders.Long, LicenceHeaders.Short));
      await fs.writeFile(file, updatedContent, 'utf8');
    }));
  }

  async function _deleteEmptyFiles(path: string, targetContent: string) {
    const numDeleted = await _deleteEmptyFilesImpl(path, targetContent);

    if (numDeleted < 10) {
      throw new Error(`Failsafe triggered: Only ${numDeleted} empty files deleted. Please check the deletion logic—the "empty" JS file output may have changed for ${path.split('/')[path.split('/').length - 1]}.`);
    }
  }

  async function _deleteEmptyFilesImpl(path: string, targetContent: string): Promise<number> {
    const entries = await fs.readdir(path, { withFileTypes: true });

    const deletedCounts = await Promise.all(entries.map(async (entry) => {
      const fullPath = `${path}/${entry.name}`;

      if (entry.isDirectory()) {
        return await _deleteEmptyFilesImpl(fullPath, targetContent);
      }

      if (entry.isFile()) {
        const fileContent = await fs.readFile(fullPath, 'utf8');

        if (fileContent === targetContent) {
          await fs.unlink(fullPath);
          return 1;
        }
      }

      return 0;
    }));

    return deletedCounts.reduce((acc, count) => acc + count, 0);
  }

  async function _deleteEmptyDirectories() {
    await $`find ./dist -type d -empty -delete`;
  }
}

function CreateIndexFile(outputFormat: 'cjs' | 'esm'): Step {
  return async () => {
    await _writeDummyJSFile();
    await _writeIndexDeclarationFile();
    await _updateVersionFile();
  }

  async function _writeDummyJSFile() {
    await fs.writeFile(`${dist}/astra-db-ts.js`, '');
  }

  async function _writeIndexDeclarationFile() {
    await fs.writeFile(`${dist}/${outputFormat}/index.d.ts`, `export * from '../astra-db-ts.js'; export declare const LIB_BUILD: '${outputFormat}';`);
  }

  async function _updateVersionFile() {
    const declaration = (outputFormat === 'esm')
      ? 'export const LIB_BUILD'
      : 'exports.LIB_BUILD';

    await fs.appendFile(`${dist}/${outputFormat}/version.js`, `${declaration} = '${outputFormat}';`);
  }
}
