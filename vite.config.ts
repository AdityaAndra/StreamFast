import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const tmdbKey = env.TMDB_API_KEY || '';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Local development only: mimics the /api/tmdb serverless function (api/tmdb.js)
        // so `npm run dev` works. Put TMDB_API_KEY in a .env.local file (see .env.example).
        proxy: {
          '/api/tmdb': {
            target: 'https://api.themoviedb.org',
            changeOrigin: true,
            rewrite: (requestPath) => {
              const url = new URL(requestPath, 'http://localhost');
              const tmdbPath = url.searchParams.get('path') || '';
              url.searchParams.delete('path');
              url.searchParams.set('api_key', tmdbKey);
              return `/3${tmdbPath}?${url.searchParams.toString()}`;
            },
          },
          // The other serverless functions (logos + IMDb ratings, brand logos, person extras, sign-in,
          // keep-awake ping) do more than proxy TMDB, so in `npm run dev` they're served by the live site.
          // Use `vercel dev` to run your own copies of everything in api/.
          '^/api/(logos|brands|person|login|ping)': {
            target: 'https://streamfast.vercel.app',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
