import { DatabaseCloudProvider, DatabaseTier } from '@/src/client/types/admin/admin-common';

export interface CreateDatabaseOptions {
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
