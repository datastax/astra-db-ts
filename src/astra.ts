import axios, { AxiosRequestConfig } from "axios";
import { Collection } from "./collection";
import { Components } from "../astra";
import CreateCollectionCommand = Components.Schemas.CreateCollectionCommand;
import DeleteCollectionCommand = Components.Schemas.DeleteCollectionCommand;
import CommandResult = Components.Schemas.CommandResult;

export interface AstraClientConfig {
  token: string;
  databaseId: string;
  databaseRegion: "us-east1" | "us-west-2" | "eu-central-1";
  namespace?: string;
}

export class Astra {
  private config: AstraClientConfig;
  private apiBase: string;
  private namespace: string;
  private readonly requestOptions: AxiosRequestConfig;

  constructor(options: AstraClientConfig) {
    this.config = options;
    this.namespace = options.namespace || "default_namespace";
    this.apiBase = `https://${this.config.databaseId}-${this.config.databaseRegion}.apps.astra.datastax.com/api/json/v1`;
    this.requestOptions = {
      headers: {
        "X-Cassandra-Token": this.config.token,
        "user-agent": "astra-ts-client/0.0.1",
      },
    };
  }

  public createCollection = async (
    args: CreateCollectionCommand,
  ): Promise<CommandResult> => {
    const response = await axios.post(
      `${this.apiBase}/${this.namespace}`,
      {
        createCollection: {
          name: args?.name,
          options: args?.options,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };
  public findCollections = async (): Promise<CommandResult> => {
    const response = await axios.post(
      `${this.apiBase}/${this.namespace}`,
      {
        findCollections: {},
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public deleteCollection = async (
    args: DeleteCollectionCommand,
  ): Promise<CommandResult> => {
    const response = await axios.post(
      `${this.apiBase}/${this.namespace}`,
      {
        deleteCollection: {
          name: args?.name,
          options: args?.options,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public collection = (collectionName: string) => {
    return new Collection({
      collectionName,
      namespace: this.namespace,
      apiConfig: {
        base: this.apiBase,
        requestOptions: this.requestOptions,
      },
    });
  };
}
