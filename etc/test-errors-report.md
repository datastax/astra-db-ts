# integration.data-api.cursor

## (parallel) readBufferedDocuments() tests

### should read all raw buffered documents (129ms)

```ts
InsertManyError: Failed to insert document with _id '0': Document already exists with the given _id
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at insertManyUnordered (src/data-api/collection.ts:1577:35)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at Collection.insertMany (src/data-api/collection.ts:304:9)
    at Object.<anonymous> (tests/integration/data-api/cursor.test.ts:191:7)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '0': Document already exists with the given _id",
      attributes: {}
    },
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '1': Document already exists with the given _id",
      attributes: {}
    },
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '2': Document already exists with the given _id",
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '0': Document already exists with the given _id",
          attributes: {}
        },
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '1': Document already exists with the given _id",
          attributes: {}
        },
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '2': Document already exists with the given _id",
          attributes: {}
        }
      ],
      command: {
        insertMany: {
          documents: [ { _id: '0' }, { _id: '1' }, { _id: '2' } ],
          options: { ordered: false }
        }
      },
      rawResponse: {
        status: { insertedIds: [] },
        errors: [
          {
            message: "Failed to insert document with _id '0': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          },
          {
            message: "Failed to insert document with _id '1': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          },
          {
            message: "Failed to insert document with _id '2': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          }
        ]
      }
    }
  ],
  partialResult: { insertedIds: [], insertedCount: 0 }
}
```


### should read all raw buffered documents with a max (72ms)

```ts
InsertManyError: Failed to insert document with _id '0': Document already exists with the given _id
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at insertManyUnordered (src/data-api/collection.ts:1577:35)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at Collection.insertMany (src/data-api/collection.ts:304:9)
    at Object.<anonymous> (tests/integration/data-api/cursor.test.ts:204:7)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 1)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '0': Document already exists with the given _id",
      attributes: {}
    },
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '1': Document already exists with the given _id",
      attributes: {}
    },
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '2': Document already exists with the given _id",
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '0': Document already exists with the given _id",
          attributes: {}
        },
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '1': Document already exists with the given _id",
          attributes: {}
        },
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '2': Document already exists with the given _id",
          attributes: {}
        }
      ],
      command: {
        insertMany: {
          documents: [ { _id: '0' }, { _id: '1' }, { _id: '2' } ],
          options: { ordered: false }
        }
      },
      rawResponse: {
        status: { insertedIds: [] },
        errors: [
          {
            message: "Failed to insert document with _id '0': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          },
          {
            message: "Failed to insert document with _id '1': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          },
          {
            message: "Failed to insert document with _id '2': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          }
        ]
      }
    }
  ],
  partialResult: { insertedIds: [], insertedCount: 0 }
}
```


### should read all raw buffered documents even with transformation (102ms)

```ts
InsertManyError: Failed to insert document with _id '0': Document already exists with the given _id
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at insertManyUnordered (src/data-api/collection.ts:1577:35)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at Collection.insertMany (src/data-api/collection.ts:304:9)
    at Object.<anonymous> (tests/integration/data-api/cursor.test.ts:217:7)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 2)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '0': Document already exists with the given _id",
      attributes: {}
    },
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '1': Document already exists with the given _id",
      attributes: {}
    },
    {
      errorCode: 'DOCUMENT_ALREADY_EXISTS',
      message: "Failed to insert document with _id '2': Document already exists with the given _id",
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '0': Document already exists with the given _id",
          attributes: {}
        },
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '1': Document already exists with the given _id",
          attributes: {}
        },
        {
          errorCode: 'DOCUMENT_ALREADY_EXISTS',
          message: "Failed to insert document with _id '2': Document already exists with the given _id",
          attributes: {}
        }
      ],
      command: {
        insertMany: {
          documents: [ { _id: '0' }, { _id: '1' }, { _id: '2' } ],
          options: { ordered: false }
        }
      },
      rawResponse: {
        status: { insertedIds: [] },
        errors: [
          {
            message: "Failed to insert document with _id '0': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          },
          {
            message: "Failed to insert document with _id '1': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          },
          {
            message: "Failed to insert document with _id '2': Document already exists with the given _id",
            errorCode: 'DOCUMENT_ALREADY_EXISTS'
          }
        ]
      }
    }
  ],
  partialResult: { insertedIds: [], insertedCount: 0 }
}
```
# (parallel) integration.devops.db-admin

## [LONG] works (1005ms)

```ts
DevOpsAPIResponseError: database is not in a valid state to perform requested action
    at DevOpsAPIHttpClient.request (src/api/clients/devops-api-http-client.ts:91:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DevOpsAPIHttpClient.requestLongRunning (src/api/clients/devops-api-http-client.ts:125:18)
    at AstraDbAdmin.createNamespace (src/devops/astra-db-admin.ts:226:5)
    at Object.<anonymous> (tests/integration/devops/db-admin.test.ts:26:5)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errors: [
    {
      id: 2000049,
      message: 'database is not in a valid state to perform requested action'
    }
  ],
  status: 409,
  raw: {
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      date: 'Fri, 26 Jul 2024 18:50:58 GMT',
      server: 'istio-envoy',
      'strict-transport-security': 'max-age=63072000; include-subdomains',
      'x-envoy-upstream-service-time': '37',
      'content-length': '100',
      connection: 'keep-alive'
    },
    body: '{"errors":[{"ID":2000049,"message":"database is not in a valid state to perform requested action"}]}',
    status: 409,
    url: 'https://api.astra.datastax.com/v2/databases/480f95a5-fd3f-40a1-aac6-2ca765b09be0/keyspaces/slania',
    httpVersion: 1,
    statusText: 'Conflict'
  }
}
```
# integration.misc.headers

## (parallel) token providers

### should call the provider on a per-call basis to the Data API (2265ms)

```ts
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
[32m+ actual[39m [31m- expected[39m

[32m+[39m 'Cassandra:Y2FkZW5jZSBvZg==:aGVyIGxhc3QgYnJlYXRo'
[31m-[39m 'tree'
    at Object.<anonymous> (tests/integration/misc/headers.test.ts:89:14)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'Cassandra:Y2FkZW5jZSBvZg==:aGVyIGxhc3QgYnJlYXRo',
  expected: 'tree',
  operator: 'strictEqual'
}
```


### should work with an async provider (283ms)

```ts
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
[32m+ actual[39m [31m- expected[39m

[32m+[39m 'Cassandra:Y2FkZW5jZSBvZg==:aGVyIGxhc3QgYnJlYXRo'
[31m-[39m 'AstraCS:OengMjURbGWRjuMTBMqXWwOn:3bcbf200a056069bb00f17fa52d92d935952a1f2ac58c99596edabb1e1b3950c'
    at Object.<anonymous> (tests/integration/misc/headers.test.ts:103:14)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 1)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'Cassandra:Y2FkZW5jZSBvZg==:aGVyIGxhc3QgYnJlYXRo',
  expected: 'AstraCS:OengMjURbGWRjuMTBMqXWwOn:3bcbf200a056069bb00f17fa52d92d935952a1f2ac58c99596edabb1e1b3950c',
  operator: 'strictEqual'
}
```


### [ASTRA] should call the provider on a per-call basis to the DevOps API (244ms)

```ts
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
[32m+ actual[39m [31m- expected[39m

[32m+[39m undefined
[31m-[39m 'Bearer tree'
    at Object.<anonymous> (tests/integration/misc/headers.test.ts:112:14)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 2)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: 'Bearer tree',
  operator: 'strictEqual'
}
```

## (parallel) embedding header providers

### should call the provider on a per-call basis to the Data API (207ms)

```ts
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
[32m+ actual[39m [31m- expected[39m

[32m+[39m 'drain of incarnation'
[31m-[39m 'tree'
    at Object.<anonymous> (tests/integration/misc/headers.test.ts:168:14)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'drain of incarnation',
  expected: 'tree',
  operator: 'strictEqual'
}
```
# (parallel) [VECTORIZE] generated tests

## has a working lifecycle (huggingfaceDedicated@endpoint-defined-model@providerKey@specified) (171ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'aHVnZ2luZ2ZhY2VEZWRpY2F0ZWRAZW5kcG9pbnQtZGVmaW5l',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: 384,
              service: {
                provider: 'huggingfaceDedicated',
                modelName: 'endpoint-defined-model',
                authentication: { providerKey: 'dedicated.providerKey' },
                parameters: {
                  endpointName: 'f70gexilb56vxkhc',
                  regionName: 'us-east-1',
                  cloudName: 'aws'
                }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (azureOpenAI@text-embedding-3-small@providerKey@default) (177ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 3)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YXp1cmVPcGVuQUlAdGV4dC1lbWJlZGRpbmctMy1zbWFsbEBo',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'azureOpenAI',
                modelName: 'text-embedding-3-small',
                authentication: { providerKey: 'azure_open_ai.providerKey' },
                parameters: {
                  deploymentId: 'text-embedding-3-small-steo',
                  resourceName: 'steo-azure-openai'
                }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (azureOpenAI@text-embedding-3-small@providerKey/1536) (171ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 4)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YXp1cmVPcGVuQUlAdGV4dC1lbWJlZGRpbmctMy1zbWFsbEBw',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: 1536,
              service: {
                provider: 'azureOpenAI',
                modelName: 'text-embedding-3-small',
                authentication: { providerKey: 'azure_open_ai.providerKey' },
                parameters: {
                  deploymentId: 'text-embedding-3-small-steo',
                  resourceName: 'steo-azure-openai'
                }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (azureOpenAI@text-embedding-3-large@providerKey@default) (161ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 7)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YXp1cmVPcGVuQUlAdGV4dC1lbWJlZGRpbmctMy1sYXJnZUBo',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'azureOpenAI',
                modelName: 'text-embedding-3-large',
                authentication: { providerKey: 'azure_open_ai.providerKey' },
                parameters: {
                  deploymentId: 'text-embedding-3-large-steo',
                  resourceName: 'steo-azure-openai'
                }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (azureOpenAI@text-embedding-3-large@providerKey/1536) (191ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YXp1cmVPcGVuQUlAdGV4dC1lbWJlZGRpbmctMy1sYXJnZUBw',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: 1536,
              service: {
                provider: 'azureOpenAI',
                modelName: 'text-embedding-3-large',
                authentication: { providerKey: 'azure_open_ai.providerKey' },
                parameters: {
                  deploymentId: 'text-embedding-3-large-steo',
                  resourceName: 'steo-azure-openai'
                }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (azureOpenAI@text-embedding-ada-002@header@default) (30003ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 1)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```

## has a working lifecycle (azureOpenAI@text-embedding-ada-002@providerKey@default) (189ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 2)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YXp1cmVPcGVuQUlAdGV4dC1lbWJlZGRpbmctYWRhLTAwMkBo',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'azureOpenAI',
                modelName: 'text-embedding-ada-002',
                authentication: { providerKey: 'azure_open_ai.providerKey' },
                parameters: {
                  deploymentId: 'ada2-steo',
                  resourceName: 'steo-azure-openai'
                }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (bedrock@amazon.titan-embed-text-v1@header@default) (30002ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 3)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```

## has a working lifecycle (bedrock@amazon.titan-embed-text-v2:0@header@default) (30002ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 4)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```

## has a working lifecycle (bedrock@amazon.titan-embed-text-v2:0@header/1024) (20031ms)

```ts
DataAPIResponseError: Table 'YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow' doesn't exist
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 5)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'INVALID_QUERY',
      message: "Table 'YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow' doesn't exist",
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'INVALID_QUERY',
          message: "Table 'YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow' doesn't exist",
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: 1024,
              service: {
                provider: 'bedrock',
                modelName: 'amazon.titan-embed-text-v2:0',
                authentication: { providerKey: undefined },
                parameters: { region: 'us-east-1' }
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: "Table 'YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow' doesn't exist",
            errorCode: 'INVALID_QUERY'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-large-2-instruct@header@default) (16637ms)

```ts
DataAPIResponseError: Too many indexes: collection "YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow" creation failed due to index creation failing; need 10 indexes to create the collection;
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 6)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'TOO_MANY_INDEXES',
      message: 'Too many indexes: collection "YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow" creation failed due to index creation failing; need 10 indexes to create the collection;',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'TOO_MANY_INDEXES',
          message: 'Too many indexes: collection "YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow" creation failed due to index creation failing; need 10 indexes to create the collection;',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-large-2-instruct',
                authentication: { providerKey: undefined },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Too many indexes: collection "YmVkcm9ja0BhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12Mjow" creation failed due to index creation failing; need 10 indexes to create the collection;',
            errorCode: 'TOO_MANY_INDEXES'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-large-2-instruct@providerKey@default) (180ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 7)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLWxhcmdlLTItaW5zdHJ1Y3RAaGVh',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-large-2-instruct',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-law-2@providerKey@default) (192ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 1)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLWxhdy0yQGhlYWRlckBkZWZhdWx0',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-law-2',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-code-2@providerKey@default) (188ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 3)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLWNvZGUtMkBoZWFkZXJAZGVmYXVs',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-code-2',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-large-2@providerKey@default) (155ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 5)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLWxhcmdlLTJAaGVhZGVyQGRlZmF1',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-large-2',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-2@providerKey@default) (166ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 7)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLTJAaGVhZGVyQGRlZmF1bHQ',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-2',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-finance-2@header@default) (30004ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 0)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```

## has a working lifecycle (voyageAI@voyage-finance-2@providerKey@default) (305ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 1)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLWZpbmFuY2UtMkBoZWFkZXJAZGVm',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-finance-2',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (voyageAI@voyage-multilingual-2@header@default) (30002ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 2)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```

## has a working lifecycle (voyageAI@voyage-multilingual-2@providerKey@default) (276ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 3)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dm95YWdlQUlAdm95YWdlLW11bHRpbGluZ3VhbC0yQGhlYWRl',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'voyageAI',
                modelName: 'voyage-multilingual-2',
                authentication: { providerKey: 'voyage_ai' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (upstageAI@solar-embedding-1-large@header@default) (30002ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 4)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```

## has a working lifecycle (upstageAI@solar-embedding-1-large@providerKey@default) (279ms)

```ts
DataAPIResponseError: Invalid credential name for vectorize:  with error: Credential not found
    at mkRespErrorFromResponses (src/data-api/errors.ts:570:20)
    at mkRespErrorFromResponse (src/data-api/errors.ts:541:34)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:209:38)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 5)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  errorDescriptors: [
    {
      errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
      message: 'Invalid credential name for vectorize:  with error: Credential not found',
      attributes: {}
    }
  ],
  detailedErrorDescriptors: [
    {
      errorDescriptors: [
        {
          errorCode: 'VECTORIZE_CREDENTIAL_INVALID',
          message: 'Invalid credential name for vectorize:  with error: Credential not found',
          attributes: {}
        }
      ],
      command: {
        createCollection: {
          name: 'dXBzdGFnZUFJQHNvbGFyLWVtYmVkZGluZy0xLWxhcmdlQGhl',
          options: {
            defaultId: undefined,
            indexing: undefined,
            vector: {
              dimension: undefined,
              service: {
                provider: 'upstageAI',
                modelName: 'solar-embedding-1-large',
                authentication: { providerKey: 'upstage' },
                parameters: undefined
              }
            }
          }
        }
      },
      rawResponse: {
        errors: [
          {
            message: 'Invalid credential name for vectorize:  with error: Credential not found',
            errorCode: 'VECTORIZE_CREDENTIAL_INVALID'
          }
        ]
      }
    }
  ]
}
```

## has a working lifecycle (nvidia@NV-Embed-QA@none@default) (30003ms)

```ts
DataAPITimeoutError: Command timed out after 30000ms
    at TimeoutManager.mkTimeoutError (src/api/clients/data-api-http-client.ts:152:46)
    at Object.mkTimeoutError (src/api/clients/http-client.ts:85:49)
    at FetchH2.fetch (src/api/fetch/fetch-h2.ts:72:20)
    at DataAPIHttpClient._request (src/api/clients/http-client.ts:78:12)
    at DataAPIHttpClient._requestDataAPI (src/api/clients/data-api-http-client.ts:190:20)
    at DataAPIHttpClient.executeCommand (src/api/clients/data-api-http-client.ts:158:12)
    at Db.createCollection (src/data-api/db.ts:468:5)
    at Object.<anonymous> (tests/integration/data-api/vectorize.test.ts:222:24)
    at /home/me/work/astra-db-ts/tests/test-utils.ts:67:18
    at async Promise.all (index 6)
    at Context.<anonymous> (tests/test-utils.ts:72:17) {
  timeout: 30000
}
```