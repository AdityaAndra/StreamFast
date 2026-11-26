<div align="center">

# 🎬 StreamFast

**A Netflix-style streaming site for movies and TV shows, built with React.**

Browse like Netflix, press Play, and watch right in the site.

[![Live site](https://img.shields.io/badge/Live-streamfast.vercel.app-E50914?style=for-the-badge&logo=vercel&logoColor=white)](https://streamfast.vercel.app)

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![TMDB](https://img.shields.io/badge/Data-TMDB-01B4E4?style=flat-square&logo=themoviedatabase&logoColor=white)

</div>

---

## ✨ What it is

StreamFast is a Netflix replica: the same dark look, billboard banner, sliding rows, hover previews, title windows and full-screen player. Everything (titles, artwork, cast, seasons, ratings) comes live from [TMDB](https://www.themoviedb.org/), and videos play through the [VidFast](https://vidfast.vc) player embedded in the page. No account and no sign-up: your lists and progress are saved in your browser.

> The site streams nothing itself and hosts no video files. It only shows public title data and embeds a third-party player.

---

## 🚀 Features

### 🏠 Browsing, the Netflix way
- **Billboard banner** with the title's logo, rating, genres and description, a slow zoom, an ambient glow taken from the artwork, and auto-rotating featured titles (with a pause button)
- **Sliding rows** with edge arrows, page dots and smooth GPU paging; native swiping on phones
- **Hover preview cards**: the card grows into a mini page with Play, My List, rating, runtime and genres
- **Top 10** rows with big outlined rank numbers, plus *Recently added* and *New episode* badges
- **Title logos and IMDb ratings** on cards, like Netflix shows them
- **Pages for everything**: Home, Movies, TV Shows, Categories, New & Popular, My Content and Browse by Languages
- **Brand pages** for studios, TV networks and streaming services (Netflix, Prime Video, Disney+, Marvel Studios, HBO…) and **franchise pages** for collections like *The Lord of the Rings*
- **Browse with filters**: type, genre, year or decade, language, rating, streaming service and sort order (popular, newest, oldest, top rated, A–Z, revenue…)
- **Smooth scrolling**, and Back always returns you to exactly where you were on the page

### 🔎 Search
- **Live search** in the top bar (press `/` or `Ctrl + K`), with recent searches
- Best matches first, then titles related to the top result, with **Movies / TV Shows / People** tabs
- Searching a person ("Christopher Nolan") shows their work first

### 🎞️ Title window
- Opens over the page you were on, like Netflix's *More Info*: trailer-style backdrop, logo, cast, genres, maturity rating and description
- **Episodes** list per season with stills, descriptions, air dates and your progress on each episode
- **More Like This**, trailers and full cast

### 👤 People
- Full **person pages**: biography, photos, known-for titles, every credit (filter by department, movie or TV, search and sort), videos from their titles, and **awards and nominations** from Wikidata

### ▶️ Player
- Full-screen, in-site player with a Netflix-style back arrow, title and episode name
- **Episodes panel** (Netflix design) to jump to any season or episode, with a *Now playing* marker
- **Server picker** to switch video source mid-episode, keeping your place; star one as your default
- **Pause screen** like Netflix: after a moment paused, the screen dims and shows *You're watching*, the logo, the episode and its description
- Our controls fade in and out together with the player's own controls
- **Resume where you left off** for movies and episodes, and **auto-play the next episode**
- Pick the player's accent colour (Netflix Red, Prime Blue, Hulu Green or any colour you like)

### 📚 Your stuff
- **Continue Watching** with progress bars, filters (All / Movies / TV) and A–Z or recent sort
- **My List** to save titles for later
- **Notifications bell**: new episodes and seasons of shows you watch, release dates of titles on your list, and what's new on StreamFast, with optional desktop alerts
- **Export and import** your lists as a file, or reset everything
- All saved only in your browser (local storage): nothing is sent to a server

### ⌨️ Accessible
- Keyboard friendly: windows close with Escape, focus stays inside open windows, rows slide to the card you Tab to, and every card and button can be reached without a mouse
- Clear focus outlines and labels for screen readers

---

## 🧱 Built with

| Part | Technology |
|---|---|
| App | React 19, TypeScript (strict), Vite |
| Styling | Tailwind CSS (built at build time), custom Netflix-style CSS |
| Data | [TMDB API](https://developer.themoviedb.org/) and [Wikidata](https://www.wikidata.org/) (person facts and awards), IMDb ratings dataset |
| Player | [VidFast](https://vidfast.vc) embed |
| Hosting | [Vercel](https://vercel.com) (static site + serverless functions) |
| Checks | GitHub Actions type check on every push |

**Security:** the TMDB API key lives only on the server, in Vercel's environment variables, and never reaches the browser. The serverless proxy only allows the TMDB endpoints and parameters the site uses. The site sends strict security headers (Content Security Policy, HSTS, no-sniff, frame and referrer policies).

---

## 🛠️ Run it yourself

1. **Get a free TMDB API key:** https://www.themoviedb.org/settings/api
2. **Clone and install**
   ~~~bash
   git clone https://github.com/AdityaAndra/StreamFast.git
   cd StreamFast
   npm install
   ~~~
3. **Add the key:** copy `.env.example` to `.env.local` and set `TMDB_API_KEY`.
4. **Start it**
   ~~~bash
   npm run dev        # http://localhost:3000
   npm run typecheck  # TypeScript check
   npm run build      # production build in dist/
   ~~~
   In `npm run dev`, `/api/tmdb` goes straight to TMDB with your key, and the other API routes are served by the live site. To run every serverless function locally, use `vercel dev` instead.

### Deploy to Vercel
1. Import the repository in Vercel (no framework preset needed; build command `npm run build`, output `dist`).
2. Project → Settings → Environment Variables → add `TMDB_API_KEY` for Production and Preview.
3. Deploy. Every push to `main` goes live; other branches get preview links.

---

## 📁 Project structure

~~~
api/
  tmdb.js          TMDB proxy (keeps the API key on the server, allow-listed paths and parameters)
  logos.js         Title logos + IMDb ratings for cards
  brands.js        Studio, network and streaming-service logos
  person.js        Person facts and awards from Wikidata
components/        Header, billboard, rows, hover preview, cards, bell, filters, dialogs…
contexts/          Continue Watching, My List and player theme (AppContext), player state
data/              VidFast server list for the player's server menu
pages/             Home, Movies, TV, Categories, New & Popular, My Content, Languages, Browse,
                   brand and franchise pages, Search, Title window, Person, Watch (player)
services/          TMDB client (with cache) and browser storage
utils/             Router, rows, browse filters, artwork and logos, search ranking, smooth scroll…
.github/workflows/ Type check on every push
index.html         App page (also moves saved lists over from the old address)
vercel.json        Rewrites and security headers
~~~

---

## ⚠️ Disclaimer

StreamFast is a personal, non-commercial project made to recreate the Netflix experience. It is not affiliated with Netflix, TMDB or VidFast. It does not host, upload or control any video content: all playback comes from a third-party embed. This product uses the TMDB API but is not endorsed or certified by TMDB.

<div align="center">

Made with ❤️ by [Aditya Andra](https://github.com/AdityaAndra) · [streamfast.vercel.app](https://streamfast.vercel.app)

</div>
