import type { DatabaseCloudProvider, DatabaseTier } from '@/src/client/types';

export interface DatabaseConfig {
  name: string,
  namespace?: string,
  cloudProvider?: DatabaseCloudProvider,
  tier: DatabaseTier,
  capacityUnits: number,
  region: string,
  user: string,
  password: string,
  dbType?: 'vector',
}

export type CreateDatabaseOptions =
  | CreateDatabaseBlockingOptions
  | CreateDatabaseAsyncOptions

export interface CreateDatabaseBlockingOptions {
  blocking?: true,
  pollInterval?: number,
}

export interface CreateDatabaseAsyncOptions {
  blocking: false,
}
