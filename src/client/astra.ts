import { withoutFields } from '@/src/client/utils';
import { Client } from '@/src/client/client';
import { DEFAULT_NAMESPACE } from '@/src/api';

/**
 * The options for the AstraDB client
 */
export interface AstraDBOptions {
  /**
   * The base API path for the AstraDB instance
   *
   * Should have no leading or trailing slashes
   *
   * @default 'api/json/v1'
   */
  baseApiPath?: string,
  /**
   * A winston log level (error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6)
   *
   * @default process.env.NODE_ENV === 'production' ? 'error' : 'info'
   */
  logLevel?: string,
  /**
   * Whether to log skipped options (logs as 'warn')
   *
   * Logs when a command is executed with options that are not supported by the client
   *
   * @example
   * ```typescript
   * // Logs a warning 'findOne' does not support option 'unknownOption'
   * await findOne({}, { unknownOption: 'value' });
   * ```
   *
   * @default false
   */
  logSkippedOptions?: boolean,
  /**
   * Whether to use HTTP2. Defaults to true.
   *
   * If set to false, HTTP1 will be used.
   *
   * Both versions should be interchangeable, but HTTP2 is recommended for better performance.
   *
   * Errors may be different between the two versions as well, due to different implementations.
   *
   * @default true
   */
  useHttp2?: boolean,
}

/**
 * The high level client to interact with AstraDB
 */
export class AstraDB extends Client {
  /**
   * Create a new AstraDB client with namespace `default_keyspace`
   *
   * @example
   * ```typescript
   * using client = new AstraDB(
   *   '<application-token>',
   *   'https://<db-id>-<region>.apps.astra.datastax.com',
   * );
   * ```
   *
   * @param token The application token
   * @param endpoint The endpoint of the AstraDB instance
   * @param options The options for the client
   */
  constructor(token: string, endpoint: string, options?: AstraDBOptions)

  /**
   * Create a new AstraDB client with a specific namespace (keyspace)
   *
   * @example
   * ```typescript
   * using client = new AstraDB(
   *   '<application-token>',
   *   'https://<db-id>-<region>.apps.astra.datastax.com',
   *   'my_keyspace',
   * );
   * ```
   *
   * @param token The application token
   * @param endpoint The endpoint of the AstraDB instance
   * @param namespace The namespace (keyspace) to use
   * @param options The options for the client
   */
  constructor(token: string, endpoint: string, namespace?: string, options?: AstraDBOptions)

  constructor(token: string, endpoint: string, namespaceOrOptions?: AstraDBOptions | string, maybeOptions?: AstraDBOptions) {
    const namespace = (typeof namespaceOrOptions === 'string')
      ? namespaceOrOptions
      : DEFAULT_NAMESPACE;

    if (!namespace.match(/^[a-zA-Z0-9_]{1,48}$/)) {
      throw new Error('Invalid namespace format; either pass a valid namespace name, or don\'t pass one at all to use the default namespace');
    }

    const options = (typeof namespaceOrOptions === 'string')
      ? maybeOptions
      : namespaceOrOptions;

    super(endpoint, namespace, {
      ...withoutFields(options, 'namespace'),
      baseApiPath: options?.baseApiPath ?? 'api/json/v1',
      applicationToken: token,
    });
  }
}
