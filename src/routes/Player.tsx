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
  PictureInPicture,
  Play,
  Queue,
  SkipForward,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSlash,
} from '@phosphor-icons/react';
import { animate } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { Episode, MediaType, TitleDetail } from '../core/models';
import { ErrorState } from '../components/States';
import { ControlButton } from '../components/player/ControlButton';
import { EpisodeSheet } from '../components/player/EpisodeSheet';
import { MenuGroup, MenuOption, Popover } from '../components/player/Popover';
import { Scrubber } from '../components/player/Scrubber';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useQuery } from '../hooks/useQuery';
import { clock } from '../lib/format';
import { prefersReducedMotion, springs } from '../lib/motion';
import NotFound from './NotFound';

/**
 * Player mockup. The stage is an intentionally empty iframe; every control
 * around it is designed and interactive at the UI level (state, menus,
 * keyboard, fullscreen of the chrome) but nothing is wired to media playback.
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

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITIES = [
  { id: 'auto', label: 'Auto', detail: '1080p' },
  { id: '2160', label: '4K', detail: 'Dolby Vision' },
  { id: '1080', label: '1080p', detail: 'HD' },
  { id: '720', label: '720p' },
];
const AUDIO = [
  { id: 'en-51', label: 'English', detail: '5.1' },
  { id: 'en-ad', label: 'English', detail: 'Audio description' },
  { id: 'es', label: 'Spanish', detail: 'Stereo' },
  { id: 'fr', label: 'French', detail: 'Stereo' },
];
const CAPTIONS = [
  { id: 'off', label: 'Off' },
  { id: 'en', label: 'English' },
  { id: 'en-cc', label: 'English', detail: 'CC' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
];

function PlayerView({ type, id, season, episode }: { type: MediaType; id: number; season: number; episode: number }) {
  const client = useTmdb();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: title, error, retry } = useQuery((sig) => client.detail(type, id, sig), [type, id]);
  const { data: episodes } = useQuery((sig) => client.season(id, season, sig), [id, season], type === 'tv');
  const ep = episodes?.find((x) => x.episodeNumber === episode);

  useDocumentTitle(title ? (type === 'tv' ? `${title.title} S${season} E${episode}` : title.title) : 'Player');

  const root = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const settingsBtn = useRef<HTMLButtonElement>(null);
  const captionsBtn = useRef<HTMLButtonElement>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState('auto');
  const [audio, setAudio] = useState('en-51');
  const [captions, setCaptions] = useState('off');
  const [menu, setMenu] = useState<Menu>(null);
  const [sheet, setSheet] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [flash, setFlash] = useState<{ icon: 'play' | 'pause' | 'back' | 'fwd'; n: number } | null>(null);

  const duration = useMemo(() => {
    const minutes = type === 'tv' ? ep?.runtime ?? title?.runtime ?? 45 : title?.runtime ?? 110;
    return minutes * 60;
  }, [type, ep?.runtime, title?.runtime]);

  // Reset the mock clock per episode.
  useEffect(() => {
    setTime(0);
    setPlaying(false);
  }, [season, episode]);

  // Mock clock so the chrome can be judged in its "playing" state. No media is involved.
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setTime((v) => Math.min(duration, v + 0.25 * speed)), 250);
    return () => window.clearInterval(t);
  }, [playing, speed, duration]);
  useEffect(() => {
    if (time >= duration && playing) setPlaying(false);
  }, [time, duration, playing]);

  // Controls hide after 3s of inactivity while "playing" and nothing is open.
  const idleTimer = useRef<number>(undefined);
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 3000);
  }, []);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  const chromeVisible = !playing || !idle || menu !== null || sheet;

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

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const togglePlay = useCallback(() => {
    const next = !playingRef.current;
    setPlaying(next);
    showFlash(next ? 'play' : 'pause');
    wake();
  }, [wake]);

  const skip = useCallback(
    (delta: number) => {
      setTime((v) => Math.min(duration, Math.max(0, v + delta)));
      showFlash(delta < 0 ? 'back' : 'fwd');
      wake();
    },
    [duration, wake],
  );

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      /* Fullscreen can be blocked (iframes, permissions). The UI simply stays windowed. */
    }
  }, []);

  const next = useMemo(() => nextEpisode(title, episodes, season, episode), [title, episodes, season, episode]);
  const nextHref = next ? `/watch/tv/${id}/${next.season}/${next.episode}` : null;

  const exit = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/title/${type}/${id}`);
  };

  // Keyboard shortcuts, YouTube/Apple TV style.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range')) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') {
        if (tag === 'BUTTON' && k === ' ') return; // let focused buttons activate
        togglePlay();
      } else if (k === 'arrowleft' || k === 'j') skip(-10);
      else if (k === 'arrowright' || k === 'l') skip(10);
      else if (k === 'arrowup') setVolume((v) => Math.min(1, v + 0.1));
      else if (k === 'arrowdown') setVolume((v) => Math.max(0, v - 0.1));
      else if (k === 'm') setMuted((m) => !m);
      else if (k === 'f') void toggleFullscreen();
      else if (k === 'c') setCaptions((c) => (c === 'off' ? 'en' : 'off'));
      else if (k === 'e' && type === 'tv') setSheet((v) => !v);
      else if (k === 'n' && nextHref) navigate(nextHref, { replace: true });
      else return;
      e.preventDefault();
      wake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, skip, toggleFullscreen, nextHref, navigate, type, wake]);

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
  const showUpNext = type === 'tv' && next && duration - time <= 25 && time > 0;

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

      {/* Stage: the empty iframe, letterboxed to 16:9. */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative aspect-video max-h-full w-full max-w-[calc(100dvh*16/9)]">
          <iframe
            title={`${label} video`}
            srcDoc="<!doctype html><html style='background:#000;color-scheme:dark;height:100%'></html>"
            sandbox=""
            className="absolute inset-0 size-full border-0 bg-black"
          />
        </div>
      </div>

      {/* Click layer: single click toggles, double click toggles fullscreen. */}
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

      {/* Captions preview so the subtitle styling can be evaluated. */}
      {captions !== 'off' && (
        <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-6 transition-[bottom] duration-300 ${chromeVisible ? 'bottom-36' : 'bottom-14'}`}>
          <p className="max-w-3xl rounded-lg bg-black/70 px-3 py-1 text-center text-[clamp(1rem,1.6vw,1.5rem)] font-medium leading-snug">
            {captions.startsWith('es') ? '[Subtitulos de ejemplo]' : captions === 'fr' ? '[Exemple de sous-titres]' : '[Sample subtitle line]'}
          </p>
        </div>
      )}

      {/* Chrome */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden={!chromeVisible}
      >
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Top bar */}
        <div className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute inset-x-0 top-0 flex items-center gap-3 p-4 pt-[max(16px,env(safe-area-inset-top))] md:p-6`}>
          <ControlButton label="Exit player" onClick={exit} className="bg-white/10 backdrop-blur-md">
            <ArrowLeft size={20} weight="bold" aria-hidden />
          </ControlButton>
          <div className="min-w-0">
            {title ? (
              <>
                <Link to={`/title/${type}/${id}`} className="block truncate text-[1.0625rem] font-semibold hover:underline">
                  {label}
                </Link>
                {subtitle && <p className="truncate text-sm text-white/70">{subtitle}</p>}
              </>
            ) : (
              <div className="h-4 w-48 rounded-full bg-white/15" />
            )}
          </div>
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
        <div className={`${chromeVisible ? 'pointer-events-auto' : ''} absolute inset-x-0 bottom-0 px-[max(16px,env(safe-area-inset-left))] pb-[max(16px,env(safe-area-inset-bottom))] md:px-6 md:pb-6`}>
          <div className="flex items-center gap-3 font-mono text-xs text-white/80 tnum md:gap-4">
            <span className="w-14 text-right">{clock(time)}</span>
            <div className="flex-1">
              <Scrubber
                value={time}
                duration={duration}
                buffered={Math.min(duration, time + 240)}
                previewPath={ep?.stillPath ?? title?.backdropPath ?? null}
                onSeek={(v) => {
                  setTime(v);
                  wake();
                }}
              />
            </div>
            <span className="w-14">-{clock(duration - time)}</span>
          </div>

          <div className="mt-2 flex items-center gap-1 md:gap-2">
            <ControlButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
              {playing ? <Pause size={22} weight="fill" aria-hidden /> : <Play size={22} weight="fill" aria-hidden />}
            </ControlButton>
            {nextHref && (
              <ControlButton label="Next episode" onClick={() => navigate(nextHref, { replace: true })}>
                <SkipForward size={22} weight="fill" aria-hidden />
              </ControlButton>
            )}
            <div className="group/vol flex items-center">
              <ControlButton label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
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
                    onChange={(e) => {
                      setVolume(Number(e.target.value) / 100);
                      setMuted(false);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>

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
                  active={captions !== 'off'}
                  aria-expanded={menu === 'captions'}
                  aria-haspopup="dialog"
                  onClick={() => setMenu((m) => (m === 'captions' ? null : 'captions'))}
                >
                  <ClosedCaptioning size={22} weight={captions !== 'off' ? 'fill' : 'regular'} aria-hidden />
                </ControlButton>
                <Popover open={menu === 'captions'} onClose={() => setMenu(null)} anchor={captionsBtn.current} label="Subtitles" className="w-60">
                  <MenuGroup title="Subtitles">
                    {CAPTIONS.map((c) => (
                      <MenuOption key={c.id} checked={captions === c.id} onSelect={() => setCaptions(c.id)} detail={c.detail}>
                        {c.label}
                      </MenuOption>
                    ))}
                  </MenuGroup>
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
                  <MenuGroup title="Quality">
                    {QUALITIES.map((q) => (
                      <MenuOption key={q.id} checked={quality === q.id} onSelect={() => setQuality(q.id)} detail={q.detail}>
                        {q.label}
                      </MenuOption>
                    ))}
                  </MenuGroup>
                  <div className="mx-3 my-1 h-px bg-white/10" />
                  <MenuGroup title="Speed">
                    <div className="grid grid-cols-3 gap-1 px-1 pb-1">
                      {SPEEDS.map((sp) => (
                        <button
                          key={sp}
                          role="radio"
                          aria-checked={speed === sp}
                          onClick={() => setSpeed(sp)}
                          className={`press h-9 rounded-[10px] text-sm tnum ${speed === sp ? 'bg-white text-zinc-900' : 'hover:bg-white/10'}`}
                        >
                          {sp === 1 ? 'Normal' : `${sp}x`}
                        </button>
                      ))}
                    </div>
                  </MenuGroup>
                  <div className="mx-3 my-1 h-px bg-white/10" />
                  <MenuGroup title="Audio">
                    {AUDIO.map((a) => (
                      <MenuOption key={a.id} checked={audio === a.id} onSelect={() => setAudio(a.id)} detail={a.detail}>
                        {a.label}
                      </MenuOption>
                    ))}
                  </MenuGroup>
                </Popover>
              </div>
              <ControlButton label="Picture in picture" className="hidden sm:inline-grid">
                <PictureInPicture size={22} aria-hidden />
              </ControlButton>
              <ControlButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => void toggleFullscreen()}>
                {fullscreen ? <ArrowsIn size={22} aria-hidden /> : <ArrowsOut size={22} aria-hidden />}
              </ControlButton>
            </div>
          </div>
        </div>
      </div>

      {showUpNext && nextHref && (
        <Link
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

      {type === 'tv' && title && <EpisodeSheet open={sheet} onClose={() => setSheet(false)} show={title} season={season} episode={episode} />}

      <p className="sr-only" aria-live="polite">
        {playing ? 'Playing' : 'Paused'}
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
