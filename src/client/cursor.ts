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

import { Collection } from './collection';
import { TypeErr } from './utils';
import {
  InternalFindOptions,
  internalFindOptionsKeys,
  InternalGetMoreCommand
} from '@/src/client/operations/find/find';
import { Filter } from '@/src/client/operations/filter';
import { SomeDoc } from '@/src/client/document';

type CursorStatus = 'uninitialized' | 'initialized' | 'executing' | 'executed';

export class FindCursor<Schema extends SomeDoc> {
  collection: Collection<Schema>;
  filter: Filter<Schema>;
  options: Record<string, any>;
  documents: Schema[] = [];
  status: CursorStatus = 'uninitialized';
  nextPageState?: string;
  limit: number;

  page: Schema[] = [];
  exhausted = false;
  pageIndex = 0;

  constructor(collection: Collection<Schema>, filter: Filter<Schema>, options?: Record<string, any>) {
    this.collection = collection;
    this.filter = filter;
    this.options = options ?? {};

    const isNonVectorSort = this.options.sort && !('$vector' in this.options.sort || '$vectorize' in this.options.sort);
    const isOverPageSizeLimit = !this.options.limit || this.options.limit > 20;

    if (isNonVectorSort && isOverPageSizeLimit) {
      throw new Error('Cannot set non-vector sort option without limit <= 20, JSON API can currently only return 20 documents with sort');
    }

    this.limit = options?.limit || Infinity;
    this.status = 'initialized';
  }

  async toArray(): Promise<Schema[]> {
    await this._getAll();
    return this.documents;
  }

  private async _getAll(): Promise<void> {
    if (this.status === 'executed' || this.status === 'executing') {
      return;
    }

    for (let doc = await this.next(); doc != null; doc = await this.next()) {
      this.documents.push(doc);
    }
  }

  async next(): Promise<Schema | null> {
    if (this.pageIndex < this.page.length) {
      return this.page[this.pageIndex++];
    }

    if (this.exhausted) {
      this.status = 'executed';
    }

    if (this.status === 'executed') {
      return null;
    }

    this.status = 'executing';

    await this._getMore();

    return this.page[this.pageIndex++] || null;
  }

  private async _getMore(): Promise<void> {
    const command: InternalGetMoreCommand = {
      find: {
        filter: this.filter,
      },
    };
    if (this.options && this.options.sort) {
      command.find.sort = this.options.sort;
    }
    const options: InternalFindOptions = {};
    if (this.limit != Infinity) {
      options.limit = this.limit;
    }
    if (this.nextPageState) {
      options.pagingState = this.nextPageState;
    }
    if (this.options?.skip) {
      options.skip = this.options.skip;
    }
    if (this.options.includeSimilarity) {
      options.includeSimilarity = this.options.includeSimilarity;
    }
    if (
      this.options?.projection &&
      Object.keys(this.options.projection).length > 0
    ) {
      command.find.projection = this.options.projection;
    }
    if (Object.keys(options).length > 0) {
      command.find.options = options;
    }
    const resp = await this.collection._httpClient.executeCommand(
      command,
      internalFindOptionsKeys,
    );
    this.nextPageState = resp.data!.nextPageState;
    if (this.nextPageState == null) {
      this.exhausted = true;
    }
    this.page = Object.keys(resp.data!.documents).map(
      (i) => resp.data!.documents[i],
    );
    this.pageIndex = 0;
  }

  async forEach(iterator: any): Promise<void> {
    for (let doc = await this.next(); doc != null; doc = await this.next()) {
      iterator(doc);
    }
  }

  async count(): Promise<number> {
    return this.toArray().then((docs) => docs.length);
  }

  stream(): TypeErr<'Streaming cursors are not supported'> {
    throw new Error('Streaming cursors are not supported');
  }
}
