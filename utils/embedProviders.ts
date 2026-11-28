/**
 * Multi-source embed player configuration.
 *
 * StreamFast tries each provider in order and switches to the next one if the current
 * provider hasn't reported real playback (a valid "ready" signal from the embed) within
 * PROVIDER_TIMEOUT_MS. CineLite is primary: its own-source backend plays instantly and
 * reports rich progress events. The rest are third-party iframe embeds kept as fail-safes,
 * each on its own backend so one outage never takes down more than one of them.
 *
 * Every provider is free: all are plain iframes served from someone else's domain, same
 * cost (zero) as the current single-source VidFast setup. No server of our own is involved.
 */

export const PROVIDER_TIMEOUT_MS = 10000;

/** One selectable option in a track/quality list a provider pushes to us (label is theirs). */
export interface TrackOption {
  value: string;
  label: string;
}

export type ProviderMessage = {
  playing?: boolean;
  ended?: boolean;
  currentTime?: number;
  duration?: number;
  ready?: boolean;
  // Pushed by the few providers whose embed actually reports/accepts these (see `commands` below).
  volume?: number;
  muted?: boolean;
  subtitle?: string;
  subtitles?: TrackOption[];
  audio?: string;
  audios?: TrackOption[];
  quality?: string;
  /** A command we sent was refused (e.g. sent before the stream was ready). Not fatal; surfaced for logging. */
  commandError?: { command: string; field?: string; reason: string };
  /** VidRift only (fs=parent): the viewer pressed F / double-clicked and wants us to own fullscreen. */
  fullscreenRequest?: boolean;
};

export interface EmbedProvider {
  id: string;
  name: string;
  origins: string[];
  movieUrl: (tmdbId: number, opts: ProviderUrlOpts) => string;
  tvUrl: (tmdbId: number, season: number, episode: number, opts: ProviderUrlOpts) => string;
  parseMessage: (data: any) => ProviderMessage | null;
  allowSandbox: boolean;
  /** Messages our page can POST to the embed. Omit a method entirely when the provider has
   *  no documented way to do that — most don't accept anything beyond their URL options. */
  commands?: {
    /** Ask the embed to (re)send its current state once, right after it loads. */
    getState?: () => any;
    playPause?: (action: 'play' | 'pause' | 'toggle') => any;
    setState?: (patch: { volume?: number; muted?: boolean; subtitle?: string; audio?: string; quality?: string }) => any;
    /** VidRift only: relative seek (±seconds), absolute seek, and reporting our own fullscreen state. */
    skip?: (seconds: number) => any;
    seek?: (time: number) => any;
    setFullscreenState?: (on: boolean) => any;
  };
}

export interface ProviderUrlOpts {
  autoplay?: boolean;
  startAt?: number;
  theme?: string;
}

const qs = (params: Record<string, string | number | boolean | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

// Every VidRift native control our own overlay replaces (see WatchPage's "vidrift" block): nothing
// of its own chrome is left on screen once this takes effect.
const VIDRIFT_HIDE = 'progress,play,volume,skip,time,title,server,next,episodes,subtitles,settings,lock,pip,cast,fullscreen,gradient,pausecard';

const CineLite: EmbedProvider = {
  id: 'cinelite',
  name: 'CineLite',
  origins: ['https://embed.cinelite.xyz'],
  movieUrl: (id, o) => `https://embed.cinelite.xyz/${id}?${qs({ t: o.startAt, color: o.theme, ui: 'channel' })}`,
  tvUrl: (id, s, e, o) => `https://embed.cinelite.xyz/${id}/${s}/${e}?${qs({ t: o.startAt, color: o.theme, ui: 'channel' })}`,
  parseMessage: (d) => {
    if (!d || typeof d !== 'object') return null;
    if (d.type === 'CINELITE_PLAYBACK_PROGRESS') {
      const p = d.payload || {};
      return { ready: true, currentTime: p.currentTime, duration: p.duration, ended: !!p.completed };
    }
    if (d.type === 'CINELITE_PLAYER_STATE') return { ready: true, playing: !!d.payload?.playing };
    return null;
  },
  allowSandbox: true,
  commands: {
    // Channel-mode (ui=channel, set in the URL above) listens for play/pause/toggle from our buttons.
    playPause: (action) => ({ type: 'CINELITE_CMD', action }),
    // CineLite only takes quality from us; it has no inbound volume/subtitle/audio message.
    setState: (patch) => (patch.quality ? { type: 'CINELITE_SYNC_SETTINGS', preferredQuality: patch.quality } : null),
  },
};

const VidFast: EmbedProvider = {
  id: 'vidfast',
  name: 'VidFast',
  origins: [
    'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io', 'https://vidfast.me',
    'https://vidfast.net', 'https://vidfast.pm', 'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz',
  ],
  movieUrl: (id, o) => `https://vidfast.vc/movie/${id}?${qs({ theme: o.theme, autoPlay: o.autoplay, startAt: o.startAt, title: false, hideServer: true })}`,
  tvUrl: (id, s, e, o) => `https://vidfast.vc/tv/${id}/${s}/${e}?${qs({ theme: o.theme, autoPlay: o.autoplay, startAt: o.startAt, title: false, hideServer: true, nextButton: true, autoNext: true })}`,
  parseMessage: (d) => {
    if (!d || typeof d !== 'object') return null;
    if (d.type === 'PLAYER_EVENT') {
      const p = d.data || {};
      return { ready: typeof p.duration === 'number' && p.duration > 0, playing: p.playing, currentTime: p.currentTime, duration: p.duration, ended: p.event === 'ended' };
    }
    if (d.type === 'MEDIA_DATA') return { ready: true };
    return null;
  },
  allowSandbox: true,
};

const Cinezo: EmbedProvider = {
  id: 'cinezo',
  name: 'Cinezo',
  origins: ['https://player.cinezo.live'],
  movieUrl: (id, o) => `https://player.cinezo.live/embed/movie/${id}?${qs({ autoplay: o.autoplay, primarycolor: o.theme, t: o.startAt })}`,
  tvUrl: (id, s, e, o) => `https://player.cinezo.live/embed/tv/${id}/${s}/${e}?${qs({ autoplay: o.autoplay, primarycolor: o.theme, t: o.startAt })}`,
  parseMessage: (d) => {
    if (!d || typeof d !== 'object') return null;
    if (d.type === 'PLAYER_EVENT') {
      const p = d.data || {};
      return { ready: typeof p.duration === 'number' && p.duration > 0, currentTime: p.currentTime, duration: p.duration, ended: p.event === 'ended', playing: p.event === 'play' ? true : p.event === 'pause' ? false : undefined };
    }
    if (d.type === 'MEDIA_DATA') return { ready: true };
    return null;
  },
  allowSandbox: true,
};

const Vidora: EmbedProvider = {
  id: 'vidora',
  name: 'Vidora',
  origins: ['https://vidora.ac'],
  movieUrl: (id, o) => `https://vidora.ac/movie/${id}?${qs({ autoplay: o.autoplay, t: o.startAt, primaryColor: o.theme })}`,
  tvUrl: (id, s, e, o) => `https://vidora.ac/tv/${id}/${s}/${e}?${qs({ autoplay: o.autoplay, t: o.startAt, primaryColor: o.theme })}`,
  parseMessage: () => null,
  allowSandbox: true,
};

const VidRift: EmbedProvider = {
  id: 'vidrift',
  name: 'VidRift',
  origins: ['https://embed.vidrift.net'],
  // hide=... removes VidRift's whole native bar/pause card — our own overlay (scrubber, play/pause,
  // skip, volume, time, subtitles, audio, fullscreen) replaces every one of these. fs=parent hands
  // fullscreen to our page too (see the WatchPage fullscreenchange effect and vidrift:fullscreen below).
  movieUrl: (id, o) =>
    `https://embed.vidrift.net/embed/movie/${id}?${qs({ autoplay: o.autoplay ? 1 : undefined, t: o.startAt, brandColor: o.theme, hide: VIDRIFT_HIDE, fs: 'parent' })}`,
  tvUrl: (id, s, e, o) =>
    `https://embed.vidrift.net/embed/tv/${id}/${s}/${e}?${qs({ autoplay: o.autoplay ? 1 : undefined, t: o.startAt, brandColor: o.theme, hide: VIDRIFT_HIDE, fs: 'parent' })}`,
  // VidRift's real message is `vidrift:state` (resent whenever anything in it changes),
  // `vidrift:command-error`, and — because of fs=parent above — `vidrift:fullscreen` when the
  // viewer presses F or double-clicks (there is no native button left for them to click instead).
  parseMessage: (d) => {
    if (!d || typeof d !== 'object' || typeof d.type !== 'string' || !d.type.startsWith('vidrift:')) return null;
    if (d.type === 'vidrift:state') {
      return {
        ready: true,
        playing: typeof d.paused === 'boolean' ? !d.paused : undefined,
        currentTime: d.currentTime,
        duration: d.duration,
        ended: typeof d.currentTime === 'number' && typeof d.duration === 'number' && d.duration > 0 && d.currentTime >= d.duration - 0.5,
        volume: d.volume,
        muted: d.muted,
        subtitle: d.subtitle,
        subtitles: d.subtitles,
        audio: d.audio,
        audios: d.audios,
        quality: d.quality,
      };
    }
    if (d.type === 'vidrift:command-error') return { commandError: { command: d.command, field: d.field, reason: d.reason } };
    if (d.type === 'vidrift:fullscreen') return { fullscreenRequest: !!d.on };
    return null;
  },
  allowSandbox: false,
  commands: {
    getState: () => ({ type: 'vidrift:get-state' }),
    playPause: (action) => (action === 'pause' ? { type: 'vidrift:pause' } : action === 'play' ? { type: 'vidrift:play' } : null),
    setState: (patch) => {
      const { quality, ...rest } = patch; // VidRift takes quality too, but it's outside this task's scope
      return Object.keys(rest).length ? { type: 'vidrift:set', ...rest } : null;
    },
    // Full custom bar extras: relative ±seconds skip, absolute seek (resume), and echoing our own
    // fullscreen state back so the player (fs=parent) always agrees with what our page is doing.
    skip: (seconds) => ({ type: 'vidrift:skip', seconds }),
    seek: (time) => ({ type: 'vidrift:resume', currentTime: time }),
    setFullscreenState: (on) => ({ type: 'vidrift:fullscreen-state', on }),
  },
};

const VidZee: EmbedProvider = {
  id: 'vidzee',
  name: 'VidZee',
  origins: ['https://player.vidzee.wtf'],
  movieUrl: (id, o) => `https://player.vidzee.wtf/embed/movie/${id}?${qs({ autoplay: o.autoplay, t: o.startAt })}`,
  tvUrl: (id, s, e, o) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}?${qs({ autoplay: o.autoplay, t: o.startAt })}`,
  parseMessage: (d) => (d && d.type === 'MEDIA_DATA' ? { ready: true } : null),
  allowSandbox: true,
};

const VidRock: EmbedProvider = {
  id: 'vidrock',
  name: 'VidRock',
  origins: ['https://vidrock.net'],
  movieUrl: (id, o) => `https://vidrock.net/movie/${id}?${qs({ autoplay: o.autoplay, theme: o.theme })}`,
  tvUrl: (id, s, e, o) => `https://vidrock.net/tv/${id}/${s}/${e}?${qs({ autoplay: o.autoplay, theme: o.theme })}`,
  parseMessage: (d) => {
    if (!d || typeof d !== 'object') return null;
    if (d.type === 'PLAYER_EVENT') {
      const p = d.data || {};
      return { ready: typeof p.duration === 'number' && p.duration > 0, currentTime: p.currentTime, duration: p.duration };
    }
    if (d.type === 'MEDIA_DATA') return { ready: true };
    return null;
  },
  allowSandbox: true,
};

export const PROVIDERS: EmbedProvider[] = [CineLite, VidFast, Cinezo, Vidora, VidRift, VidZee, VidRock];

export const findProvider = (id: string) => PROVIDERS.find((p) => p.id === id);
