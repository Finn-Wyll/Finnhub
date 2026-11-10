import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsIn,
  ArrowsOut,
  ClockClockwise,
  ClockCounterClockwise,
  ClosedCaptioning,
  GearSix,
  Pause,
  Play,
  Queue,
  SkipForward,
  SlidersHorizontal,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSlash,
} from '@phosphor-icons/react';
import { animate } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
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
 * Player. VidFast plays the media in an iframe; our chrome drives it through
 * VidFast's postMessage API and reflects the state it reports back. Anything
 * the API cannot do (server, quality) is reached by handing over to VidFast's
 * own controls.
 */
export default function Player() {
  const { type, id, season, episode } = useParams();
  const mediaType: MediaType | null = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : null;
  const tid = Number(id);
  const s = Number(season ?? 1);
  const e = Number(episode ?? 1);
  if (!mediaType || !Number.isInteger(tid) || (mediaType === 'tv' && (!Number.isInteger(s) || !Number.isInteger(e)))) return <NotFound />;
  return <PlayerView key={`${mediaType}-${tid}`} type={mediaType} id={tid} season={s} episode={e} />;
}

type Menu = 'settings' | 'captions' | null;

const SUBTITLES = [
  { id: null, label: 'Off' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
] as const;

/** If the embed never answers our status requests, hand over to its own controls. */
const NO_ANSWER_MS = 12000;

function PlayerView({ type, id, season, episode }: { type: MediaType; id: number; season: number; episode: number }) {
  const client = useTmdb();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: title, error, retry } = useQuery((sig) => client.detail(type, id, sig), [type, id]);
  const { data: episodes } = useQuery((sig) => client.season(id, season, sig), [id, season], type === 'tv');
  const ep = episodes?.find((x) => x.episodeNumber === episode);

  useDocumentTitle(title ? (type === 'tv' ? `${title.title} S${season} E${episode}` : title.title) : 'Player');

  const root = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const settingsBtn = useRef<HTMLButtonElement>(null);
  const captionsBtn = useRef<HTMLButtonElement>(null);
  const upNextRef = useRef<HTMLAnchorElement>(null);

  // Embed source. Changing subtitles reloads the embed at the current position.
  const epKey = `${season}-${episode}`;
  const [sub, setSub] = useState<string | null>(null);
  const [resume, setResume] = useState<{ ep: string; at: number } | null>(null);
  const startAt = resume?.ep === epKey ? resume.at : 0;
  const src = vidfastUrl(type, id, season, episode, { sub, startAt });
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;

  const next = useMemo(() => nextEpisode(title, episodes, season, episode), [title, episodes, season, episode]);
  const nextHref = next ? `/watch/tv/${id}/${next.season}/${next.episode}` : null;

  const { status, controls } = useVidfast(frameRef, src, () => {
    if (nextHref) navigate(nextHref, { replace: true });
  });
  const { playing, duration, volume, muted } = status;

  const [native, setNative] = useState(false);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState<Menu>(null);
  const [sheet, setSheet] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ icon: 'play' | 'pause' | 'back' | 'fwd'; n: number } | null>(null);
  const time = drag ?? status.currentTime;

  // Controls hide after 3s of inactivity while playing and nothing is open.
  const idleTimer = useRef<number>(undefined);
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 3000);
  }, []);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  const chromeVisible = native || !playing || !idle || menu !== null || sheet || drag !== null;

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

  // State transition: the embed materialises over its placeholder once it has loaded.
  useEffect(() => {
    const el = frameRef.current;
    if (!loaded || !el) return;
    const anim = prefersReducedMotion()
      ? animate(el, { opacity: [0, 1], duration: 180, ease: 'linear' })
      : animate(el, { opacity: [0, 1], scale: [0.985, 1], ease: springs.default() });
    return () => {
      anim.revert();
    };
  }, [loaded]);

  // Fallback: an embed that never reports in cannot be driven, so give its own controls back.
  useEffect(() => {
    if (!loaded || status.ready || native) return;
    const t = window.setTimeout(() => {
      setNative(true);
      setNotice('The player did not respond, so its own controls are shown.');
    }, NO_ANSWER_MS);
    return () => window.clearTimeout(t);
  }, [loaded, status.ready, native, src]);

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

  const togglePlay = () => {
    if (playing) controls.pause();
    else controls.play();
    showFlash(playing ? 'pause' : 'play');
    wake();
  };

  const skip = (delta: number) => {
    controls.seek(status.currentTime + delta);
    showFlash(delta < 0 ? 'back' : 'fwd');
    wake();
  };

  const setVolume = (level: number) => {
    controls.volume(level);
    wake();
  };

  const chooseSubtitles = (lang: string | null) => {
    if (lang === sub) return;
    setResume({ ep: epKey, at: status.currentTime });
    setSub(lang);
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

  // The up-next card rises in when it appears, so the change is noticed without being abrupt.
  const upNextShown = type === 'tv' && !!next && !native && duration > 0 && duration - time <= 25 && time > 0;
  useEffect(() => {
    if (!upNextShown || !upNextRef.current) return;
    const anim = enter(upNextRef.current, { distance: 12 });
    return () => {
      anim?.revert();
    };
  }, [upNextShown]);

  // Keyboard shortcuts, YouTube/Apple TV style. Keys pressed inside the embed stay with it.
  const current = { togglePlay, skip, setVolume, toggleFullscreen, toggleMute: () => controls.mute(!muted), volume, native, type, nextHref };
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
      else if (k === 'arrowup') a.setVolume(a.volume + 0.1);
      else if (k === 'arrowdown') a.setVolume(a.volume - 0.1);
      else if (k === 'm') a.toggleMute();
      else if (k === 'f') void a.toggleFullscreen();
      else if (k === 'c' && !a.native) setMenu((m) => (m === 'captions' ? null : 'captions'));
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
  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon = effectiveVolume === 0 ? SpeakerSlash : effectiveVolume < 0.5 ? SpeakerLow : SpeakerHigh;
  const showUpNext = upNextShown;

  const titleBlock = (
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
  );

  const episodesButton = type === 'tv' && title && (
    <ControlButton label="Episodes" active={sheet} aria-expanded={sheet} onClick={() => setSheet((v) => !v)}>
      <Queue size={22} aria-hidden />
    </ControlButton>
  );

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

  const fullscreenButton = (
    <ControlButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => void toggleFullscreen()}>
      {fullscreen ? <ArrowsIn size={22} aria-hidden /> : <ArrowsOut size={22} aria-hidden />}
    </ControlButton>
  );

  return (
    <div
      ref={root}
      onPointerMove={native ? undefined : wake}
      onPointerDown={native ? undefined : wake}
      className={`fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-[#08080a] text-white [color-scheme:dark] ${chromeVisible ? '' : 'cursor-none'}`}
    >
      <h1 className="sr-only">
        {label} {subtitle}
      </h1>

      {/* VidFast's own controls: our bar moves above the stage so it never covers them. */}
      {native && (
        <div className="flex shrink-0 items-center gap-2 py-3 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))] md:gap-3">
          <ControlButton label="Exit player" onClick={exit} className="bg-white/10 backdrop-blur-md">
            <ArrowLeft size={20} weight="bold" aria-hidden />
          </ControlButton>
          {titleBlock}
          {episodesButton}
          {nextLink}
          {fullscreenButton}
          <button
            type="button"
            onClick={() => {
              setNative(false);
              setNotice('');
            }}
            className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium outline-offset-2 hover:bg-white/16 focus-visible:bg-white/16"
          >
            <SlidersHorizontal size={18} aria-hidden />
            <span className="hidden sm:inline">Custom Controls</span>
            <span className="sm:hidden">Custom</span>
          </button>
        </div>
      )}

      {native && notice && <p className="shrink-0 px-[max(16px,env(safe-area-inset-left))] pb-2 text-sm text-white/70">{notice}</p>}

      {/* Stage: the embed, letterboxed to 16:9 inside whatever space is left. */}
      <div className="relative grid min-h-0 flex-1 place-items-center [container-type:size]">
        <div className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] overflow-hidden bg-black">
          {!loaded && (
            <div className="absolute inset-0" aria-hidden>
              {title?.backdropPath && (
                <Img path={ep?.stillPath ?? title.backdropPath} size="w1280" alt="" priority className="size-full object-cover opacity-30" />
              )}
              <div className="absolute inset-0 grid place-items-center">
                <div className="skeleton h-1 w-40 overflow-hidden rounded-full opacity-60" />
              </div>
            </div>
          )}
          <iframe
            ref={frameRef}
            key={src}
            title={label ? `${label} video player` : 'Video player'}
            src={src}
            onLoad={() => setLoadedSrc(src)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
            className={`absolute inset-0 size-full border-0 bg-black ${loaded ? '' : 'opacity-0'}`}
          />
        </div>
      </div>

      {!native && (
        <>
          {/* Click layer over the embed: single click toggles, double click toggles fullscreen. */}
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={(e) => {
              if (e.detail === 1) togglePlay();
            }}
            onDoubleClick={() => void toggleFullscreen()}
          />

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
              {titleBlock}
            </div>

            {/* Centre transport */}
            <div className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-6 md:gap-10`}>
              <ControlButton label="Back 10 seconds" size="lg" onClick={() => skip(-10)} className="bg-black/25 backdrop-blur-md">
                <ArrowCounterClockwise size={32} aria-hidden />
                <span className="absolute pt-0.5 text-[10px] font-semibold tnum" aria-hidden>
                  10
                </span>
              </ControlButton>
              <ControlButton label={playing ? 'Pause' : 'Play'} size="xl" onClick={togglePlay} className="bg-white/14 backdrop-blur-xl hover:bg-white/20">
                {playing ? <Pause size={34} weight="fill" aria-hidden /> : <Play size={34} weight="fill" aria-hidden />}
              </ControlButton>
              <ControlButton label="Forward 10 seconds" size="lg" onClick={() => skip(10)} className="bg-black/25 backdrop-blur-md">
                <ArrowClockwise size={32} aria-hidden />
                <span className="absolute pt-0.5 text-[10px] font-semibold tnum" aria-hidden>
                  10
                </span>
              </ControlButton>
            </div>

            {/* Bottom bar */}
            <div
              className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute inset-x-0 bottom-0 pb-[max(16px,env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] md:pb-6 md:pl-[max(24px,env(safe-area-inset-left))] md:pr-[max(24px,env(safe-area-inset-right))]`}
            >
              <div className="flex items-center gap-3 font-mono text-xs text-white/80 tnum md:gap-4">
                <span className="w-14 text-right">{clock(time)}</span>
                <div className="flex-1">
                  <Scrubber
                    value={time}
                    duration={duration}
                    buffered={time}
                    previewPath={ep?.stillPath ?? title?.backdropPath ?? null}
                    onScrubStart={() => setDrag(status.currentTime)}
                    onSeek={(v) => {
                      if (drag !== null) setDrag(v);
                      else controls.seek(v);
                      wake();
                    }}
                    onScrubEnd={() => {
                      if (drag !== null) controls.seek(drag);
                      setDrag(null);
                    }}
                  />
                </div>
                <span className="w-14">{duration ? `-${clock(duration - time)}` : '--:--'}</span>
              </div>

              <div className="mt-2 flex items-center gap-1 md:gap-2">
                <ControlButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
                  {playing ? <Pause size={22} weight="fill" aria-hidden /> : <Play size={22} weight="fill" aria-hidden />}
                </ControlButton>
                {nextLink}
                <div className="group/vol flex items-center">
                  <ControlButton label={muted ? 'Unmute' : 'Mute'} onClick={() => controls.mute(!muted)}>
                    <VolumeIcon size={22} aria-hidden />
                  </ControlButton>
                  <div className="w-0 overflow-hidden transition-[width] duration-300 group-focus-within/vol:w-24 group-hover/vol:w-24">
                    <div className="relative mx-2 flex h-6 w-20 items-center">
                      <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/25" aria-hidden>
                        <div className="h-full bg-white" style={{ width: `${effectiveVolume * 100}%` }} />
                      </div>
                      <input
                        type="range"
                        className="scrub absolute inset-x-0"
                        min={0}
                        max={100}
                        value={Math.round(effectiveVolume * 100)}
                        aria-label="Volume"
                        aria-valuetext={`${Math.round(effectiveVolume * 100)}%`}
                        onChange={(e) => setVolume(Number(e.target.value) / 100)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-1 md:gap-2">
                  {episodesButton}
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
                  <div className="relative">
                    <ControlButton
                      ref={settingsBtn}
                      label="Playback settings"
                      active={menu === 'settings'}
                      aria-expanded={menu === 'settings'}
                      aria-haspopup="dialog"
                      onClick={() => setMenu((m) => (m === 'settings' ? null : 'settings'))}
                    >
                      <GearSix size={22} aria-hidden />
                    </ControlButton>
                    <Popover open={menu === 'settings'} onClose={() => setMenu(null)} anchor={settingsBtn.current} label="Playback settings">
                      <button
                        type="button"
                        onClick={() => {
                          setMenu(null);
                          setNative(true);
                        }}
                        className="press flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left hover:bg-white/10 focus-visible:bg-white/10"
                      >
                        <SlidersHorizontal size={20} className="shrink-0" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem]">Server &amp; Quality</span>
                          <span className="block text-xs text-white/55">Opens VidFast&rsquo;s own controls</span>
                        </span>
                      </button>
                    </Popover>
                  </div>
                  {fullscreenButton}
                </div>
              </div>
            </div>
          </div>

          {showUpNext && nextHref && (
            <Link
              ref={upNextRef}
              to={nextHref}
              replace
              className="press glass-dark absolute bottom-32 right-4 z-30 flex w-72 items-center gap-3 rounded-[var(--radius-panel)] p-3 md:right-6"
            >
              <SkipForward size={22} weight="fill" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs text-white/60">Up next in {Math.max(0, Math.ceil(duration - time))}s</p>
                <p className="truncate text-sm font-medium">
                  S{next!.season} E{next!.episode}
                  {next!.name ? `  ${next!.name}` : ''}
                </p>
              </div>
            </Link>
          )}
        </>
      )}

      {type === 'tv' && title && <EpisodeSheet open={sheet} onClose={() => setSheet(false)} show={title} season={season} episode={episode} />}

      <p className="sr-only" aria-live="polite">
        {notice || (!loaded ? 'Loading player…' : playing ? 'Playing' : 'Paused')}
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
