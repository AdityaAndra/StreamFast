# VidFast Link Generator

A Netflix-style web app for browsing movies and TV shows (data from [TMDB](https://www.themoviedb.org/)) and instantly generating embeddable [VidFast](https://vidfast.pro) streaming links.

Live site: https://vidfast-link-generator.vercel.app

## Features

- **Billboard hero** with title logos, Play / My List and auto-rotating featured titles
- **Netflix-style rows** with edge arrows, page indicators and hover preview cards (match %, genres, quick actions)
- **Top 10** rows with outlined rank numbers
- **Live search** in the top bar (`/` or `Ctrl + K`), with recent searches and Movie / TV filters
- **Continue Watching** with progress bars, **My List**, and paste-a-link to add or update progress
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
