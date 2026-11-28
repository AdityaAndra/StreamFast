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

export type ProviderMessage = {
  playing?: boolean;
  ended?: boolean;
  currentTime?: number;
  duration?: number;
  ready?: boolean;
};

export interface EmbedProvider {
  id: string;
  name: string;
  origins: string[];
  movieUrl: (tmdbId: number, opts: ProviderUrlOpts) => string;
  tvUrl: (tmdbId: number, season: number, episode: number, opts: ProviderUrlOpts) => string;
  parseMessage: (data: any) => ProviderMessage | null;
  allowSandbox: boolean;
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
  movieUrl: (id, o) => `https://embed.vidrift.net/embed/movie/${id}?${qs({ autoplay: o.autoplay ? 1 : undefined, t: o.startAt, brandColor: o.theme })}`,
  tvUrl: (id, s, e, o) => `https://embed.vidrift.net/embed/tv/${id}/${s}/${e}?${qs({ autoplay: o.autoplay ? 1 : undefined, t: o.startAt, brandColor: o.theme })}`,
  parseMessage: (d) => {
    if (!d || typeof d !== 'object' || typeof d.type !== 'string' || !d.type.startsWith('vidrift:')) return null;
    if (d.type === 'vidrift:progress') return { ready: true, currentTime: d.currentTime, duration: d.duration };
    if (d.type === 'vidrift:ended') return { ready: true, ended: true };
    if (d.type === 'vidrift:ui-hidden' || d.type === 'vidrift:providers') return { ready: true };
    return { ready: true };
  },
  allowSandbox: false,
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
