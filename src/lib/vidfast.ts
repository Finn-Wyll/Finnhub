import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MediaType } from '../core/models';

/**
 * VidFast embed: URL building plus the postMessage bridge (commands out,
 * PLAYER_EVENT in). See https://vidfast.vc/ (Documentation section).
 */

export const VIDFAST_BASE = 'https://vidfast.vc';

/** Every origin VidFast may post from. Messages from anywhere else are ignored. */
const ORIGINS = new Set([
  'https://vidfast.pro',
  'https://vidfast.in',
  'https://vidfast.io',
  'https://vidfast.me',
  'https://vidfast.net',
  'https://vidfast.pm',
  'https://vidfast.xyz',
  'https://vidfast.vc',
  'https://vidfast.bz',
]);

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

/**
 * Bridge to one embed instance. `instance` must change whenever the iframe
 * reloads (new src), so state starts fresh for the new player.
 */
export function useVidfast(frame: RefObject<HTMLIFrameElement | null>, instance: string, onEnded?: () => void) {
  const [status, setStatus] = useState<PlayerStatus>(initial);
  const origin = useRef<string>('*');
  // After a local seek, ignore periodic time reports until the embed catches up.
  const holdTimeUntil = useRef(0);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    setStatus(initial);
    origin.current = '*';
    holdTimeUntil.current = 0;
  }, [instance]);

  const send = useCallback(
    (cmd: Command) => {
      frame.current?.contentWindow?.postMessage(cmd, origin.current);
    },
    [frame],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!ORIGINS.has(e.origin) || e.source !== frame.current?.contentWindow) return;
      const msg = e.data as { type?: string; data?: EventData } | null;
      if (!msg || msg.type !== 'PLAYER_EVENT' || !msg.data) return;
      origin.current = e.origin;
      const d = msg.data;
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
      if (d.event === 'ended') endedRef.current?.();
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
