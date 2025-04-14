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

import fc from 'fast-check';
import { DataAPIEnvironments, SerDesTarget } from '@/src/lib/index.js';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler.js';
import { AlwaysAvailableBuffer } from '@/tests/testlib/utils.js';
import type { StrictCreateTableColumnDefinition } from '@/src/db/index.js';
import {
  DataAPIBlob,
  DataAPIInet,
  DataAPIVector,
  genObjectId,
  ObjectId,
  type SomeDoc,
  uuid,
} from '@/src/documents/index.js';
import { BigNumber } from 'bignumber.js';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';

export type ArbType<T> =
  T extends fc.Arbitrary<infer U>
    ? U :
  T extends (...args: any[]) => fc.Arbitrary<infer U>
    ? U
    : never;

const tableScalar = fc.constantFrom('text', 'uuid', 'decimal', 'inet', 'timestamp', 'blob');

const tableColumnDefinition = () => fc.oneof(
  tableScalar.map((type) => (<const>{ type })),
  tableScalar.map((type) => (<const>{ type: 'map', keyType: 'text', valueType: type })),
  tableScalar.map((type) => (<const>{ type: 'set', valueType: type })),
  tableScalar.map((type) => (<const>{ type: 'list', valueType: type })),
);

const tableDefinition = () => fc.dictionary(fc.stringMatching(/^[a-zA-Z_]+$/).filter(s => s !== '__proto__'), tableColumnDefinition());

const fromTableColumn = (def: StrictCreateTableColumnDefinition, minLengthForNonScalar?: number): fc.Arbitrary<unknown> => {
  switch (def.type) {
    case 'text':
      return fc.string();
    case 'uuid':
      return arbs.uuid();
    case 'decimal':
      return arbs.bigNum();
    case 'inet':
      return arbs.inet();
    case 'blob':
      return arbs.blob();
    case 'timestamp':
      return arbs.validDate();
    case 'map':
      return arbs.map(fromTableColumn({ type: def.valueType }), minLengthForNonScalar);
    case 'set':
      return arbs.set(fromTableColumn({ type: def.valueType }), minLengthForNonScalar);
    case 'list':
      return fc.array(fromTableColumn({ type: def.valueType }), { minLength: minLengthForNonScalar });
    default:
      throw new Error(`Unexpected type: ${def.type}`);
  }
};

interface TableDefAndRowConstraints {
  partialRow?: boolean;
  requireOneOf?: (ArbType<typeof tableScalar> | 'map' | 'set' | 'list')[];
}

const tableDefAndRowArb = (opts?: TableDefAndRowConstraints) => tableDefinition()
  .filter((def) => {
    if (opts?.requireOneOf) {
      return Object.values(def).some((col) => opts.requireOneOf?.includes(col.type) || ('valueType' in col && opts.requireOneOf?.includes(col.valueType)));
    }
    return true;
  })
  .chain((def) => {
    const entries = Object.entries(def)
      .map(([k, v]) => [k, fromTableColumn(v, opts?.requireOneOf ? 1 : 0)])
      .filter(() => !opts?.partialRow || Math.random() < 0.5);

    const example = fc.record(Object.fromEntries(entries));

    return fc.tuple(fc.constant(def), example);
  });

const bigNum = (opts?: { type?: 'decimal' | 'integer' }) => (opts?.type !== 'integer')
  ? fc.tuple(fc.bigInt(), fc.bigInt({ min: 0n })).map(([whole, decimal]) => BigNumber(`${whole}.${decimal}`))
  : fc.bigInt().map((whole) => BigNumber(whole.toString()));

const datatypes = {
  uuid: () => fc.uuid().map(uuid),
  inet: () => fc.oneof(fc.ipV4(), fc.ipV6()).map(ip => new DataAPIInet(ip, null, false)),
  map: <T>(value: fc.Arbitrary<T>, minLength?: number) => fc.array(fc.tuple(fc.string(), value), { minLength }).map((arr) => new Map(arr)),
  set: <T>(value: fc.Arbitrary<T>, minLength?: number) => fc.array(value, { minLength }).map((arr) => new Set(arr)),
  bigNum: bigNum,
  vector: (opts?: { dim?: number }) => fc.array(fc.float(), opts?.dim ? { minLength: opts.dim, maxLength: opts.dim } : { minLength: 1 }).map((arr) => new DataAPIVector(arr, false)),
  oid: () => fc.tuple(fc.date(), fc.nat(0xFFFFFF)).map(([date, rand]) => new ObjectId(genObjectId(date.valueOf(), rand), false)),
  blob: () => fc.base64String().map((base64) => new DataAPIBlob({ $binary: base64 }, false)),
};

const tableSerdes = new TableSerDes(TableSerDes.cfg.empty);

interface CollSlashTableDatatypesArbOpts {
  scalarOnly?: boolean,
  count?: number,
}

const tableDatatypesArb = (opts?: CollSlashTableDatatypesArbOpts) => tableColumnDefinition()
  .filter((def) => {
    if (opts?.scalarOnly) {
      return !['map', 'set', 'list'].includes(def.type);
    }
    return true;
  })
  .chain((def) => {
    const arb = fc.array(fromTableColumn(def), {
      minLength: opts?.count,
      maxLength: opts?.count,
    });

    return arb
      .map((dts) => {
        return dts.map((dt) => ({ jsRep: dt, jsonRep: tableSerdes.serialize(dt)[0] }));
      })
      .map((_dts) => {
        const dts = _dts as { jsRep: unknown, jsonRep: unknown }[] & { definition: StrictCreateTableColumnDefinition; };
        dts.definition = def;
        return dts;
      });
  });

const collSerdes = new CollSerDes(CollSerDes.cfg.empty);

const collDatatypesArb = (opts?: CollSlashTableDatatypesArbOpts) => fc.array(
  fc.letrec((tie) => ({
    scalar: fc.oneof(
      datatypes.uuid(),
      datatypes.oid(),
      fc.string(),
      arbs.validDate(),
    ),
    datatypes: opts?.scalarOnly
      ? tie('scalar')
      : fc.oneof(
          tie('scalar'),
          arbs.record(tie('datatypes')),
          fc.array(tie('datatypes')),
        ),
  })).datatypes.map((dt) => {
    return { jsRep: dt, jsonRep: collSerdes.serialize(dt)[0] };
  }), {
    minLength: opts?.count,
    maxLength: opts?.count,
  },
);

interface PathArbOpts {
  atLeastOne?: boolean,
  unique?: boolean,
}

const path = (opts?: PathArbOpts) => {
  const minLength = (opts?.atLeastOne)
    ? 1
    : 0;

  const arrayArb = (opts?.unique)
    ? fc.uniqueArray(arbs.pathSegment(), { minLength, selector: String })
    : fc.array(arbs.pathSegment(), { minLength });

  return arrayArb
    .filter((p) => {
      return p.length === 0 || typeof p[0] === 'string';
    });
};

const pathWithObj = (opts?: PathArbOpts) => path(opts).map((path) => {
  const mkObj = (terminal: unknown) => {
    const obj: SomeDoc = typeof path[0] === 'number' ? [] : {};
    let tempObj = obj;

    for (let i = 0; i < path.length - 1; i++) {
      tempObj[path[i]] = typeof path[i + 1] === 'number' ? Array(path[i + 1] as number).fill(undefined) : {};
      tempObj = tempObj[path[i]];
    }

    tempObj[path[path.length - 1]] = terminal;
    return obj;
  };

  return <const>[path, mkObj];
});

export const arbs = <const>{
  nonAstraEnvs: () => fc.constantFrom(...DataAPIEnvironments.filter(e => e !== 'astra').map((e) => EnvironmentCfgHandler.parse(e))),
  pathSegment: () => fc.oneof(arbs.nonProtoString().filter(Boolean), fc.nat({ max: 10 })),
  path: path,
  pathWithObj: pathWithObj,
  cursorState: () => fc.constantFrom('idle', 'started', 'closed'),
  record: <T>(arb: fc.Arbitrary<T>) => fc.dictionary(arbs.nonProtoString(), arb, { noNullPrototype: true }),
  validBase46: () => fc.base64String().filter((base64) => base64 === AlwaysAvailableBuffer.from(base64, 'base64').toString('base64')),
  one: (arb: fc.Arbitrary<any>) => fc.sample(arb, 1)[0],
  tableDefinitionAndRow: tableDefAndRowArb,
  jsonObj: (): fc.Arbitrary<SomeDoc> => fc.jsonValue({ depthSize: 'medium' }).filter((val) => !!val && typeof val === 'object').filter((val) => !Array.isArray(val)),
  tableDatatypes: tableDatatypesArb,
  collDatatypes: collDatatypesArb,
  nonProtoString: () => fc.string().filter((s) => s !== '__proto__'),
  serdesTarget: () => fc.constantFrom(...Object.values(SerDesTarget)),
  validDate: () => fc.date({ noInvalidDate: true }),
  ...datatypes,
};
