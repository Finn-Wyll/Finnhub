import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MediaType } from '../core/models';

/**
 * VidFast embed: URL building plus the postMessage bridge (commands out,
 * PLAYER_EVENT in). See https://vidfast.vc/ (Documentation section).
 */

export const VIDFAST_BASE = 'https://vidfast.vc';

/** Every domain VidFast may post from (and their subdomains). Messages from anywhere else are ignored. */
const DOMAINS = ['vidfast.pro', 'vidfast.in', 'vidfast.io', 'vidfast.me', 'vidfast.net', 'vidfast.pm', 'vidfast.xyz', 'vidfast.vc', 'vidfast.bz'];

export function isVidfastOrigin(origin: string) {
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Debug logging for the bridge: add `?debug=player` to a /watch URL (it is
 * remembered for the tab) to log every message the page receives and every
 * command it sends.
 */
function debugEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === 'player') sessionStorage.setItem('finnhub.debug.player', '1');
    return sessionStorage.getItem('finnhub.debug.player') === '1';
  } catch {
    return false;
  }
}

/** Messages may arrive as objects or as JSON strings. */
function parse(raw: unknown): { type?: string; data?: unknown; event?: string } | null {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw && typeof raw === 'object' ? (raw as { type?: string; data?: unknown }) : null;
}

/** Player accent (tokens.json dark accent), without the leading #. */
const THEME = 'F2B33D';

export interface EmbedOptions {
  /** Subtitle language code, or null for none. */
  sub: string | null;
  /** Start position in whole seconds. */
  startAt: number;
}

export function vidfastUrl(type: MediaType, id: number, season: number, episode: number, { sub, startAt }: EmbedOptions) {
  const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}/${season}/${episode}`;
  // Our chrome supplies the title and fullscreen, so the embed's copies are hidden.
  const q = new URLSearchParams({ autoPlay: 'true', title: 'false', fullscreenButton: 'false', theme: THEME });
  if (sub) q.set('sub', sub);
  if (startAt > 0) q.set('startAt', String(Math.floor(startAt)));
  return `${VIDFAST_BASE}${path}?${q}`;
}

export interface PlayerStatus {
  /** True once the embed has answered at least once. */
  ready: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
}

type Command =
  | { command: 'play' }
  | { command: 'pause' }
  | { command: 'seek'; time: number }
  | { command: 'volume'; level: number }
  | { command: 'mute'; muted: boolean }
  | { command: 'getStatus' };

interface EventData {
  event: 'play' | 'pause' | 'seeked' | 'ended' | 'timeupdate' | 'playerstatus';
  currentTime?: number;
  duration?: number;
  playing?: boolean;
  muted?: boolean;
  volume?: number;
}

const initial: PlayerStatus = { ready: false, playing: false, currentTime: 0, duration: 0, volume: 1, muted: false };

export interface BridgeEvents {
  onEnded?: () => void;
  /** Every PLAYER_EVENT, after state is updated. */
  onEvent?: (event: EventData['event'], status: { currentTime: number; duration: number }) => void;
  /** VidFast's full progress object (MEDIA_DATA), untrusted: validate before use. */
  onMediaData?: (data: unknown) => void;
}

/**
 * Bridge to one embed instance. `instance` must change whenever the iframe
 * reloads (new src), so state starts fresh for the new player.
 */
export function useVidfast(frame: RefObject<HTMLIFrameElement | null>, instance: string, events: BridgeEvents = {}) {
  const [status, setStatus] = useState<PlayerStatus>(initial);
  // After a local seek, ignore periodic time reports until the embed catches up.
  const holdTimeUntil = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    setStatus(initial);
    holdTimeUntil.current = 0;
  }, [instance]);

  const debug = useRef(false);
  useEffect(() => {
    debug.current = debugEnabled();
  }, []);

  // Commands go to the iframe with targetOrigin '*', as VidFast's docs do: the embed
  // may redirect or host its player on another VidFast domain, and a targeted origin
  // that does not match is dropped silently. The commands carry nothing sensitive.
  const send = useCallback(
    (cmd: Command) => {
      if (debug.current) console.info('[vidfast] send', cmd);
      frame.current?.contentWindow?.postMessage(cmd, '*');
    },
    [frame],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (debug.current) console.info('[vidfast] receive', e.origin, e.source === frame.current?.contentWindow ? '(our iframe)' : '(other frame)', e.data);
      // Origin is the trust boundary. The sender may be a player nested inside our
      // iframe rather than the iframe itself, so the source window is not compared.
      if (!isVidfastOrigin(e.origin)) return;
      const msg = parse(e.data);
      if (!msg) return;
      if (msg.type === 'MEDIA_DATA') {
        if (msg.data) eventsRef.current.onMediaData?.(msg.data);
        return;
      }
      if (msg.type !== 'PLAYER_EVENT') return;
      // Documented shape is { type, data: { event, ... } }; tolerate the fields at the top level too.
      const d = (msg.data && typeof msg.data === 'object' ? msg.data : msg) as EventData;
      if (typeof d.event !== 'string') return;
      const holding = d.event === 'timeupdate' && performance.now() < holdTimeUntil.current;
      if (d.event === 'seeked') holdTimeUntil.current = 0;
      setStatus((s) => ({
        ready: true,
        playing: d.event === 'play' ? true : d.event === 'pause' || d.event === 'ended' ? false : d.playing ?? s.playing,
        currentTime: holding ? s.currentTime : num(d.currentTime, s.currentTime),
        duration: num(d.duration, s.duration) || s.duration,
        volume: num(d.volume, s.volume),
        muted: d.muted ?? s.muted,
      }));
      eventsRef.current.onEvent?.(d.event, { currentTime: num(d.currentTime, 0), duration: num(d.duration, 0) });
      if (d.event === 'ended') eventsRef.current.onEnded?.();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame]);

  // Ask for status until the embed answers, so controls reflect it even if autoplay was blocked.
  useEffect(() => {
    if (status.ready) return;
    const t = window.setInterval(() => send({ command: 'getStatus' }), 1000);
    return () => window.clearInterval(t);
  }, [status.ready, send, instance]);

  const controls = {
    play: () => {
      send({ command: 'play' });
      setStatus((s) => ({ ...s, playing: true }));
    },
    pause: () => {
      send({ command: 'pause' });
      setStatus((s) => ({ ...s, playing: false }));
    },
    seek: (seconds: number) => {
      const time = Math.round(Math.max(0, status.duration ? Math.min(status.duration, seconds) : seconds));
      holdTimeUntil.current = performance.now() + 2000;
      send({ command: 'seek', time });
      setStatus((s) => ({ ...s, currentTime: time }));
    },
    volume: (level: number) => {
      const v = Math.min(1, Math.max(0, level));
      send({ command: 'volume', level: v });
      if (status.muted && v > 0) send({ command: 'mute', muted: false });
      setStatus((s) => ({ ...s, volume: v, muted: v > 0 ? false : s.muted }));
    },
    mute: (muted: boolean) => {
      send({ command: 'mute', muted });
      setStatus((s) => ({ ...s, muted }));
    },
  };

  return { status, controls };
}

function num(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
