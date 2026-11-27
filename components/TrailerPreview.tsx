import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isScrolling } from '../utils/smoothScroll';
import { useAutoplayPreviews } from '../utils/previews';

/**
 * Muted trailer preview drawn over a picture (billboard, hover card, title window), Netflix-style.
 *
 * A plain youtube-nocookie embed (no YouTube script, so the CSP stays as it is), driven with
 * postMessage: we say "listening" once it loads, then YouTube reports its state (playing, ended,
 * errors) and takes commands (mute, unMute, playVideo, pauseVideo).
 * The video is drawn larger than its box and centred, so it always covers it (no black bars) and
 * YouTube's own title bar and logo sit outside the visible area. It never takes the pointer.
 * It fades in only once it is really playing, and fades back out (to the picture under it) when it
 * pauses, ends (a moment before the end, skipping end cards) or fails.
 *
 * Give it a new React key to play it again from the start.
 */

export type TrailerPhase = 'loading' | 'playing' | 'ended' | 'error';

const YT_ORIGIN = 'https://www.youtube-nocookie.com';
const YT_ORIGIN_RE = /^https:\/\/www\.youtube(-nocookie)?\.com$/;
/** No picture after this long (while it's meant to play): give up and keep the backdrop. */
const START_TIMEOUT_MS = 10000;
/** Fade in only after it has played this long: YouTube shows its own title bar and centre buttons
 *  (pause, skip, "More videos") for the first moments of playback, even with controls off. They hide
 *  by themselves after ~3s, so until then the picture stays on top and you only ever see clean video. */
const SHOW_AFTER_MS = 3200;
/** A short buffering stall doesn't hide the video (only a real pause / wait does). */
const HIDE_AFTER_STALL_MS = 700;
/** Stop this many seconds before the end (trailers often end on black or end cards). */
const END_EARLY_S = 1.2;
/** A pause right after unMute means the browser refused sound without a click: go back to muted. */
const SOUND_BLOCK_MS = 2000;

let frameSeq = 0;

interface TrailerFrameProps {
  videoKey: string;
  /** false = paused and faded out (scrolled away, a dialog on top, the tab hidden, closing). */
  play: boolean;
  muted: boolean;
  onPhase?: (phase: TrailerPhase) => void;
  /** The browser didn't allow sound (no click on the page yet): the preview went back to muted. */
  onSoundBlocked?: () => void;
  /** How much bigger than its box the video is drawn. */
  zoom?: number;
  className?: string;
  title?: string;
}

export const TrailerFrame: React.FC<TrailerFrameProps> = ({ videoKey, play, muted, onPhase, onSoundBlocked, zoom = 1.35, className = '', title = 'Trailer' }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [phase, setPhaseState] = useState<TrailerPhase>('loading');
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const phaseRef = useRef<TrailerPhase>('loading');
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;
  const onBlockedRef = useRef(onSoundBlocked);
  onBlockedRef.current = onSoundBlocked;
  const playRef = useRef(play);
  playRef.current = play;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const idRef = useRef(0);
  if (!idRef.current) idRef.current = ++frameSeq;
  const readyRef = useRef(false);
  const listenTimer = useRef(0);
  const showTimer = useRef(0);
  const durationRef = useRef(0);
  const unmutedAt = useRef(0);
  const stallTimer = useRef(0);
  // Paused or buffering for a moment: YouTube shows its buttons again, so the picture covers it until it plays on.
  const [stalled, setStalled] = useState(false);
  const stalledRef = useRef(false);
  const unstallTimer = useRef(0);
  const markStalled = useCallback((v: boolean) => {
    stalledRef.current = v;
    setStalled(v);
  }, []);

  const src = useMemo(() => {
    const p = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      controls: '0',
      playsinline: '1',
      modestbranding: '1',
      rel: '0',
      iv_load_policy: '3',
      enablejsapi: '1',
      disablekb: '1',
      fs: '0',
      cc_load_policy: '0',
      cc_lang_pref: 'en',
      origin: window.location.origin,
    });
    return `${YT_ORIGIN}/embed/${encodeURIComponent(videoKey)}?${p.toString()}`;
  }, [videoKey]);

  // ended and error are final (a replay mounts a new frame).
  const setPhase = useCallback((p: TrailerPhase) => {
    const cur = phaseRef.current;
    if (cur === p || cur === 'ended' || cur === 'error') return;
    phaseRef.current = p;
    setPhaseState(p);
    onPhaseRef.current?.(p);
  }, []);

  const post = useCallback((func: string, args: unknown[] = []) => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    try {
      w.postMessage(JSON.stringify({ event: 'command', func, args, id: idRef.current, channel: 'widget' }), YT_ORIGIN);
    } catch {
      /* frame gone */
    }
  }, []);

  useEffect(() => {
    onPhaseRef.current?.('loading');
    return () => {
      window.clearInterval(listenTimer.current);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(stallTimer.current);
      window.clearTimeout(unstallTimer.current);
    };
  }, []);

  // Cover the box at any shape: 16:9, at least as wide and as tall as the box, times zoom.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const finish = useCallback(() => {
    window.clearTimeout(showTimer.current);
    post('pauseVideo');
    setPhase('ended');
  }, [post, setPhase]);

  // Messages from YouTube (only from our own frame).
  useEffect(() => {
    const onState = (state: number) => {
      if (state === 1) {
        window.clearTimeout(stallTimer.current);
        stallTimer.current = 0;
        // Back from a pause / buffering: give YouTube's buttons a moment to hide again before showing.
        if (stalledRef.current && !unstallTimer.current) {
          unstallTimer.current = window.setTimeout(() => {
            unstallTimer.current = 0;
            markStalled(false);
          }, 1500);
        }
        if (!playRef.current) {
          post('pauseVideo');
          return;
        }
        if (phaseRef.current === 'loading' && !showTimer.current) {
          post('unloadModule', ['captions']);
          post('unloadModule', ['cc']);
          showTimer.current = window.setTimeout(() => {
            showTimer.current = 0;
            setPhase('playing');
            if (!mutedRef.current) {
              unmutedAt.current = Date.now();
              post('unMute');
            }
          }, SHOW_AFTER_MS);
        }
      } else if (state === 0) {
        finish();
      } else if (state === 3 || state === 2) {
        window.clearTimeout(unstallTimer.current);
        unstallTimer.current = 0;
        if (!stallTimer.current) {
          stallTimer.current = window.setTimeout(() => {
            stallTimer.current = 0;
            markStalled(true);
          }, state === 2 ? 0 : HIDE_AFTER_STALL_MS);
        }
      }
      if (state === 2) {
        // The browser paused it when we turned the sound on: play on, muted.
        if (playRef.current && phaseRef.current === 'playing' && !mutedRef.current && Date.now() - unmutedAt.current < SOUND_BLOCK_MS) {
          post('mute');
          post('playVideo');
          onBlockedRef.current?.();
        }
      }
    };

    const onMessage = (e: MessageEvent) => {
      const w = frameRef.current?.contentWindow;
      if (!w || e.source !== w || !YT_ORIGIN_RE.test(e.origin)) return;
      let msg: unknown = e.data;
      if (typeof msg === 'string') {
        try {
          msg = JSON.parse(msg);
        } catch {
          return;
        }
      }
      if (!msg || typeof msg !== 'object') return;
      const { event, info } = msg as { event?: unknown; info?: unknown };

      if (!readyRef.current) {
        // YouTube heard us: subscribe to its events and apply what we want right now.
        readyRef.current = true;
        window.clearInterval(listenTimer.current);
        post('addEventListener', ['onStateChange']);
        post('addEventListener', ['onError']);
        post('mute');
        // No subtitles in previews (YouTube shows them if your YouTube account has captions on).
        post('unloadModule', ['captions']);
        post('unloadModule', ['cc']);
        if (!playRef.current) post('pauseVideo');
      }

      if (event === 'onError') {
        window.clearTimeout(showTimer.current);
        setPhase('error');
        return;
      }
      let state: number | undefined;
      let time: number | undefined;
      if (event === 'onStateChange' && typeof info === 'number') state = info;
      if ((event === 'infoDelivery' || event === 'initialDelivery') && info && typeof info === 'object') {
        const i = info as { playerState?: unknown; currentTime?: unknown; duration?: unknown };
        if (typeof i.playerState === 'number') state = i.playerState;
        if (typeof i.currentTime === 'number') time = i.currentTime;
        if (typeof i.duration === 'number' && i.duration > 0) durationRef.current = i.duration;
      }
      if (state !== undefined) onState(state);
      const dur = durationRef.current;
      if (time !== undefined && dur > END_EARLY_S * 4 && time >= dur - END_EARLY_S && phaseRef.current === 'playing') finish();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, setPhase, finish, markStalled]);

  // Say "listening" until YouTube answers (that's what its own script does).
  const onLoad = () => {
    window.clearInterval(listenTimer.current);
    let tries = 0;
    const hello = () => {
      const w = frameRef.current?.contentWindow;
      if (!w || readyRef.current || ++tries > 40) {
        window.clearInterval(listenTimer.current);
        return;
      }
      try {
        w.postMessage(JSON.stringify({ event: 'listening', id: idRef.current, channel: 'widget' }), YT_ORIGIN);
      } catch {
        /* ignore */
      }
    };
    hello();
    listenTimer.current = window.setInterval(hello, 250);
  };

  // Pause / resume (never restarts a finished one).
  useEffect(() => {
    if (!readyRef.current || phaseRef.current === 'ended' || phaseRef.current === 'error') return;
    post(play ? 'playVideo' : 'pauseVideo');
  }, [play, post]);

  // Sound on / off.
  useEffect(() => {
    if (!readyRef.current || phaseRef.current !== 'playing') return;
    if (muted) post('mute');
    else {
      unmutedAt.current = Date.now();
      post('unMute');
    }
  }, [muted, post]);

  // Never started (blocked embed, no connection, ad blocker): keep the picture.
  useEffect(() => {
    if (phase !== 'loading' || !play) return;
    const t = window.setTimeout(() => setPhase('error'), START_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, play, setPhase]);

  if (phase === 'error') return null;
  const on = phase === 'playing' && play && !stalled;
  let frameStyle: React.CSSProperties | undefined;
  if (size && size.w > 0 && size.h > 0) {
    const w = Math.max(size.w, (size.h * 16) / 9) * zoom;
    frameStyle = { width: Math.ceil(w), height: Math.ceil((w * 9) / 16) };
  }

  return (
    <div ref={boxRef} className={`sf-trailer ${on ? 'is-on' : ''} ${className}`} aria-hidden="true">
      {frameStyle && (
        <iframe
          ref={frameRef}
          src={src}
          title={title}
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={onLoad}
          style={frameStyle}
        />
      )}
    </div>
  );
};

/* ---------- arming (wait a moment before a preview starts) ---------- */

/**
 * True once `when` has held for `delayMs` for this `key` (and stays true until the key changes).
 * It waits for the page to stop scrolling before starting a video (loading one is heavy work).
 */
export const useArmAfter = (key: string | null, delayMs: number, when: boolean): boolean => {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!key || !when || armed === key) return;
    let t = 0;
    const tick = () => {
      if (isScrolling()) {
        t = window.setTimeout(tick, 200);
        return;
      }
      setArmed(key);
    };
    t = window.setTimeout(tick, delayMs);
    return () => window.clearTimeout(t);
  }, [key, when, armed, delayMs]);
  return !!key && armed === key;
};

/* ---------- controls ---------- */

const SpeakerIcon: React.FC<{ muted: boolean }> = ({ muted }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M11 4.6 6.4 8.6H3.2v6.8h3.2l4.6 4z" fill="currentColor" />
    {muted ? (
      <path d="m15.2 9.4 5.2 5.2m0-5.2-5.2 5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M14.8 9.2a4 4 0 0 1 0 5.6M17.6 6.4a8 8 0 0 1 0 11.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    )}
  </svg>
);

const ReplayIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 4.5v5h5" />
    <path d="M4.6 14.5a8 8 0 1 0 1.9-8.3L3.5 9.5" />
  </svg>
);

/** Netflix's round speaker button (sound on / off). */
export const PreviewSoundButton: React.FC<{ muted: boolean; onToggle: () => void; className?: string }> = ({ muted, onToggle, className = '' }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className={`sf-sound-btn ${className}`}
    aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
  >
    <SpeakerIcon muted={muted} />
  </button>
);

/** Play the preview again (shown once it has ended). */
export const PreviewReplayButton: React.FC<{ onReplay: () => void; className?: string }> = ({ onReplay, className = '' }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onReplay();
    }}
    className={`sf-sound-btn ${className}`}
    aria-label="Replay preview"
  >
    <ReplayIcon />
  </button>
);

/* ---------- "Autoplay previews" setting ---------- */

/** The on / off pill (same look as the notifications' desktop alerts switch). Decorative. */
export const SwitchKnob: React.FC<{ on: boolean }> = ({ on }) => (
  <span aria-hidden="true" className={`relative block h-[22px] w-[40px] flex-shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-netflix-red' : 'bg-[#4d4d4d]'}`}>
    <span className={`absolute left-0 top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-out-expo ${on ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
  </span>
);

export const PreviewsIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none" />
  </svg>
);

/** "Autoplay previews" switch (My Content page). */
export const AutoplayPreviewsSwitch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [on, setOn] = useAutoplayPreviews();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      className={`nf-btn nf-btn-grey !gap-3 !px-4 !py-2 !text-sm ${className}`}
    >
      <PreviewsIcon className="!m-0 !h-[1.15em] !w-[1.15em]" />
      Autoplay previews
      <SwitchKnob on={on} />
    </button>
  );
};
