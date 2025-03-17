import type { HeadersProvider, OneOrMany } from '@/src/lib/index.js';

export type AdditionalHeaders = OneOrMany<HeadersProvider | Record<string, string | undefined>>;

export type HeadersProviderVariants = 'token' | 'embedding' | 'reranking';

export interface GetHeadersCtx {
  readonly for: 'devops-api' | 'data-api';
  readonly defaults: {
    DataAPIAuthHeader: 'Token';
    DevopsAPIAuthHeader: 'Authorization';
    DataAPIEmbeddingsAPIKeyHeader: 'x-embedding-api-key';
    DataAPIRerankingsAPIKeyHeader: 'x-rerank-api-key';
  },
}
