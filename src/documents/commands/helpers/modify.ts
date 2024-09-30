import { SomeDoc } from '@/src/documents';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { nullish } from '@/src/lib';

export const runFindOneAnd = async (httpClient: DataAPIHttpClient, command: SomeDoc, options: SomeDoc | nullish) => {
  const resp = await httpClient.executeCommand(command, options);
  const document = resp.data?.document || null;

  return (options?.includeResultMetadata)
    ? {
      value: document,
      ok: 1,
    }
    : document;
};
