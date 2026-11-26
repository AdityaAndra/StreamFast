/// <reference types="vite/client" />

// Public build-time settings (Vercel env vars, or .env.local for `npm run dev`).
// Only VITE_* variables reach the browser; server secrets stay in the serverless functions (api/).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
