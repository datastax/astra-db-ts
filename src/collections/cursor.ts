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

import { Collection, SomeDoc } from './collection';
import { executeOperation, TypeErr } from './utils';
import { FindOptions, internalFindOptionsKeys, InternalFindOptions } from '@/src/collections/operations/find/find';
import { Filter } from '@/src/collections/operations/filter';
import { WithId } from '@/src/collections/operations/with-id';

type CursorStatus = 'uninitialized' | 'initialized' | 'executing' | 'executed';

export class FindCursor<Schema extends SomeDoc = SomeDoc> {
  collection: Collection<Schema>;
  filter: Filter<Schema>;
  options: FindOptions<Schema>;
  documents: WithId<Schema>[] = [];
  status: CursorStatus = 'uninitialized';
  nextPageState?: string;
  limit: number;

  page: WithId<Schema>[] = [];
  exhausted = false;
  pageIndex = 0;

  constructor(collection: Collection<Schema>, filter: Filter<Schema>, options?: FindOptions<Schema>) {
    this.collection = collection;
    this.filter = filter;
    this.options = options ?? {};

    const isOverPageSizeLimit =
      this.options.sort &&
      this.options.sort.$vector == null &&
      (this.options.limit == null || this.options.limit > 20);
    if (isOverPageSizeLimit) {
      throw new Error(
        'Cannot set sort option without limit <= 20, JSON API can currently only return 20 documents with sort',
      );
    }

    this.limit = options?.limit || Infinity;
    this.status = 'initialized';
  }

  /**
   *
   * @returns Record<string, any>[]
   */
  async toArray(): Promise<WithId<Schema>[]> {
    return executeOperation(async () => {
      await this._getAll();
      return this.documents;
    });
  }

  /**
   *
   * @returns void
   */
  private async _getAll(): Promise<void> {
    if (this.status === 'executed' || this.status === 'executing') {
      return;
    }

    for (let doc = await this.next(); doc != null; doc = await this.next()) {
      this.documents.push(doc);
    }
  }

  /**
   * @returns Promise
   */
  async next(): Promise<WithId<Schema> | null> {
    return executeOperation(async () => {
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
    });
  }

  private async _getMore(): Promise<void> {
    const command: {
      find: {
        filter?: Record<string, any>;
        options?: InternalFindOptions;
        sort?: Record<string, any>;
        projection?: Record<string, any>;
      };
    } = {
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
    const resp = await this.collection.httpClient.executeCommand(
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

  /**
   *
   * @param iterator
   */
  async forEach(iterator: any): Promise<void> {
    return executeOperation(async () => {
      for (let doc = await this.next(); doc != null; doc = await this.next()) {
        iterator(doc);
      }
    });
  }

  /**
   *
   * @returns Promise<number>
   */
  async count(): Promise<number> {
    return this.toArray().then((docs) => docs.length);
  }

  /**
   *
   */
  stream(): TypeErr<'Streaming cursors are not supported'> {
    throw new Error('Streaming cursors are not supported');
  }
}
