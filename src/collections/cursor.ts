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

import { Collection } from "./collection";
import { executeOperation } from "./utils";
import {
  findInternalOptionsKeys,
  FindOptions,
  FindOptionsInternal,
} from "./options";

export class FindCursor {
  collection: Collection;
  filter: Record<string, any>;
  options: FindOptions;
  documents: Record<string, any>[] = [];
  status = "uninitialized";
  nextPageState?: string;
  limit: number;

  page: Record<string, any>[] = [];
  pageIndex: number;
  exhausted: boolean;

  constructor(
    collection: Collection,
    filter: Record<string, any>,
    options?: FindOptions,
  ) {
    this.collection = collection;
    this.filter = filter;
    this.options = options ?? {};

    const isOverPageSizeLimit =
      this.options.sort &&
      this.options.sort.$vector == null &&
      (this.options.limit == null || this.options.limit > 20);
    if (isOverPageSizeLimit) {
      throw new Error(
        "Cannot set sort option without limit <= 20, JSON API can currently only return 20 documents with sort",
      );
    }

    this.limit = options?.limit || Infinity;
    this.status = "initialized";
    this.exhausted = false;

    // Current position in batch
    this.pageIndex = 0;
  }

  /**
   *
   * @returns void
   */
  private async getAll() {
    if (this.status === "executed" || this.status === "executing") {
      return;
    }

    for (let doc = await this.next(); doc != null; doc = await this.next()) {
      this.documents.push(doc);
    }

    return this.documents;
  }

  /**
   *
   * @returns Record<string, any>[]
   */
  async toArray(): Promise<any[]> {
    await this.getAll();
    return this.documents;
  }

  /**
   * @returns Promise
   */
  async next(): Promise<any> {
    return executeOperation(async () => {
      if (this.pageIndex < this.page.length) {
        return this.page[this.pageIndex++];
      }

      if (this.exhausted) {
        this.status = "executed";
      }

      if (this.status === "executed") {
        return null;
      }

      this.status = "executing";

      await this._getMore();

      return this.page[this.pageIndex++] || null;
    });
  }

  async _getMore() {
    const command: {
      find: {
        filter?: Record<string, any>;
        options?: FindOptionsInternal;
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
    const options: FindOptionsInternal = {};
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
      findInternalOptionsKeys,
    );
    this.nextPageState = resp.data.nextPageState;
    if (this.nextPageState == null) {
      this.exhausted = true;
    }
    this.page = Object.keys(resp.data.documents).map(
      (i) => resp.data.documents[i],
    );
    this.pageIndex = 0;
  }

  /**
   *
   * @param iterator
   */
  async forEach(iterator: any) {
    return executeOperation(async () => {
      for (let doc = await this.next(); doc != null; doc = await this.next()) {
        iterator(doc);
      }
    });
  }

  /**
   *
   * @returns Promise<number>
   * @param options
   */
  async count(options?: any) {
    return executeOperation(async () => {
      await this.getAll();
      return this.documents.length;
    });
  }

  // NOOPS and unimplemented

  /**
   *
   * @param options
   */
  stream(options?: any) {
    throw new Error("Streaming cursors are not supported");
  }
}
