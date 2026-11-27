<div align="center">

<p>
  <a href="https://streamfast.vercel.app">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/logo.svg">
      <img src="public/logo-light.svg" alt="StreamFast" width="360">
    </picture>
  </a>
</p>
<br>

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

StreamFast is a Netflix replica: the same dark look, billboard banner, sliding rows, hover previews, title windows and full-screen player. Everything (titles, artwork, cast, seasons, ratings) comes live from [TMDB](https://www.themoviedb.org/), and videos play through the [VidFast](https://vidfast.vc) player embedded in the page. No account needed: your lists and progress are saved in your browser. Create a free account if you want them on all your devices.

> The site streams nothing itself and hosts no video files. It only shows public title data and embeds a third-party player.

---

## 🚀 Features

### 🏠 Browsing, the Netflix way
- **Billboard banner** with the title's logo, rating, genres and description, a slow zoom, an ambient glow taken from the artwork, and auto-rotating featured titles (with a pause button)
- **Sliding rows** with edge arrows, page dots and smooth GPU paging; native swiping on phones
- **Hover preview cards**: the card grows into a mini page with Play, My List, rating, runtime and genres, and after a second the title's trailer starts playing in it (muted, with a sound button)
- **Trailer previews** like Netflix: the billboard fades from the artwork into the muted trailer after a moment (sound and replay buttons), and pauses when you scroll away, open a title or switch tabs. Turn **Autoplay previews** on or off in the account menu or on My Content
- **Top 10** rows with big outlined rank numbers, plus *Recently added* and *New episode* badges
- **Title logos and IMDb ratings** on cards, like Netflix shows them
- **Pages for everything**: Home, Movies, TV Shows, Categories, New & Popular, My Content and Browse by Languages
- **Brand pages** for studios, TV networks and streaming services (Netflix, Prime Video, Disney+, Marvel Studios, HBO…) and **franchise pages** for collections like *The Lord of the Rings*, shown with each franchise's own logo
- **Browse with filters**: type, genre, year or decade, language, rating, streaming service and sort order (popular, newest, oldest, top rated, A–Z, revenue…)
- **Smooth scrolling**, and Back always returns you to exactly where you were on the page

### 🔎 Search
- **Live search** in the top bar (press `/` or `Ctrl + K`), with recent searches
- Best matches first, then titles related to the top result, with **Movies / TV Shows / People** tabs
- Searching a person ("Christopher Nolan") shows their work first

### 🎞️ Title window
- Opens over the page you were on, like Netflix's *More Info*: the trailer plays behind the logo and buttons (muted, with sound and replay buttons), plus cast, genres, maturity rating and description
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
- Saved in your browser (local storage) — and, if you sign in, synced to your account

### 🔐 Accounts & sync (optional)
- **Sign in with your username or your email** (Netflix-style Sign In / Sign Up pages, show/hide password, *Forgot password?* email link)
- **What syncs:** Continue Watching progress, My List, player theme, default server, recent searches, notification read marks (and the desktop-alerts switch) and your streaming region
- Changes upload a moment after you make them, and other devices catch up when you switch back to their tab. Lists are merged (the newest copy of each title wins, removals stick); settings follow your latest change
- Signing out stops syncing but keeps everything on that device; signing in on a new device brings everything over
- Usernames are turned into the account's email on the server (`/api/login`), so emails are never shown to anyone
- Without the Supabase settings, accounts simply don't appear and the site works exactly as before

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
| Accounts & sync | [Supabase](https://supabase.com) (Auth + Postgres with row-level security) |
| Checks | GitHub Actions type check on every push, and an hourly keep-awake check |

**Security:** the TMDB API key and the Supabase secret key live only on the server, in Vercel's environment variables, and never reach the browser. Every synced row is protected by row-level security (each account can only read and write its own data). The serverless proxy only allows the TMDB endpoints and parameters the site uses. The site sends strict security headers (Content Security Policy, HSTS, no-sniff, frame and referrer policies).

---

## 🛠️ Run it yourself

1. **Get a free TMDB API key:** https://www.themoviedb.org/settings/api
2. **Clone and install**
   ~~~bash
   git clone https://github.com/AdityaAndra/StreamFast.git
   cd StreamFast
   npm install
   ~~~
3. **Add the key:** copy `.env.example` to `.env.local` and set `TMDB_API_KEY` (and the Supabase values if you want accounts; see below).
4. **Start it**
   ~~~bash
   npm run dev        # http://localhost:3000
   npm run typecheck  # TypeScript check
   npm run build      # production build in dist/
   ~~~
   In `npm run dev`, `/api/tmdb` goes straight to TMDB with your key, and the other API routes are served by the live site. To run every serverless function locally, use `vercel dev` instead.

### Deploy to Vercel
1. Import the repository in Vercel (no framework preset needed; build command `npm run build`, output `dist`).
2. Project → Settings → Environment Variables → add the variables below for Production and Preview.
3. Deploy. Every push to `main` goes live; other branches get preview links.

| Variable | Where it's used | Secret? |
|---|---|---|
| `TMDB_API_KEY` | `api/*` (TMDB proxy, logos, brands, people) | Yes, server only |
| `VITE_SUPABASE_URL` | Browser + `api/login`, `api/ping` (`https://<project-ref>.supabase.co`) | No (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + `api/login` (`sb_publishable_…`) | No (public by design; access is limited by row-level security) |
| `SUPABASE_SECRET_KEY` | `api/login` (username → email lookup) and `api/ping` only (`sb_secret_…`) | **Yes — never give it a `VITE_` prefix or put it in client code** |

The `VITE_` values are baked into the build, so redeploy after changing them. Leave the three Supabase variables out and the site runs without accounts.

### Accounts & sync setup (Supabase)
- Database: tables `profiles` (username, display name), `user_data` (one row per account per synced item: `progress`, `my_list`, `theme`, `default_server`, `recent_searches`, `notifications` (also carries the desktop-alerts and autoplay-previews switches), `region`) and `heartbeat`, all with row-level security, plus the `username_available` check.
- Authentication → URL Configuration: set **Site URL** to `https://streamfast.vercel.app` and add `https://streamfast.vercel.app/reset-password` (plus `http://localhost:3000/reset-password` for local testing) to **Redirect URLs**, so password-reset links land on the site.
- Password-reset emails use Supabase's built-in mailer unless you add your own SMTP server (Authentication → Emails). The built-in one is heavily rate-limited and may only deliver to your project team's addresses, so set up custom SMTP before relying on password resets.

### Keep-awake check
Free Supabase projects pause after a week without activity. `.github/workflows/keep-awake.yml` runs every hour: it calls `/api/ping` (which writes a heartbeat row) and, if the site doesn't answer, touches the database directly with the public key. If the database can't be reached the run fails, GitHub emails you, and the run summary links to the Supabase dashboard (click **Restore**). Run it by hand from the Actions tab with **test_alert** ticked to check that the email reaches you.

---

## 📁 Project structure

~~~
api/
  tmdb.js          TMDB proxy (keeps the API key on the server, allow-listed paths and parameters)
  logos.js         Title logos + IMDb ratings for cards
  brands.js        Studio, network and streaming-service logos
  person.js        Person facts and awards from Wikidata
  login.js         Sign in with username or email (looks the email up on the server)
  ping.js          Keep-awake heartbeat for the database
components/        Header, billboard, rows, hover preview, cards, bell, filters, dialogs…
contexts/          Continue Watching, My List and player theme (AppContext), accounts (AuthContext), player state
data/              VidFast server list for the player's server menu
pages/             Home, Movies, TV, Categories, New & Popular, My Content, Languages, Browse,
                   brand and franchise pages, Search, Title window, Person, Watch (player),
                   Sign In, Sign Up, Forgot / Reset password
services/          TMDB client (with cache), browser storage, Supabase client and cloud sync
utils/             Router, rows, browse filters, artwork and logos, search ranking, smooth scroll…
.github/workflows/ Type check on every push, hourly keep-awake check
index.html         App page (also moves saved lists over from the old address)
vercel.json        Rewrites and security headers
~~~

---

## ⚠️ Disclaimer

StreamFast is a personal, non-commercial project made to recreate the Netflix experience. It is not affiliated with Netflix, TMDB or VidFast. It does not host, upload or control any video content: all playback comes from a third-party embed. This product uses the TMDB API but is not endorsed or certified by TMDB.

<div align="center">

Made with ❤️ by [Aditya Andra](https://github.com/AdityaAndra) · [streamfast.vercel.app](https://streamfast.vercel.app)

</div>
