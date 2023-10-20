import axios, {AxiosRequestConfig} from "axios";
import {Collection} from "./collection";


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
      },
    };
  }

  public createCollection = async (collectionName: string) => {
    const response = await axios.post(
      `${this.apiBase}/${this.namespace}`,
      {
        createCollection: {
          name: collectionName,
        },
      },
      this.requestOptions,
    );
    return response?.data;
  };
  public findCollections = async () => {
    const response = await axios.post(
      `${this.apiBase}/${this.namespace}`,
      {
        findCollections: {},
      },
      this.requestOptions,
    );
    return response?.data;
  };

  public deleteCollection = async (collectionName: string) => {
    const response = await axios.post(
      `${this.apiBase}/${this.namespace}`,
      {
        deleteCollection: {
          name: collectionName,
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
      }
    });
  }
}
