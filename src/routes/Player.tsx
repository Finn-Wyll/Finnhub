import { ArrowLeft, Queue, SkipForward } from '@phosphor-icons/react';
import { animate } from 'animejs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { Episode, MediaType, TitleDetail } from '../core/models';
import { Img } from '../components/Img';
import { ErrorState } from '../components/States';
import { ControlButton } from '../components/player/ControlButton';
import { EpisodeSheet } from '../components/player/EpisodeSheet';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useQuery } from '../hooks/useQuery';
import { enter, prefersReducedMotion, springs } from '../lib/motion';
import NotFound from './NotFound';

const EMBED_BASE = 'https://vidfast.vc';

/** Embed URL for a TMDB id. The embedded page provides its own playback controls. */
function embedUrl(type: MediaType, id: number, season: number, episode: number) {
  return type === 'movie'
    ? `${EMBED_BASE}/movie/${id}?autoPlay=true`
    : `${EMBED_BASE}/tv/${id}/${season}/${episode}?autoPlay=true`;
}

export default function Player() {
  const { type, id, season, episode } = useParams();
  const mediaType: MediaType | null = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : null;
  const tid = Number(id);
  const s = Number(season ?? 1);
  const e = Number(episode ?? 1);
  if (!mediaType || !Number.isInteger(tid) || (mediaType === 'tv' && (!Number.isInteger(s) || !Number.isInteger(e)))) return <NotFound />;
  return <PlayerView key={`${mediaType}-${tid}`} type={mediaType} id={tid} season={s} episode={e} />;
}

function PlayerView({ type, id, season, episode }: { type: MediaType; id: number; season: number; episode: number }) {
  const client = useTmdb();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: title, error, retry } = useQuery((sig) => client.detail(type, id, sig), [type, id]);
  const { data: episodes } = useQuery((sig) => client.season(id, season, sig), [id, season], type === 'tv');
  const ep = episodes?.find((x) => x.episodeNumber === episode);
  const [sheet, setSheet] = useState(false);
  const frameKey = `${season}-${episode}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loaded = loadedKey === frameKey;
  const barRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useDocumentTitle(title ? (type === 'tv' ? `${title.title} S${season} E${episode}` : title.title) : 'Player');

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

  // The top bar settles in once on open, so the stage is the first thing the eye lands on.
  useEffect(() => {
    if (!barRef.current) return;
    const anim = enter(barRef.current, { distance: -8 });
    return () => {
      anim?.revert();
    };
  }, []);

  // A new episode is a new embed, so it shows its placeholder until it reports in.
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

  const next = useMemo(() => nextEpisode(title, episodes, season, episode), [title, episodes, season, episode]);
  const nextHref = next ? `/watch/tv/${id}/${next.season}/${next.episode}` : null;

  const exit = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/title/${type}/${id}`);
  };

  // Shortcuts for the chrome around the embed. Keys pressed inside the embed stay with it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'e' && type === 'tv') setSheet((v) => !v);
      else if (k === 'n' && nextHref) navigate(nextHref, { replace: true });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [type, nextHref, navigate]);

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#08080a] p-6 [color-scheme:dark]">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const label = title?.title ?? '';
  const subtitle = type === 'tv' ? `S${season} E${episode}${ep ? `  ${ep.name}` : ''}` : title?.year ? String(title.year) : '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#08080a] text-white [color-scheme:dark]">
      <h1 className="sr-only">
        {label} {subtitle}
      </h1>

      {/* Top bar. It sits above the stage so it never covers the embedded player's controls. */}
      <div
        ref={barRef}
        className="flex shrink-0 items-center gap-3 py-3 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))] md:pl-[max(24px,env(safe-area-inset-left))] md:pr-[max(24px,env(safe-area-inset-right))]"
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
        {type === 'tv' && title && (
          <ControlButton label="Episodes" active={sheet} aria-expanded={sheet} onClick={() => setSheet((v) => !v)}>
            <Queue size={22} aria-hidden />
          </ControlButton>
        )}
        {nextHref && (
          <Link
            to={nextHref}
            replace
            aria-label="Next episode"
            title="Next episode (N)"
            className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium outline-offset-2 hover:bg-white/16 focus-visible:bg-white/16 sm:px-4"
          >
            <SkipForward size={20} weight="fill" aria-hidden />
            <span className="hidden sm:inline">Next episode</span>
          </Link>
        )}
      </div>

      {/* Stage: the embedded player, letterboxed to 16:9 inside whatever space the bar leaves. */}
      <div className="relative grid min-h-0 flex-1 place-items-center pb-[env(safe-area-inset-bottom)] [container-type:size]">
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
          <p className="sr-only" aria-live="polite">
            {loaded ? 'Player ready' : 'Loading player…'}
          </p>
          <iframe
            ref={frameRef}
            key={frameKey}
            title={label ? `${label} video player` : 'Video player'}
            src={embedUrl(type, id, season, episode)}
            onLoad={() => setLoadedKey(frameKey)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
            className={`absolute inset-0 size-full border-0 bg-black ${loaded ? '' : 'opacity-0'}`}
          />
        </div>
      </div>

      {type === 'tv' && title && <EpisodeSheet open={sheet} onClose={() => setSheet(false)} show={title} season={season} episode={episode} />}
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
