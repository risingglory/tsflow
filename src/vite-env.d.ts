/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TAILSCALE_ACCESS_TOKEN: string
  readonly TAILSCALE_TAILNET: string
  readonly PROXY_TAILSCALE_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 