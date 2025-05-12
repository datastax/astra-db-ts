#!/usr/bin/env -S npx tsx

import 'zx/globals';
import { Args } from './utils/arg-parse.js';
import { Step, Steps } from './utils/steps.js';
import { dist, etc, LicenceHeaders, packageJson, src } from './utils/constants.js';
import fs from 'fs/promises';
import { trimIndent } from './utils/utils.js';
import strip from 'strip-comments';

const args = new Args({
  UpdateReport: [['-update-report', '-r'], 'boolean', false],
  BuildingForREPL: [['-for-repl', '-r'], 'boolean', false],
}).parse();

const mkSteps = () => {
  if (args.UpdateReport) {
    return new Steps([
      [new CleanStep],
      [new TranspileStep('cjs', { noCheck: true })],
    ]);
  }

  return new Steps([
    [new CleanStep],
    [new TranspileStep('cjs'), new TranspileStep('esm')],
    [new RollupStep],
    [new CleanupDistStep],
    [new CreateIndexFileStep('cjs'), new CreateIndexFileStep('esm')],
  ]);
}

class CleanStep implements Step {
  public async run() {
    await $`rm -rf ${dist}`;
    await fs.writeFile(`${src}/version.ts`, this._mkVersionFileText());
  }

  private _mkVersionFileText() {
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

class TranspileStep implements Step {
  private readonly _moduleType: 'commonjs' | 'module';
  private readonly _noCheck: boolean;

  constructor(private readonly _outputFormat: 'cjs' | 'esm', opts?: { noCheck?: boolean }) {
    this._moduleType = _outputFormat === 'cjs' ? 'commonjs' : 'module';
    this._noCheck = !!opts?.noCheck;
  }

  public async run() {
    await this._transpile();
    await this._runTSCAlias();
    await this._createPackageJSON();
  }

  private async _transpile() {
    if (this._noCheck) {
      await $`npx tsc -p ${etc}/tsconfig.${this._outputFormat}.json --noCheck`;
    } else {
      await $`npx tsc -p ${etc}/tsconfig.${this._outputFormat}.json`;
    }
  }

  private async _runTSCAlias() {
    await $`npx tsc-alias -p ${etc}/tsconfig.${this._outputFormat}.json`;
  }

  private async _createPackageJSON() {
    await fs.writeFile(`${dist}/${this._outputFormat}/package.json`, JSON.stringify({ type: this._moduleType }));
  }
}

class RollupStep implements Step {
  public async run() {
    await this._runAPIExtractor();

    if (args.UpdateReport) {
      await this._saveAPIReport();
    }
    await $`rm -r ./temp`;

    await this._processRollup();
  }

  private async _runAPIExtractor() {
    await $`npx api-extractor run -c ./api-extractor.jsonc --local`;
  }

  private async _saveAPIReport() {
    await $`mv -f ./temp/*.api.md ./etc`;
  }

  private async _processRollup() {
    const rollupContent = await fs.readFile(`${dist}/astra-db-ts.d.ts`, 'utf-8');

    const updatedContent = [
      this._removeUnnecessaryImports,
      this._removeHashtagPrivate,
      this._prependTSVersionFunction,
      this._prependLicense,
    ].reduce((content, fn) => fn(content), rollupContent);

    await fs.writeFile(`${dist}/astra-db-ts.d.ts`, updatedContent);
  }

  private _removeUnnecessaryImports(content: string) {
    return content.replace(/^import.*from\s+(['"](?:decoders|\.{1,2}[^'"]*)['"]);\s*\n/gm, '');
  }

  private _removeHashtagPrivate(content: string) {
    return content.replace(/^\s+#private;\s*\n/gm, '');
  }

  private _prependTSVersionFunction(content: string) {
    const tsVersionFunction = 'declare function astraDbTsRequiresTypeScriptV5OrGreater<const AstraDbTsRequiresTypeScriptV5OrGreater>(_: AstraDbTsRequiresTypeScriptV5OrGreater): void;'
    return tsVersionFunction + '\n\n' + content;
  }

  private _prependLicense(content: string) {
    return LicenceHeaders.Long + '\n\n' + content;
  }
}

class CleanupDistStep implements Step {
  private readonly _targetContentCJS = trimIndent`
    "use strict";
    // Copyright Datastax, Inc
    // SPDX-License-Identifier: Apache-2.0
    Object.defineProperty(exports, "__esModule", { value: true });`;

  private readonly _targetContentESM = trimIndent`
    // Copyright Datastax, Inc
    // SPDX-License-Identifier: Apache-2.0
    export {};`;

  public async run() {
    await this._deleteLeftoverDeclarationFiles();
    await this._reduceComments()
    await this._deleteEmptyFiles(`${dist}/cjs`, this._targetContentCJS + '\n');
    await this._deleteEmptyFiles(`${dist}/esm`, this._targetContentESM + '\n');
    await this._deleteEmptyDirectories();
  }

  private async _deleteLeftoverDeclarationFiles() {
    await $`find ${dist}/esm -type f -name '*.d.ts' -exec rm {} +`;
  }

  private async _reduceComments() {
    const files = (await $`find ${dist} -type f -name "*.js" -print`).lines();

    await Promise.all(files.map(async (file) => {
      const content = await fs.readFile(file, 'utf8');
      const updatedContent = strip.block(content.replace(LicenceHeaders.Long, LicenceHeaders.Short));
      await fs.writeFile(file, updatedContent, 'utf8');
    }));
  }

  private async _deleteEmptyFiles(path: string, targetContent: string) {
    const numDeleted = await this._deleteEmptyFilesImpl(path, targetContent);

    if (numDeleted < 10) {
      throw new Error(`Failsafe triggered: Only ${numDeleted} empty files deleted. Please check the deletion logic—the "empty" JS file output may have changed for ${path.split('/').at(-1)}.`);
    }
  }

  private async _deleteEmptyFilesImpl(path: string, targetContent: string): Promise<number> {
    const entries = await fs.readdir(path, { withFileTypes: true });

    const deletedCounts = await Promise.all(entries.map(async (entry) => {
      const fullPath = `${path}/${entry.name}`;

      if (entry.isDirectory()) {
        return await this._deleteEmptyFilesImpl(fullPath, targetContent);
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

  private async _deleteEmptyDirectories() {
    await $`find ./dist -type d -empty -delete`;
  }
}

class CreateIndexFileStep implements Step {
  constructor(private readonly _outputFormat: 'cjs' | 'esm') {}

  public async run() {
    await this._writeDummyJSFile();
    await this._writeIndexDeclarationFile();
    await this._updateVersionFile();
  }

  private async _writeDummyJSFile() {
    await fs.writeFile(`${dist}/astra-db-ts.js`, '');
  }

  private async _writeIndexDeclarationFile() {
    await fs.writeFile(`${dist}/${this._outputFormat}/index.d.ts`, `export * from '../astra-db-ts.js'; export declare const LIB_BUILD: '${this._outputFormat}';`);
  }

  private async _updateVersionFile() {
    const declaration = (this._outputFormat === 'esm')
      ? 'export const LIB_BUILD'
      : 'exports.LIB_BUILD';

    await fs.appendFile(`${dist}/${this._outputFormat}/version.js`, `${declaration} = '${this._outputFormat}';`);
  }
}

await mkSteps().run();
