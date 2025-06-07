/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TAILSCALE_API_KEY: string
  readonly VITE_TAILSCALE_TAILNET: string
  readonly VITE_TAILSCALE_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 