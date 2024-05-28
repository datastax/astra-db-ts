/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASTRA_DB_TOKEN: string
  readonly VITE_ASTRA_DB_ENDPOINT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
