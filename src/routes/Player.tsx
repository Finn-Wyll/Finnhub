import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsIn,
  ArrowsOut,
  ClockClockwise,
  ClockCounterClockwise,
  ClosedCaptioning,
  Pause,
  Play,
  Queue,
  SkipForward,
  WarningCircle,
} from '@phosphor-icons/react';
import { animate } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp, useTmdb } from '../app-context';
import type { Episode, MediaType, TitleDetail } from '../core/models';
import { Img } from '../components/Img';
import { ErrorState } from '../components/States';
import { ControlButton } from '../components/player/ControlButton';
import { EpisodeSheet } from '../components/player/EpisodeSheet';
import { MenuGroup, MenuOption, Popover } from '../components/player/Popover';
import { Scrubber } from '../components/player/Scrubber';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useQuery } from '../hooks/useQuery';
import { clock } from '../lib/format';
import { enter, prefersReducedMotion, springs } from '../lib/motion';
import { useVidfast, vidfastUrl } from '../lib/vidfast';
import NotFound from './NotFound';

/**
 * Player. VidFast plays the media in an iframe but ignores playback commands,
 * and clicks inside it open ad pop-ups (its ad script listens for mousedown). So the
 * embed never receives a pointer event, and our controls drive it through its URL:
 * each play, seek or subtitle change starts a new "session" (a fresh embed load at
 * the right second with autoPlay), and pause ends the session. Its own keyboard
 * shortcuts do work and never trigger ads, so while it plays it is given keyboard
 * focus: the viewer's real keys (Space, arrows, M for sound) then act on it directly.
 * Pages cannot send synthetic keys into a cross-origin frame, so our buttons cannot
 * use that path. The events VidFast posts back keep the clock, progress and up-next honest.
 */
export default function Player() {
  const { type, id, season, episode } = useParams();
  const mediaType: MediaType | null = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : null;
  const tid = Number(id);
  const s = Number(season ?? 1);
  const e = Number(episode ?? 1);
  if (!mediaType || !Number.isInteger(tid) || (mediaType === 'tv' && (!Number.isInteger(s) || !Number.isInteger(e)))) return <NotFound />;
  // Keyed per episode, so every episode starts from a clean session.
  return <PlayerView key={`${mediaType}-${tid}-${s}-${e}`} type={mediaType} id={tid} season={s} episode={e} />;
}

const SUBTITLES = [
  { id: null, label: 'Off' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
] as const;

/** A loaded embed that has not reported within this time is treated as stuck. */
const NO_ANSWER_MS = 15000;
/** Skips and scrubs that land within this window are combined into one reload. */
const SEEK_SETTLE_MS = 600;

const SUB_KEY = 'finnhub.player.sub';
const readSub = () => {
  try {
    return sessionStorage.getItem(SUB_KEY) || null;
  } catch {
    return null;
  }
};

interface Session {
  /** Increments on every embed load; the iframe is keyed by it. */
  n: number;
  /** Second the embed starts at, or null to let VidFast resume on its own. */
  at: number | null;
}

function PlayerView({ type, id, season, episode }: { type: MediaType; id: number; season: number; episode: number }) {
  const client = useTmdb();
  const navigate = useNavigate();
  const location = useLocation();
  const { progress } = useApp();
  const { data: title, error, retry } = useQuery((sig) => client.detail(type, id, sig), [type, id]);
  const { data: episodes } = useQuery((sig) => client.season(id, season, sig), [id, season], type === 'tv');
  const ep = episodes?.find((x) => x.episodeNumber === episode);

  useDocumentTitle(title ? (type === 'tv' ? `${title.title} S${season} E${episode}` : title.title) : 'Player');

  const root = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const captionsBtn = useRef<HTMLButtonElement>(null);
  const upNextRef = useRef<HTMLAnchorElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  // Where this film or episode was left off, read once when it opens.
  const [resumedFrom] = useState(() => progress.resumeFor(type, id, season, episode));

  // Playback state. `wantPlay` is what the viewer asked for; `status.playing` is what the embed reports.
  const [session, setSession] = useState<Session>(() => ({ n: 0, at: resumedFrom > 0 ? resumedFrom : null }));
  // Opened before any interaction with the page (a direct link or refresh): wait for a
  // click, so the embed is allowed to start with sound where the browser permits it.
  const [wantPlay, setWantPlay] = useState(() => {
    try {
      return navigator.userActivation?.hasBeenActive ?? true;
    } catch {
      return true;
    }
  });
  const [pos, setPos] = useState(resumedFrom);
  const [dur, setDur] = useState(0);
  const [sub, setSubState] = useState<string | null>(readSub);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);
  const [problem, setProblem] = useState<'unavailable' | 'stuck' | null>(null);
  const [loadedN, setLoadedN] = useState<number | null>(null);
  // The session whose embed has reported `play` at least once.
  const [playedN, setPlayedN] = useState<number | null>(null);
  const sessionRef = useRef(session.n);
  sessionRef.current = session.n;

  const src = vidfastUrl(type, id, season, episode, { sub, startAt: session.at });
  const loaded = loadedN === session.n;

  const next = useMemo(() => nextEpisode(title, episodes, season, episode), [title, episodes, season, episode]);
  const nextHref = next ? `/watch/tv/${id}/${next.season}/${next.episode}` : null;

  const lastSave = useRef(0);
  const { status } = useVidfast(frameRef, String(session.n), {
    onEnded: () => {
      if (nextHref) navigate(nextHref, { replace: true });
      else setWantPlay(false);
    },
    onUnavailable: () => setProblem('unavailable'),
    onMediaData: (data) => {
      progress.merge(data);
      if (title) progress.describe(type, id, { title: title.title, poster_path: title.posterPath, backdrop_path: title.backdropPath });
    },
    onEvent: (event, { currentTime, duration: total }) => {
      if (event === 'play') setPlayedN(sessionRef.current);
      if (total > 0) setDur(total);
      // A fresh embed can report 0 before it reaches startAt; only trust positions past the first second.
      if (currentTime >= 1 || event === 'ended') setPos(event === 'ended' ? total : currentTime);
      if (!total || event === 'playerstatus') return;
      const now = performance.now();
      if (event === 'timeupdate' && now - lastSave.current < 5000) return;
      if (currentTime < 10 && event !== 'seeked' && event !== 'ended') return;
      lastSave.current = now;
      progress.record({
        type,
        id,
        season,
        episode,
        watched: event === 'ended' ? total : currentTime,
        duration: total,
        meta: title ? { title: title.title, poster_path: title.posterPath, backdrop_path: title.backdropPath } : undefined,
      });
    },
  });

  /** Load a new embed at `at` and play from there. */
  const startSession = useCallback((at: number) => {
    setProblem(null);
    setPendingSeek(null);
    setPos(at);
    setSession((s) => ({ n: s.n + 1, at }));
    setWantPlay(true);
  }, []);

  // A seek waits briefly so repeated skips or a scrub become a single reload.
  useEffect(() => {
    if (pendingSeek === null) return;
    const t = window.setTimeout(() => startSession(pendingSeek), SEEK_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [pendingSeek, startSession]);

  // "Starting" covers everything between asking to play and the embed's first `play` event.
  const hasPlayed = playedN === session.n;
  const starting = wantPlay && !problem && !hasPlayed;
  // Playing now, as reported; paused from the embed's own keys leaves the embed loaded.
  const playingNow = wantPlay && hasPlayed && status.playing;

  // A loaded embed that never reports is stuck; offer a retry rather than leaving dead controls.
  useEffect(() => {
    if (!wantPlay || !loaded || status.ready || problem) return;
    const t = window.setTimeout(() => setProblem('stuck'), NO_ANSWER_MS);
    return () => window.clearTimeout(t);
  }, [wantPlay, loaded, status.ready, problem, session.n]);

  const [menu, setMenu] = useState<'captions' | null>(null);
  const [sheet, setSheet] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [chipGone, setChipGone] = useState(false);
  const [flash, setFlash] = useState<{ icon: 'play' | 'pause' | 'back' | 'fwd'; n: number } | null>(null);
  const target = pendingSeek ?? pos;
  const time = drag ?? target;

  // Controls hide after 3s of inactivity while playing and nothing is open.
  const idleTimer = useRef<number>(undefined);
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 3000);
  }, []);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  const chromeVisible = !playingNow || !!problem || !idle || menu !== null || sheet || drag !== null;

  // The page reserves a scrollbar gutter (scrollbar-gutter: stable), which would
  // shift this full-viewport overlay left of true centre. Release it while the player is open.
  useEffect(() => {
    const html = document.documentElement;
    const prev = { gutter: html.style.scrollbarGutter, overflow: html.style.overflow };
    html.style.scrollbarGutter = 'auto';
    html.style.overflow = 'hidden';
    return () => {
      html.style.scrollbarGutter = prev.gutter;
      html.style.overflow = prev.overflow;
    };
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // State transition: the embed fades in over the still once it has started; it stays
  // visible if paused from its own keys, showing the real frame.
  const showing = wantPlay && hasPlayed;
  useEffect(() => {
    const el = frameRef.current;
    if (!showing || !el) return;
    const anim = prefersReducedMotion()
      ? animate(el, { opacity: [0, 1], duration: 180, ease: 'linear' })
      : animate(el, { opacity: [0, 1], scale: [0.985, 1], ease: springs.default() });
    return () => {
      anim.revert();
    };
  }, [showing]);

  const showFlash = (icon: 'play' | 'pause' | 'back' | 'fwd') => setFlash((f) => ({ icon, n: (f?.n ?? 0) + 1 }));
  useEffect(() => {
    const el = flashRef.current;
    if (!flash || !el) return;
    const anim = animate(
      el,
      prefersReducedMotion()
        ? { opacity: [0.9, 0], duration: 400, ease: 'linear' }
        : { opacity: [{ to: 1, duration: 80 }, { to: 0, duration: 380, delay: 160 }], scale: [0.7, 1.08], ease: springs.snappy() },
    );
    return () => {
      anim.revert();
    };
  }, [flash]);

  const clampTime = (t: number) => Math.max(0, dur ? Math.min(dur - 1, t) : t);

  const togglePlay = () => {
    if (playingNow) {
      // Pausing unloads the embed; the last reported position is kept for the next play.
      setWantPlay(false);
      setPendingSeek(null);
      showFlash('pause');
    } else {
      // Playing again after the end starts over.
      startSession(dur && pos >= dur - 2 ? 0 : pos);
      showFlash('play');
    }
    wake();
  };

  /** Move to `t`. While playing this reloads the embed there (after a short settle); while paused it only moves the playhead. */
  const seekTo = (t: number) => {
    const at = clampTime(t);
    if (wantPlay) setPendingSeek(at);
    else setPos(at);
    wake();
  };

  const skip = (delta: number) => {
    seekTo(target + delta);
    showFlash(delta < 0 ? 'back' : 'fwd');
  };

  const chooseSubtitles = (lang: string | null) => {
    if (lang === sub) return;
    setSubState(lang);
    try {
      if (lang) sessionStorage.setItem(SUB_KEY, lang);
      else sessionStorage.removeItem(SUB_KEY);
    } catch {
      /* not remembered across episodes; fine */
    }
    if (wantPlay) startSession(pos);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      /* Fullscreen can be blocked (permissions, embedded contexts). The UI simply stays windowed. */
    }
  };

  const exit = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/title/${type}/${id}`);
  };

  // "Resumed at" chip: rises in once playback starts from the saved point, leaves after 8s.
  const showChip = resumedFrom > 0 && session.at === resumedFrom && playingNow && !chipGone;
  useEffect(() => {
    if (!showChip) return;
    const anim = chipRef.current ? enter(chipRef.current, { distance: 12 }) : null;
    const t = window.setTimeout(() => setChipGone(true), 8000);
    return () => {
      window.clearTimeout(t);
      anim?.revert();
    };
  }, [showChip]);

  // The up-next card rises in when it appears, so the change is noticed without being abrupt.
  const upNextShown = type === 'tv' && !!next && wantPlay && dur > 0 && dur - time <= 25 && time > 0;
  useEffect(() => {
    if (!upNextShown || !upNextRef.current) return;
    const anim = enter(upNextRef.current, { distance: 12 });
    return () => {
      anim?.revert();
    };
  }, [upNextShown]);

  // Keyboard focus goes to the embed while it plays and nothing of ours is open, so the
  // viewer's keys act on it natively. Clicking anywhere on our page takes focus back.
  const [keysInEmbed, setKeysInEmbed] = useState(false);
  useEffect(() => {
    if (!playingNow || menu !== null || sheet || problem) return;
    frameRef.current?.focus({ preventScroll: true });
  }, [playingNow, menu, sheet, problem, session.n]);
  useEffect(() => {
    const check = () => window.setTimeout(() => setKeysInEmbed(!!frameRef.current && document.activeElement === frameRef.current), 0);
    window.addEventListener('blur', check);
    window.addEventListener('focus', check);
    document.addEventListener('focusin', check);
    return () => {
      window.removeEventListener('blur', check);
      window.removeEventListener('focus', check);
      document.removeEventListener('focusin', check);
    };
  }, []);
  // Sound hint: the embed started muted (the browser refused sound); M inside it unmutes without a click.
  const mutedHint = playingNow && keysInEmbed && status.muted === true;
  const hintRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mutedHint || !hintRef.current) return;
    const anim = enter(hintRef.current, { distance: -8 });
    return () => {
      anim?.revert();
    };
  }, [mutedHint]);

  // Keyboard shortcuts, YouTube/Apple TV style. While the embed has focus, keys go to it instead.
  const current = { togglePlay, skip, toggleFullscreen, type, nextHref };
  const keys = useRef(current);
  keys.current = current;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range')) return;
      const k = e.key.toLowerCase();
      const a = keys.current;
      if (k === ' ' || k === 'k') {
        if (tag === 'BUTTON' && k === ' ') return; // let focused buttons activate
        a.togglePlay();
      } else if (k === 'arrowleft' || k === 'j') a.skip(-10);
      else if (k === 'arrowright' || k === 'l') a.skip(10);
      else if (k === 'f') void a.toggleFullscreen();
      else if (k === 'c') setMenu((m) => (m === 'captions' ? null : 'captions'));
      else if (k === 'e' && a.type === 'tv') setSheet((v) => !v);
      else if (k === 'n' && a.nextHref) navigate(a.nextHref, { replace: true });
      else return;
      e.preventDefault();
      wake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, wake]);

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#08080a] p-6 [color-scheme:dark]">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const label = title?.title ?? '';
  const subtitle = type === 'tv' ? `S${season} E${episode}${ep ? `  ${ep.name}` : ''}` : title?.year ? String(title.year) : '';
  const still = ep?.stillPath ?? title?.backdropPath ?? null;
  const transportLabel = playingNow ? 'Pause' : 'Play';

  const nextLink = nextHref && (
    <Link
      to={nextHref}
      replace
      aria-label="Next episode"
      title="Next episode (N)"
      className="press inline-grid size-11 shrink-0 place-items-center rounded-full text-white outline-offset-2 hover:bg-white/12 focus-visible:bg-white/12"
    >
      <SkipForward size={22} weight="fill" aria-hidden />
    </Link>
  );

  return (
    <div
      ref={root}
      onPointerMove={wake}
      onPointerDown={wake}
      className={`fixed inset-0 z-50 select-none overflow-hidden bg-[#08080a] text-white [color-scheme:dark] ${chromeVisible ? '' : 'cursor-none'}`}
    >
      <h1 className="sr-only">
        {label} {subtitle}
      </h1>

      {/* Stage: the embed, letterboxed to 16:9. It never receives pointer events or focus. */}
      <div className="absolute inset-0 grid place-items-center [container-type:size]">
        <div className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] overflow-hidden bg-black">
          {!showing && (
            // The still is dimmed on a wrapper: Img sets its own opacity for its fade-in.
            <div className={`absolute inset-0 transition-opacity duration-300 ${wantPlay ? 'opacity-30' : 'opacity-50'}`} aria-hidden>
              {still && <Img path={still} size="w1280" alt="" priority className="size-full object-cover" />}
            </div>
          )}
          {wantPlay && !problem && (
            <iframe
              ref={frameRef}
              key={session.n}
              title={label ? `${label} video player. Space, arrow keys and M work here.` : 'Video player'}
              src={src}
              // Focusable only by script (see keysInEmbed); never by Tab or pointer.
              tabIndex={-1}
              onLoad={() => setLoadedN(session.n)}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="origin"
              className={`pointer-events-none absolute inset-0 size-full border-0 bg-black ${showing ? '' : 'opacity-0'}`}
            />
          )}
        </div>
      </div>

      {/* Click layer over the embed: single click toggles, double click toggles fullscreen. */}
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={(e) => {
          if (e.detail === 1 && !problem) togglePlay();
        }}
        onDoubleClick={() => void toggleFullscreen()}
      />

      {/* Starting: the embed is loading or seeking to the requested second. */}
      {starting && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <div className="mt-36 flex flex-col items-center gap-3">
            <div className="skeleton h-1 w-40 overflow-hidden rounded-full opacity-70" />
            <p className="text-sm text-white/70">
              {target >= 1 ? (
                <>
                  Starting at <span className="tnum">{clock(target)}</span>
                </>
              ) : (
                'Starting…'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Transient feedback in the middle of the stage. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
        <div ref={flashRef} className="grid size-20 place-items-center rounded-full bg-black/45 opacity-0 backdrop-blur-md">
          {flash?.icon === 'play' && <Play size={34} weight="fill" />}
          {flash?.icon === 'pause' && <Pause size={34} weight="fill" />}
          {flash?.icon === 'back' && <ClockCounterClockwise size={32} />}
          {flash?.icon === 'fwd' && <ClockClockwise size={32} />}
        </div>
      </div>

      {/* Chrome */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden={!chromeVisible}
      >
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Top bar */}
        <div
          className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute inset-x-0 top-0 flex items-center gap-3 py-4 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(16px,env(safe-area-inset-top))] md:py-6 md:pl-[max(24px,env(safe-area-inset-left))] md:pr-[max(24px,env(safe-area-inset-right))]`}
        >
          <ControlButton label="Exit player" onClick={exit} className="bg-white/10 backdrop-blur-md">
            <ArrowLeft size={20} weight="bold" aria-hidden />
          </ControlButton>
          <div className="min-w-0 flex-1">
            {title ? (
              <>
                <Link to={`/title/${type}/${id}`} className="block truncate text-[1.0625rem] font-semibold tracking-[-0.01em] hover:underline">
                  {label}
                </Link>
                {subtitle && <p className="truncate text-sm text-white/70">{subtitle}</p>}
              </>
            ) : (
              <div className="space-y-2" aria-hidden>
                <div className="h-4 w-48 rounded-full bg-white/15" />
                <div className="h-3 w-24 rounded-full bg-white/10" />
              </div>
            )}
          </div>
        </div>

        {/* Centre transport */}
        {!problem && (
          <div className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-6 md:gap-10`}>
            <ControlButton label="Back 10 seconds" size="lg" onClick={() => skip(-10)} className="bg-black/25 backdrop-blur-md">
              <ArrowCounterClockwise size={32} aria-hidden />
              <span className="absolute pt-0.5 text-[10px] font-semibold tnum" aria-hidden>
                10
              </span>
            </ControlButton>
            <ControlButton label={transportLabel} size="xl" onClick={togglePlay} className="bg-white/14 backdrop-blur-xl hover:bg-white/20">
              {playingNow ? <Pause size={34} weight="fill" aria-hidden /> : <Play size={34} weight="fill" aria-hidden />}
            </ControlButton>
            <ControlButton label="Forward 10 seconds" size="lg" onClick={() => skip(10)} className="bg-black/25 backdrop-blur-md">
              <ArrowClockwise size={32} aria-hidden />
              <span className="absolute pt-0.5 text-[10px] font-semibold tnum" aria-hidden>
                10
              </span>
            </ControlButton>
          </div>
        )}

        {/* Problem: unavailable, or the embed never reported. */}
        {problem && (
          <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 text-center">
            <WarningCircle size={36} className="mx-auto text-white/80" aria-hidden />
            <p className="mt-3 text-lg font-semibold">{problem === 'unavailable' ? 'Not Available Right Now' : 'The Player Is Not Responding'}</p>
            <p className="mt-1 text-sm text-white/70">
              {problem === 'unavailable'
                ? 'None of the streaming servers can play this title at the moment. Try again later.'
                : 'It may be slow to connect. Trying again usually helps.'}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => startSession(pos)}
                className="press h-11 rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 outline-offset-2 hover:bg-white/90"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={exit}
                className="press h-11 rounded-full bg-white/12 px-5 text-sm font-semibold outline-offset-2 hover:bg-white/18 focus-visible:bg-white/18"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Bottom bar (hidden when there is nothing to play) */}
        {!problem && (
        <div
          className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute inset-x-0 bottom-0 pb-[max(16px,env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] md:pb-6 md:pl-[max(24px,env(safe-area-inset-left))] md:pr-[max(24px,env(safe-area-inset-right))]`}
        >
          <div className="flex items-center gap-3 font-mono text-xs text-white/80 tnum md:gap-4">
            <span className="w-14 text-right">{clock(time)}</span>
            <div className="flex-1">
              <Scrubber
                value={time}
                duration={dur}
                buffered={time}
                previewPath={still}
                onScrubStart={() => setDrag(target)}
                onSeek={(v) => {
                  if (drag !== null) setDrag(v);
                  else seekTo(v);
                  wake();
                }}
                onScrubEnd={() => {
                  if (drag !== null) seekTo(drag);
                  setDrag(null);
                }}
              />
            </div>
            <span className="w-14">{dur ? `-${clock(dur - time)}` : '--:--'}</span>
          </div>

          <div className="mt-2 flex items-center gap-1 md:gap-2">
            <ControlButton label={transportLabel} onClick={togglePlay}>
              {playingNow ? <Pause size={22} weight="fill" aria-hidden /> : <Play size={22} weight="fill" aria-hidden />}
            </ControlButton>
            {nextLink}

            <div className="ml-auto flex items-center gap-1 md:gap-2">
              {type === 'tv' && title && (
                <ControlButton label="Episodes" active={sheet} aria-expanded={sheet} onClick={() => setSheet((v) => !v)}>
                  <Queue size={22} aria-hidden />
                </ControlButton>
              )}
              <div className="relative">
                <ControlButton
                  ref={captionsBtn}
                  label="Subtitles"
                  active={sub !== null}
                  aria-expanded={menu === 'captions'}
                  aria-haspopup="dialog"
                  onClick={() => setMenu((m) => (m === 'captions' ? null : 'captions'))}
                >
                  <ClosedCaptioning size={22} weight={sub !== null ? 'fill' : 'regular'} aria-hidden />
                </ControlButton>
                <Popover open={menu === 'captions'} onClose={() => setMenu(null)} anchor={captionsBtn.current} label="Subtitles" className="w-60">
                  <MenuGroup title="Subtitles">
                    {SUBTITLES.map((c) => (
                      <MenuOption key={c.label} checked={sub === c.id} onSelect={() => chooseSubtitles(c.id)}>
                        {c.label}
                      </MenuOption>
                    ))}
                  </MenuGroup>
                  <p className="px-3 pb-2 text-xs text-white/55">Changing subtitles reloads the player where you are.</p>
                </Popover>
              </div>
              <ControlButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => void toggleFullscreen()}>
                {fullscreen ? <ArrowsIn size={22} aria-hidden /> : <ArrowsOut size={22} aria-hidden />}
              </ControlButton>
            </div>
          </div>
        </div>
        )}
      </div>

      {mutedHint && (
        <div ref={hintRef} className="glass-dark pointer-events-none absolute left-1/2 top-[max(20px,env(safe-area-inset-top))] z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full py-2 pl-2 pr-4 md:top-6" role="status">
          <kbd className="grid size-7 place-items-center rounded-[8px] bg-white/16 font-sans text-sm font-semibold">M</kbd>
          <span className="text-sm">Press M to turn on sound</span>
        </div>
      )}

      {showChip && (
        <div ref={chipRef} className="glass-dark absolute bottom-32 left-4 z-30 flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 md:left-6">
          <p className="text-sm">
            Resumed at <span className="tnum">{clock(resumedFrom)}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setChipGone(true);
              startSession(0);
              wake();
            }}
            className="press h-9 rounded-full bg-white/14 px-3.5 text-sm font-medium outline-offset-2 hover:bg-white/20 focus-visible:bg-white/20"
          >
            Start Over
          </button>
        </div>
      )}

      {upNextShown && nextHref && (
        <Link
          ref={upNextRef}
          to={nextHref}
          replace
          className="press glass-dark absolute bottom-32 right-4 z-30 flex w-72 items-center gap-3 rounded-[var(--radius-panel)] p-3 md:right-6"
        >
          <SkipForward size={22} weight="fill" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-white/60">Up next in {Math.max(0, Math.ceil(dur - time))}s</p>
            <p className="truncate text-sm font-medium">
              S{next!.season} E{next!.episode}
              {next!.name ? `  ${next!.name}` : ''}
            </p>
          </div>
        </Link>
      )}

      {type === 'tv' && title && <EpisodeSheet open={sheet} onClose={() => setSheet(false)} show={title} season={season} episode={episode} />}

      <p className="sr-only" aria-live="polite">
        {problem === 'unavailable'
          ? 'Not available right now.'
          : problem === 'stuck'
            ? 'The player is not responding.'
            : starting
              ? 'Loading player…'
              : playingNow
                ? 'Playing'
                : 'Paused'}
      </p>
    </div>
  );
}

function nextEpisode(show: TitleDetail | undefined, episodes: Episode[] | undefined, season: number, episode: number) {
  if (!show || show.mediaType !== 'tv') return null;
  const inSeason = episodes?.find((x) => x.episodeNumber === episode + 1);
  if (inSeason) return { season, episode: episode + 1, name: inSeason.name };
  const current = show.seasons.find((x) => x.seasonNumber === season);
  if (current && episode < current.episodeCount) return { season, episode: episode + 1, name: '' };
  const following = show.seasons.find((x) => x.seasonNumber > season);
  return following ? { season: following.seasonNumber, episode: 1, name: '' } : null;
}
