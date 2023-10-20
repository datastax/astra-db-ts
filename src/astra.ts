import axios, { AxiosRequestConfig } from "axios";

export interface AstraClientConfig {
  token: string;
  databaseId: string;
  databaseRegion: "us-east1" | "us-west-2" | "eu-central-1";
  keyspace?: string;
}

export interface FilterClause {

}

export interface SortClause {

}

export interface UpdateClause {

}

export interface JsonNode {

}

export interface Options1 {

}

export class Astra {
  private config: AstraClientConfig;
  private apiBase: string;
  private readonly requestOptions: AxiosRequestConfig;

  constructor(options: AstraClientConfig) {
    this.config = options;
    this.apiBase = `https://${this.config.databaseId}-${this.config.databaseRegion}.apps.astra.datastax.com/api/json/v1`;
    this.requestOptions = {
      headers: {
        "X-Cassandra-Token": this.config.token,
      },
    };
  }

  public createNamespace = async (name: string) => {
    const response = await axios.post(
      `${this.apiBase}`,
      {
        createNamespace: {
          name,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public findNamespaces = async () => {
    const response = await axios.post(
      `${this.apiBase}`,
      {
        findNamespaces: {},
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public dropNamespace = async (name: string) => {
    const response = await axios.post(
      `${this.apiBase}`,
      {
        dropNamespace: {
          name,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public createCollection = async (namespace: string, name: string) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}`,
      {
        createCollection: {
          name,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };
  public findCollections = async (namespace: string) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}`,
      {
        findCollections: {},
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public deleteCollection = async (namespace: string, name: string) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}`,
      {
        deleteCollection: {
          name,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public countDocuments = async (
    namespace: string,
    collection: string,
    filter?: FilterClause
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        countDocuments: {
          filter,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public deleteOne = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
    sort?: SortClause
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        deleteOne: {
          filter,
          sort,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public deleteMany = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        deleteMany: {
          filter,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public find = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        find: {
          filter,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public findOne = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
    sort?: SortClause,
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        findOne: {
          filter,
          sort,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public findOneAndDelete = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
    sort?: SortClause,
    options?: Options1
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        findOneAndDelete: {
          filter,
          sort,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public findOneAndReplace = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
    replacement?: JsonNode,
    sort?: SortClause,
    options?: Options1
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        findOneAndReplace: {
          filter,
          replacement,
          sort,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public findOneAndUpdate = async (
    namespace: string,
    collection: string,
    filter?: FilterClause,
    update?: UpdateClause,
    sort?: SortClause,
    options?: {
      upsert?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        findOneAndUpdate: {
          filter,
          update,
          sort,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public insertOne = async (
    namespace: string,
    collection: string,
    document: any,
    options?: {
      ordered?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        insertOne: {
          document,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public insertMany = async (
    namespace: string,
    collection: string,
    documents: any,
    options?: {
      ordered?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        insertMany: {
          documents,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public updateMany = async (
    namespace: string,
    collection: string,
    update: UpdateClause,
    filter?: FilterClause,
    options?: {
      upsert?: boolean;
    }

  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        updateMany: {
          update,
          filter,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
  public updateOne = async (
    namespace: string,
    collection: string,
    update: UpdateClause,
    filter?: FilterClause,
    sort?: SortClause,
    options?: {
      upsert?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiBase}/${namespace}/${collection}`,
      {
        updateOne: {
          update,
          filter,
          sort,
          options
        },
      },
      this.requestOptions,
    );
    return response?.data;
  }
}
