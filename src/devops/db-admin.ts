import { AdminBlockingOptions } from '@/src/devops/types';
import { Db } from '@/src/data-api';

export abstract class DbAdmin {
  abstract db(): Db;
  abstract listNamespaces(): Promise<string[]>;
  abstract createNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void>;
  abstract dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void>;
}
