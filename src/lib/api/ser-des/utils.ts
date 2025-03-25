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

import type { SomeDoc } from '@/src/documents/index.js';
import { BigNumber } from 'bignumber.js';
import type JBI from 'json-bigint';
import { isBigNumber } from '@/src/lib/utils.js';
import type { PathSegment } from '@/src/lib/types.js';

/**
 * @internal
 */
export const assertHasSerializeFor = (clazz: SomeDoc, sym: symbol, synName: string) => {
  if (!(sym in clazz.prototype)) {
    throw new Error(`Invalid codec class: '${clazz.name}' - missing ${clazz.name}.prototype.[${synName}]

Did you define [${synName}] as a class property instead of a prototype method?

Don't do this:
> class Bad { [${synName}] = () => ...; }

Or this:
> Bad[${synName}] = () => ...;

Do this:
> class Good { [${synName}]() { ... } }

Or this:
> Good.prototype[${synName}] = () => ...;`);
  }
};

/**
 * @internal
 */
export const assertHasDeserializeFor = (clazz: SomeDoc, sym: symbol, synName: string) => {
  if (!(sym in clazz)) {
    throw new Error(`Invalid codec class: '${clazz.name}' - missing ${clazz.name}.[${synName}]

Did you forget to define [${synName}] on the class?

Don't do this:
> class Bad { [${synName}] = () => ...; }

Do this:
> class Good { [${synName}]() { ... } }

Or this:
> Good[${synName}] = () => ...;`);
  }
};

/**
 * @internal
 */
export const mkTypeUnsupportedForCollectionsError = (type: string, fauxTypeName: string, alternatives: string[]) => {
  return new Error([
    `${type} may not be used with collections by default.`,
    '',
    'Please use one of the following alternatives:',
    ...[...alternatives, 'Write a custom codec for ${type} (beta)'].map((alt, i) => `${i + 1}. ${alt}`),
    '',
    'See the `CollectionCodecs` class for more information about writing your own collection codec.',
    '',
    `Keep in mind that you may need to use CollectionCodecs.forType(...) to create a faux custom type (e.g. { ${fauxTypeName}: <${type}> }) representing a ${type} so that the value may be identifiable as needing to be deserialized back into a ${type} as well`,
  ].join('\n'));
};

/**
 * @internal
 */
export const mkTypeUnsupportedForTablesError = (type: string, alternatives: string[]) => {
  return new Error([
    `${type} may not be used with collections by default.`,
    '',
    'Please use one of the following alternatives:',
    ...[...alternatives, 'Write a custom codec for ${type} (beta)'].map((alt, i) => `${i + 1}. ${alt}`),
    '',
    'See the `TablesCodec` class for more information about writing your own table codec.',
  ].join('\n'));
};

/**
 * @internal
 */
export function withJbiNullProtoFix(jbi: ReturnType<typeof JBI>) {
  return {
    parse: (str: string) => nullProtoFix(jbi.parse(str)),
    stringify: jbi.stringify,
  };
}

function nullProtoFix(doc: SomeDoc): SomeDoc {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }

  if (isBigNumber(doc)) {
    return BigNumber(doc);
  }

  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      doc[i] = nullProtoFix(doc[i]);
    }
  } else {
    Object.setPrototypeOf(doc, Object.prototype);

    for (const key of Object.keys(doc)) {
      doc[key] = nullProtoFix(doc[key]);
    }
  }

  return doc;
}

/**
 * @internal
 */
export function pathArraysEqual(a: readonly PathSegment[], b: readonly PathSegment[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * @internal
 */
export function pathMatches(exp: readonly PathSegment[], acc: readonly PathSegment[]): boolean {
  if (exp.length !== acc.length) {
    return false;
  }

  for (let i = 0; i < acc.length; i++) {
    if (exp[i] !== '*' && exp[i] !== acc[i]) {
      return false;
    }
  }

  return true;
}
