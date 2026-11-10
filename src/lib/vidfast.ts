import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MediaType } from '../core/models';

/**
 * VidFast embed: URL building plus a listening bridge for the events it posts.
 *
 * VidFast documents play/pause/seek/volume/mute postMessage commands, but its
 * current player ignores all of them (read from its shipped code, November 2026,
 * on vidfast.vc and vidcore.io alike); only `getStatus` is answered. So playback
 * is driven through the embed URL instead (see Player.tsx): every play, seek or
 * subtitle change loads a new embed at the right second with `startAt` and
 * `autoPlay`, and pausing unloads it. What the embed reports back (PLAYER_EVENT,
 * MEDIA_DATA, a 404 status) is still used for state and progress. The embed's own
 * keyboard shortcuts (Space, arrows, M, F) do work, and keys never trigger its ads
 * (those listen for mousedown only), so the player hands keyboard focus to it.
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
 * remembered for the tab) to log every message the page receives.
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
  return raw && typeof raw === 'object' ? (raw as { type?: string; data?: unknown; event?: string }) : null;
}

/** Player accent (tokens.json dark accent), without the leading #. */
const THEME = 'F2B33D';

export interface EmbedOptions {
  /** Subtitle language code, or null for none. */
  sub: string | null;
  /**
   * Second to start at, or null to let VidFast pick (it resumes from its own
   * saved progress). VidFast treats `startAt=0` as unset, so an explicit start
   * from the beginning is sent as 0.1.
   */
  startAt: number | null;
}

export function vidfastUrl(type: MediaType, id: number, season: number, episode: number, { sub, startAt }: EmbedOptions) {
  const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}/${season}/${episode}`;
  // Our chrome supplies the title and fullscreen, so the embed's copies are hidden.
  const q = new URLSearchParams({ autoPlay: 'true', title: 'false', fullscreenButton: 'false', theme: THEME });
  if (sub) q.set('sub', sub);
  if (startAt !== null) q.set('startAt', startAt >= 1 ? String(Math.floor(startAt)) : '0.1');
  return `${VIDFAST_BASE}${path}?${q}`;
}

export interface PlayerStatus {
  /** True once this embed instance has reported at least once. */
  ready: boolean;
  /** True between a `play` event and the next `pause`/`ended`. */
  playing: boolean;
  currentTime: number;
  duration: number;
  /** Whether the embed's video is muted, or null until it says. */
  muted: boolean | null;
}

export type PlayerEvent = 'play' | 'pause' | 'seeked' | 'ended' | 'timeupdate' | 'playerstatus';

interface EventData {
  event: PlayerEvent;
  currentTime?: number;
  duration?: number;
  playing?: boolean;
  muted?: boolean;
}

const initial: PlayerStatus = { ready: false, playing: false, currentTime: 0, duration: 0, muted: null };

export interface BridgeEvents {
  onEnded?: () => void;
  /** Every PLAYER_EVENT, after state is updated. */
  onEvent?: (event: PlayerEvent, status: { currentTime: number; duration: number }) => void;
  /** VidFast's full progress object (MEDIA_DATA), untrusted: validate before use. */
  onMediaData?: (data: unknown) => void;
  /** None of VidFast's servers can play this title. */
  onUnavailable?: () => void;
}

/**
 * Listening bridge for one embed instance. `instance` must change whenever the
 * iframe reloads, so state starts fresh for the new player.
 */
export function useVidfast(frame: RefObject<HTMLIFrameElement | null>, instance: string, events: BridgeEvents = {}) {
  const [status, setStatus] = useState<PlayerStatus>(initial);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    setStatus(initial);
  }, [instance]);

  const debug = useRef(false);
  useEffect(() => {
    debug.current = debugEnabled();
  }, []);

  // getStatus is the one command VidFast answers. targetOrigin '*' as in its docs:
  // the embed may redirect to another VidFast domain, and the request carries nothing sensitive.
  const requestStatus = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ command: 'getStatus' }, '*');
  }, [frame]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (debug.current) console.info('[vidfast] receive', e.origin, e.source === frame.current?.contentWindow ? '(our iframe)' : '(other frame)', e.data);
      // Origin is the trust boundary; the source window is not compared, in case the player is nested.
      if (!isVidfastOrigin(e.origin)) return;
      const msg = parse(e.data);
      if (!msg) return;
      if (msg.type === 'MEDIA_DATA') {
        if (msg.data) eventsRef.current.onMediaData?.(msg.data);
        return;
      }
      // Undocumented: { event: "status", data: 404 } when every server failed.
      if (msg.event === 'status' && msg.data === 404) {
        eventsRef.current.onUnavailable?.();
        return;
      }
      if (msg.type !== 'PLAYER_EVENT') return;
      const d = (msg.data && typeof msg.data === 'object' ? msg.data : msg) as EventData;
      if (typeof d.event !== 'string') return;
      setStatus((s) => ({
        ready: true,
        playing: d.event === 'play' ? true : d.event === 'pause' || d.event === 'ended' ? false : d.playing ?? s.playing,
        currentTime: num(d.currentTime, s.currentTime),
        duration: num(d.duration, s.duration) || s.duration,
        // VidFast reports muted inverted: it sends `muted: !mutedState` (read from its code,
        // where the state is set from video.muted). So the real value is the negation.
        muted: typeof d.muted === 'boolean' ? !d.muted : s.muted,
      }));
      eventsRef.current.onEvent?.(d.event, { currentTime: num(d.currentTime, 0), duration: num(d.duration, 0) });
      if (d.event === 'ended') eventsRef.current.onEnded?.();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame]);

  // Ask for status until the embed answers.
  useEffect(() => {
    if (status.ready) return;
    const t = window.setInterval(requestStatus, 1000);
    return () => window.clearInterval(t);
  }, [status.ready, requestStatus, instance]);

  return { status };
}

function num(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
