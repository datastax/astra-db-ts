import type {
  OpenAPIClient,
  Parameters,
  UnknownParamsObject,
  OperationResponse,
  AxiosRequestConfig,
} from "openapi-client-axios";

declare namespace Components {
  namespace Parameters {
    export type Collection = string; // [a-zA-Z][a-zA-Z0-9_]*
    export type Namespace = string; // [a-zA-Z][a-zA-Z0-9_]*
  }
  export interface PathParameters {
    collection: Parameters.Collection /* [a-zA-Z][a-zA-Z0-9_]* */;
    namespace: Parameters.Namespace /* [a-zA-Z][a-zA-Z0-9_]* */;
  }
  namespace Schemas {
    export interface CommandResult {
      /**
       * A response data holding documents that were returned as the result of a command.
       */
      data?: /* A response data holding documents that were returned as the result of a command. */ /* Response data for multiple documents commands. */
      | MultiResponseData
        | /* Response data for a single document commands. */ SingleResponseData;
      /**
       * Status objects, generally describe the side effects of commands, such as the number of updated or inserted documents.
       */
      status?: {
        [name: string]: any;
        /**
         * IDs of inserted documents for an insert command.
         */
        insertedIds?: string[] | null;
      } | null;
      errors?: /* List of errors that occurred during a command execution. Can include additional properties besides the message that is always provided, like `errorCode`, `exceptionClass`, etc. */
      Error[] | null;
    }
    export interface ComparisonExpression {
      path: string; // \S
      filterOperations: [
        {
          [key: string]: any;
        },
        ...{
          [key: string]: any;
        }[],
      ];
    }
    /**
     * Command that returns count of documents in a collection based on the collection.
     */
    export interface CountDocumentsCommands {
      options?: JsonNode;
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
    }
    /**
     * Command that creates a collection.
     */
    export interface CreateCollectionCommand {
      /**
       * Name of the collection
       */
      name: string; // [a-zA-Z][a-zA-Z0-9_]*
      /**
       * Configuration for the collection
       */
      options?: {
        /**
         * Vector search index configuration for the collection
         */
        vector?: {
          /**
           * Vector field embedding size
           */
          size?: number; // int32
          /**
           * Similarity function algorithm that needs to be used for vector search
           */
          function?: string; // (dot_product|cosine|euclidean)
        };
        /**
         * Embedding api configuration to support `$vectorize`
         */
        vectorize?: {
          /**
           * Vector field embedding size
           */
          size?: number; // int32
          /**
           * Similarity function algorithm that needs to be used for vector search
           */
          function?: string; // (dot_product|cosine|euclidean)
        };
      };
    }
    /**
     * Command that create embedding service configuration.
     */
    export interface CreateEmbeddingServiceCommand {
      options?: JsonNode;
      /**
       * Service name to be created
       */
      name: string; // [a-zA-Z][a-zA-Z0-9_]*
      /**
       * Embedding service provider name
       */
      apiProvider?: string; // (openai|vertexai|huggingface)
      /**
       * Api token from the service provider
       */
      apiKey: string;
      /**
       * Base url for the service provider
       */
      baseUrl: string;
    }
    /**
     * Command that creates a namespace.
     */
    export interface CreateNamespaceCommand {
      /**
       * Name of the namespace
       */
      name: string; // [a-zA-Z][a-zA-Z0-9_]*
      options?: /* Options for creating a new namespace. */ CreateNamespaceCommandOptions;
    }
    /**
     * Options for creating a new namespace.
     */
    export interface CreateNamespaceCommandOptions {
      replication?: /* Cassandra based replication settings. */ Replication;
    }
    /**
     * Command that deletes a collection if one exists.
     */
    export interface DeleteCollectionCommand {
      options?: JsonNode;
      /**
       * Name of the collection
       */
      name: string; // [a-zA-Z][a-zA-Z0-9_]*
    }
    /**
     * Command that finds documents based on the filter and deletes them from a collection
     */
    export interface DeleteManyCommand {
      options?: JsonNode;
      /**
       * Filter clause based on which documents are identified
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      filter?: {
        comparisonExpressions?: ComparisonExpression[];
      };
    }
    /**
     * Command that finds a single document and deletes it from a collection
     */
    export interface DeleteOneCommand {
      options?: JsonNode;
      /**
       * Filter clause based on which document is identified
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      filter: {
        comparisonExpressions?: ComparisonExpression[];
      };
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
    }
    /**
     * Command that deletes a namespace.
     */
    export interface DropNamespaceCommand {
      options?: JsonNode;
      /**
       * Name of the namespace
       */
      name: string; // [a-zA-Z][a-zA-Z0-9_]*
    }
    /**
     * List of errors that occurred during a command execution. Can include additional properties besides the message that is always provided, like `errorCode`, `exceptionClass`, etc.
     */
    export interface Error {
      /**
       * Human-readable error message.
       */
      message?: string;
    }
    /**
     * example:
     * {
     *   "name": "Aaron",
     *   "country": "US"
     * }
     */
    export interface FilterClause {
      comparisonExpressions?: ComparisonExpression[];
    }
    /**
     * Command that lists all available collections in a namespace.
     */
    export interface FindCollectionsCommand {
      options?: JsonNode;
    }
    /**
     * Command that finds a single JSON document from a collection.
     */
    export interface FindCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      projection?: JsonNode;
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
      options?: Options1;
    }
    /**
     * Command that lists all available namespaces.
     */
    export interface FindNamespacesCommand {
      options?: JsonNode;
    }
    /**
     * Command that finds a single JSON document from a collection and deletes it. The deleted document is returned
     */
    export interface FindOneAndDeleteCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
      projection?: JsonNode;
    }
    /**
     * Command that finds a single JSON document from a collection and replaces it with the replacement document.
     */
    export interface FindOneAndReplaceCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
      projection?: JsonNode;
      replacement: ObjectNode;
      options?: /* Options for `findOneAndReplace` command. */ FindOneAndReplaceCommandOptions;
    }
    /**
     * Options for `findOneAndReplace` command.
     */
    export interface FindOneAndReplaceCommandOptions {
      /**
       * Specifies which document to perform the projection on. If `before` the projection is performed on the document before the replacement is applied, if `after` the document projection is from the document after the replacement.
       */
      returnDocument?: string; // (after|before)
      /**
       * When `true`, if no documents match the `filter` clause the command will create a new _empty_ document and apply all _id filter and replacement document to the empty document.
       */
      upsert?: boolean;
    }
    /**
     * Command that finds a single JSON document from a collection and updates the value provided in the update clause.
     */
    export interface FindOneAndUpdateCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      projection?: JsonNode;
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
      update: /**
       * example:
       * {
       *   "$set": {
       *     "location": "New York"
       *   },
       *   "$unset": {
       *     "new_data": 1
       *   }
       * }
       */
      UpdateClause;
      options?: /* Options for `findOneAndUpdate` command. */ FindOneAndUpdateCommandOptions;
    }
    /**
     * Options for `findOneAndUpdate` command.
     */
    export interface FindOneAndUpdateCommandOptions {
      /**
       * Specifies which document to perform the projection on. If `before` the projection is performed on the document before the update is applied, if `after` the document projection is from the document after the update.
       */
      returnDocument?: string; // (after|before)
      /**
       * When `true`, if no documents match the `filter` clause the command will create a new _empty_ document and apply the `update` clause and all equality filters to the empty document.
       */
      upsert?: boolean;
    }
    /**
     * Command that finds a single JSON document from a collection.
     */
    export interface FindOneCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      projection?: JsonNode;
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
      options?: Options;
    }
    /**
     * Command that inserts multiple JSON document to a collection.
     */
    export interface InsertManyCommand {
      /**
       * JSON document to insert.
       */
      documents: [any, ...any[]];
      options?: /* Options for inserting many documents. */ InsertManyCommandOptions;
    }
    /**
     * Options for inserting many documents.
     */
    export interface InsertManyCommandOptions {
      /**
       * When `true` the server will insert the documents in sequential order, otherwise when `false` the server is free to re-order the inserts and parallelize them for performance. See specifications for more info on failure modes.
       */
      ordered?: boolean;
    }
    /**
     * Command that inserts a single JSON document to a collection.
     */
    export interface InsertOneCommand {
      options?: JsonNode;
      /**
       * JSON document to insert.
       */
      document: {
        [key: string]: any;
      };
    }
    export interface JsonNode {
      empty?: boolean;
      valueNode?: boolean;
      containerNode?: boolean;
      missingNode?: boolean;
      array?: boolean;
      object?: boolean;
      nodeType?: JsonNodeType;
      pojo?: boolean;
      number?: boolean;
      integralNumber?: boolean;
      floatingPointNumber?: boolean;
      short?: boolean;
      int?: boolean;
      long?: boolean;
      float?: boolean;
      double?: boolean;
      bigDecimal?: boolean;
      bigInteger?: boolean;
      textual?: boolean;
      boolean?: boolean;
      null?: boolean;
      binary?: boolean;
    }
    export interface JsonNodeFactory {
      _cfgBigDecimalExact?: boolean;
      maxElementIndexForInsert?: number; // int32
    }
    export type JsonNodeType =
      | "ARRAY"
      | "BINARY"
      | "BOOLEAN"
      | "MISSING"
      | "NULL"
      | "NUMBER"
      | "OBJECT"
      | "POJO"
      | "STRING";
    /**
     * Response data for multiple documents commands.
     */
    export interface MultiResponseData {
      /**
       * Documents that resulted from a command.
       */
      documents: any[];
      /**
       * Next page state for pagination.
       */
      nextPageState?: string | null;
    }
    export interface ObjectNode {
      valueNode?: boolean;
      containerNode?: boolean;
      missingNode?: boolean;
      array?: boolean;
      pojo?: boolean;
      number?: boolean;
      integralNumber?: boolean;
      floatingPointNumber?: boolean;
      short?: boolean;
      int?: boolean;
      long?: boolean;
      float?: boolean;
      double?: boolean;
      bigDecimal?: boolean;
      bigInteger?: boolean;
      textual?: boolean;
      boolean?: boolean;
      null?: boolean;
      binary?: boolean;
      _nodeFactory?: JsonNodeFactory;
      _children?: {
        [name: string]: JsonNode;
      };
      nodeType?: JsonNodeType;
      object?: boolean;
      empty?: boolean;
    }
    export interface Options {
      /**
       * Include similarity function score in response.
       */
      includeSimilarity?: boolean;
    }
    export interface Options1 {
      /**
       * Maximum number of document that can be fetched for the command. If value is higher than the default page size, amount of returned documents will be limited to the default page size and paging state will be returned in the response, so a caller can to continue paging through documents.
       */
      limit?: number; // int32
      /**
       * Skips provided number of documents before returning sorted documents.
       */
      skip?: number; // int32
      /**
       * Next page state for pagination.
       */
      pagingState?: string;
      /**
       * Include similarity function score in response.
       */
      includeSimilarity?: boolean;
    }
    /**
     * Cassandra based replication settings.
     */
    export interface Replication {
      class: string; // SimpleStrategy|NetworkTopologyStrategy
    }
    export interface ResponseData {}
    /**
     * Response data for a single document commands.
     */
    export interface SingleResponseData {
      /**
       * Document that resulted from a command.
       */
      document: {
        [key: string]: any;
      } | null;
    }
    /**
     * example:
     * {
     *   "user.age": -1,
     *   "user.name": 1
     * }
     */
    export interface SortClause {
      sortExpressions?: SortExpression[];
    }
    export interface SortExpression {
      path: string; // \S
      ascending?: boolean;
      vector?: number /* float */[];
      vectorize?: string;
    }
    /**
     * example:
     * {
     *   "$set": {
     *     "location": "New York"
     *   },
     *   "$unset": {
     *     "new_data": 1
     *   }
     * }
     */
    export interface UpdateClause {
      updateOperationDefs?: {
        [name: string]: ObjectNode;
      };
    }
    /**
     * Command that finds documents from a collection and updates it with the values provided in the update clause.
     */
    export interface UpdateManyCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      update: /**
       * example:
       * {
       *   "$set": {
       *     "location": "New York"
       *   },
       *   "$unset": {
       *     "new_data": 1
       *   }
       * }
       */
      UpdateClause;
      options?: /* Options for updating many documents. */ UpdateManyCommandOptions;
    }
    /**
     * Options for updating many documents.
     */
    export interface UpdateManyCommandOptions {
      /**
       * When `true`, if no documents match the `filter` clause the command will create a new _empty_ document and apply the `update` clause and all equality filters to the empty document.
       */
      upsert?: boolean;
    }
    /**
     * Command that finds a single JSON document from a collection and updates the value provided in the update clause.
     */
    export interface UpdateOneCommand {
      filter?: /**
       * example:
       * {
       *   "name": "Aaron",
       *   "country": "US"
       * }
       */
      FilterClause;
      update: /**
       * example:
       * {
       *   "$set": {
       *     "location": "New York"
       *   },
       *   "$unset": {
       *     "new_data": 1
       *   }
       * }
       */
      UpdateClause;
      sort?: /**
       * example:
       * {
       *   "user.age": -1,
       *   "user.name": 1
       * }
       */
      SortClause;
      options?: /* Options for updating a document. */ UpdateOneCommandOptions;
    }
    /**
     * Options for updating a document.
     */
    export interface UpdateOneCommandOptions {
      /**
       * When `true`, if no documents match the `filter` clause the command will create a new _empty_ document and apply the `update` clause and all equality filters to the empty document.
       */
      upsert?: boolean;
    }
  }
}
declare namespace Paths {
  namespace V1 {
    namespace Post {
      export type RequestBody =
        /* Command that create embedding service configuration. */
        | Components.Schemas.CreateEmbeddingServiceCommand
        | /* Command that creates a namespace. */ Components.Schemas.CreateNamespaceCommand;
      namespace Responses {
        export type $200 = Components.Schemas.CommandResult;
      }
    }
  }
  namespace V1$Namespace {
    namespace Post {
      namespace Parameters {
        export type $0 =
          Components.Parameters.Namespace /* [a-zA-Z][a-zA-Z0-9_]* */;
      }
      export type RequestBody =
        /* Command that creates a collection. */ Components.Schemas.CreateCollectionCommand;
      namespace Responses {
        export type $200 = Components.Schemas.CommandResult;
      }
    }
  }
  namespace V1$Namespace$Collection {
    namespace Post {
      namespace Parameters {
        export type $0 =
          Components.Parameters.Namespace /* [a-zA-Z][a-zA-Z0-9_]* */;
        export type $1 =
          Components.Parameters.Collection /* [a-zA-Z][a-zA-Z0-9_]* */;
      }
      export type RequestBody =
        /* Command that returns count of documents in a collection based on the collection. */
        | Components.Schemas.CountDocumentsCommands
        | /* Command that finds a single document and deletes it from a collection */ Components.Schemas.DeleteOneCommand
        | /* Command that finds documents based on the filter and deletes them from a collection */ Components.Schemas.DeleteManyCommand
        | /* Command that finds a single JSON document from a collection. */ Components.Schemas.FindOneCommand
        | /* Command that finds a single JSON document from a collection. */ Components.Schemas.FindCommand
        | /* Command that finds a single JSON document from a collection and deletes it. The deleted document is returned */ Components.Schemas.FindOneAndDeleteCommand
        | /* Command that finds a single JSON document from a collection and replaces it with the replacement document. */ Components.Schemas.FindOneAndReplaceCommand
        | /* Command that finds a single JSON document from a collection and updates the value provided in the update clause. */ Components.Schemas.FindOneAndUpdateCommand
        | /* Command that inserts a single JSON document to a collection. */ Components.Schemas.InsertOneCommand
        | /* Command that inserts multiple JSON document to a collection. */ Components.Schemas.InsertManyCommand
        | /* Command that finds documents from a collection and updates it with the values provided in the update clause. */ Components.Schemas.UpdateManyCommand
        | /* Command that finds a single JSON document from a collection and updates the value provided in the update clause. */ Components.Schemas.UpdateOneCommand;
      namespace Responses {
        export type $200 = Components.Schemas.CommandResult;
      }
    }
  }
}

export interface OperationMethods {}

export interface PathsDictionary {
  ["/v1"]: {};
  ["/v1/{namespace}"]: {};
  ["/v1/{namespace}/{collection}"]: {};
}

export type Client = OpenAPIClient<OperationMethods, PathsDictionary>;
