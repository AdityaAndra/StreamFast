# StreamFast

A Netflix-style web app for browsing and watching movies and TV shows. Title data comes from [TMDB](https://www.themoviedb.org/); videos play through the [VidFast](https://vidfast.vc) embed player.

Live site: https://streamfast.vercel.app (the old vidfast-link-generator.vercel.app address redirects here and carries saved lists over)

## Features

- **Billboard hero** with title logos, Play / My List and auto-rotating featured titles
- **Netflix-style rows** with edge arrows, page indicators and hover preview cards (match %, genres, quick actions)
- **Top 10** rows with outlined rank numbers
- **Live search** in the top bar (`/` or `Ctrl + K`), with recent searches and Movie / TV filters
- **In-site player** (VidFast embed) with Netflix-style title, back arrow, server picker and episodes panel
- **Continue Watching** with progress bars and resume, plus **My List**
- Player theme picker, import / export of your history, all stored locally in your browser

## Tech

React 19 + TypeScript + Vite, Tailwind (CDN). TMDB requests go through a Vercel serverless function (`api/tmdb.js`) so the API key stays on the server.

## Setup

1. Get a TMDB API key: https://www.themoviedb.org/settings/api
2. **Vercel:** Project → Settings → Environment Variables → add `TMDB_API_KEY` (Production and Preview).
3. **Local:** copy `.env.example` to `.env.local`, fill in `TMDB_API_KEY`, then:

```bash
npm install
npm run dev     # http://localhost:3000 (the Vite dev server proxies /api/tmdb to TMDB)
npm run build
```

## Project structure

```
api/tmdb.js          Serverless TMDB proxy (keeps the API key secret)
App.tsx              App shell, navigation, search, link handling
components/          UI: AppHeader, HeroBanner, ContentCarousel (rows), Top10Row, HoverPreview, modals…
contexts/AppContext  Continue Watching, My List, player theme, notifications
pages/               Home, Movies, TV Shows, My List, Search results
services/            tmdb.ts (API client), storage.ts (localStorage)
utils/               media helpers, recent searches
```

---

This product uses the TMDB API but is not endorsed or certified by TMDB.
