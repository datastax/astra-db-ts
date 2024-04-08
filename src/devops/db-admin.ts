import { AdminBlockingOptions } from '@/src/devops/types';
import { Db } from '@/src/data-api';

/**
 * Represents some DatabaseAdmin class used for managing some specific database.
 *
 * This abstract version lists the core functionalities that any database admin class may have, but
 * subclasses may have additional methods or properties (e.g. {@link AstraDbAdmin}).
 *
 * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
 *
 * @public
 */
export abstract class DbAdmin {
  /**
   * Gets the underlying `Db` object. The options for the db were set when the DbAdmin instance, or whatever spawned
   * it, was created.
   *
   * @example
   * ```typescript
   * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   *
   * const db = dbAdmin.db();
   * console.log(db.id);
   * ```
   *
   * @returns the underlying `Db` object.
   */
  abstract db(): Db;
  abstract listNamespaces(): Promise<string[]>;
  abstract createNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void>;
  abstract dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void>;
}
