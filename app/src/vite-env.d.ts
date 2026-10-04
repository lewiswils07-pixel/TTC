/// <reference types="vite/client" />

// Colour variables generated from brand.json (see brand.plugin.ts).
declare module 'virtual:brand.css'

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}
