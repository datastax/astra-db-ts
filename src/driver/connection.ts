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

import { Client } from '@/src/collections/client';
import { Collection } from './collection';
import { default as MongooseConnection } from 'mongoose/lib/connection';
import STATES from 'mongoose/lib/connectionstate';
import { executeOperation } from '../collections/utils';

export class Connection extends MongooseConnection {
    debugType = 'StargateMongooseConnection';
    initialConnection: Promise<Connection> | null = null;

    constructor(base: any) {
        super(base);
    }

    _waitForClient() {
        return new Promise<void>((resolve, reject) => {
            if (
                (this.readyState === STATES.connecting || this.readyState === STATES.disconnected) &&
        this._shouldBufferCommands()
            ) {
                this._queue.push({ fn: resolve });
            } else if (this.readyState === STATES.disconnected && this.db == null) {
                reject(new Error('Connection is disconnected'));
            } else {
                resolve();
            }
        });
    }

    collection(name: string, options: any) {
        if (!(name in this.collections)) {
            this.collections[name] = new Collection(name, this, options);
        }
        return super.collection(name, options);
    }

    async createCollection(name: string, options?: Record<string, any>) {
        return executeOperation(async () => {
            await this._waitForClient();
            const db = this.client.db();
            if (!this.client.httpClient.isAstra) {
                db.createDatabase();
            }
            return db.createCollection(name, options);
        });
    }

    async dropCollection(name: string) {
        return executeOperation(async () => {
            await this._waitForClient();
            const db = this.client.db();
            return db.dropCollection(name);
        });
    }

    async dropDatabase() {
        return executeOperation(async () => {
            await this._waitForClient();
            const db = this.client.db();
            return db.dropDatabase();
        });
    }

    async openUri(uri: string, options: any) {
        let _fireAndForget = false;
        if (options && '_fireAndForget' in options) {
            _fireAndForget = options._fireAndForget;
            delete options._fireAndForget;
        }

        // Set Mongoose-specific config options. Need to set
        // this in order to allow connection-level overrides for
        // these options.
        this.config = {
            autoCreate: options?.autoCreate,
            autoIndex: options?.autoIndex,
            sanitizeFilter: options?.sanitizeFilter,
            bufferCommands: options?.bufferCommands
        };

        for (const model of Object.values(this.models)) {
            // @ts-ignore
            model.init().catch(() => { });
        }

        this.initialConnection = this.createClient(uri, options)
            .then(() => this)
            .catch(err => {
                this.readyState = STATES.disconnected;
                throw err;
            });

        if (_fireAndForget) {
            return this;
        }

        await this.initialConnection;

        return this;
    }

    async createClient(uri: string, options: any) {
        this._connectionString = uri;
        this._closeCalled = false;
        this.readyState = STATES.connecting;

        const client = await Client.connect(uri, options);
        this.client = client;
        this.db = client.db();

        this.readyState = STATES.connected;
        this.onOpen();
        return this;
    }

    setClient(client: Client) {
        this.client = client;
        this.db = client.db();
    }

    asPromise() {
        return this.initialConnection;
    }

    /**
     *
     * @returns Client
     */
    doClose(_force?: boolean) {
        return this;
    }
}