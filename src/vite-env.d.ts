/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_MAX_RESULTS: string
  readonly VITE_REGION_CODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
