import axios from "axios";
import {Components} from "../astra";
import SortClause = Components.Schemas.SortClause;
import FilterClause = Components.Schemas.FilterClause;
import UpdateClause = Components.Schemas.UpdateClause;
import JsonNode = Components.Schemas.JsonNode;
import Options1 = Components.Schemas.Options1;

export interface AstraCollectionArgs {
  collectionName: string;
  namespace?: string;
  apiConfig: {
    base: string;
    requestOptions: any;
  }
}

export class Collection {

  private collectionName: string;
  private namespace: string;
  private apiConfig: {
    base: string;
    requestOptions: any;
  };

  constructor(args: AstraCollectionArgs) {
    this.collectionName = args.collectionName;
    this.namespace = args.namespace || "default_namespace";
    this.apiConfig = args.apiConfig;
  }

  public countDocuments = async (
    collection: string,
    filter?: FilterClause[]
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        countDocuments: {
          filter,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public deleteOne = async (
    filter?: FilterClause[],
    sort?: SortClause
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        deleteOne: {
          filter,
          sort,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public deleteMany = async (
    filter?: FilterClause[],
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        deleteMany: {
          filter,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public find = async (
    filter?: FilterClause[],
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        find: {
          filter,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public findOne = async (
    filter?: FilterClause[],
    sort?: SortClause,
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOne: {
          filter,
          sort,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public findOneAndDelete = async (
    filter?: FilterClause[],
    sort?: SortClause,
    options?: Options1
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOneAndDelete: {
          filter,
          sort,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public findOneAndReplace = async (
    filter?: FilterClause[],
    replacement?: JsonNode,
    sort?: SortClause,
    options?: Options1
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOneAndReplace: {
          filter,
          replacement,
          sort,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public findOneAndUpdate = async (
    filter?: FilterClause[],
    update?: UpdateClause,
    sort?: SortClause,
    options?: {
      upsert?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOneAndUpdate: {
          filter,
          update,
          sort,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public insertOne = async (
    document: any,
    options?: {
      ordered?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        insertOne: {
          document,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public insertMany = async (
    documents: any,
    options?: {
      ordered?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        insertMany: {
          documents,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public updateMany = async (
    update: UpdateClause,
    filter?: FilterClause[],
    options?: {
      upsert?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        updateMany: {
          update,
          filter,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
  public updateOne = async (
    update: UpdateClause,
    filter?: FilterClause[],
    sort?: SortClause,
    options?: {
      upsert?: boolean;
    }
  ) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        updateOne: {
          update,
          filter,
          sort,
          options
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  }
}