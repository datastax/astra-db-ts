import axios from "axios";
import { Components } from "../astra";
import CountDocumentsCommands = Components.Schemas.CountDocumentsCommands;
import DeleteManyCommand = Components.Schemas.DeleteManyCommand;
import DeleteOneCommand = Components.Schemas.DeleteOneCommand;
import FindCommand = Components.Schemas.FindCommand;
import FindOneCommand = Components.Schemas.FindOneCommand;
import FindOneAndDeleteCommand = Components.Schemas.FindOneAndDeleteCommand;
import FindOneAndReplaceCommand = Components.Schemas.FindOneAndReplaceCommand;
import FindOneAndUpdateCommand = Components.Schemas.FindOneAndUpdateCommand;
import InsertOneCommand = Components.Schemas.InsertOneCommand;
import InsertManyCommand = Components.Schemas.InsertManyCommand;
import UpdateManyCommand = Components.Schemas.UpdateManyCommand;
import UpdateOneCommand = Components.Schemas.UpdateOneCommand;

export interface AstraCollectionArgs {
  collectionName: string;
  namespace?: string;
  apiConfig: {
    base: string;
    requestOptions: any;
  };
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

  public countDocuments = async (opts: CountDocumentsCommands) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        countDocuments: {
          filter: opts.filter,
          options: opts.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public deleteOne = async (opts: DeleteOneCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        deleteOne: {
          filter: opts?.filter,
          sort: opts?.sort,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public deleteMany = async (opts?: DeleteManyCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        deleteMany: {
          filter: opts?.filter,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public find = async (opts?: FindCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        find: {
          filter: opts?.filter,
          projection: opts?.projection,
          sort: opts?.sort,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };

  public findOne = async (opts?: FindOneCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOne: {
          filter: opts?.filter,
          sort: opts?.sort,
          projection: opts?.projection,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public findOneAndDelete = async (opts: FindOneAndDeleteCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOneAndDelete: {
          filter: opts?.filter,
          sort: opts?.sort,
          projection: opts.projection,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public findOneAndReplace = async (opts: FindOneAndReplaceCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOneAndReplace: {
          filter: opts?.filter,
          replacement: opts?.replacement,
          sort: opts?.sort,
          options: opts?.options,
          projection: opts?.projection,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public findOneAndUpdate = async (opts: FindOneAndUpdateCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        findOneAndUpdate: {
          filter: opts?.filter,
          update: opts?.update,
          sort: opts?.sort,
          options: opts?.options,
          projection: opts?.projection,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public insertOne = async (opts: InsertOneCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        insertOne: {
          document: opts?.document,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public insertMany = async (opts: InsertManyCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        insertMany: {
          documents: opts?.documents,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public updateMany = async (opts: UpdateManyCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        updateMany: {
          update: opts?.update,
          filter: opts?.filter,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
  public updateOne = async (opts: UpdateOneCommand) => {
    const response = await axios.post(
      `${this.apiConfig.base}/${this.namespace}/${this.collectionName}`,
      {
        updateOne: {
          update: opts?.update,
          filter: opts?.filter,
          sort: opts?.sort,
          options: opts?.options,
        },
      },
      this.apiConfig.requestOptions,
    );
    return response?.data;
  };
}
