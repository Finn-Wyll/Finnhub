import { ArrowLeft, Queue, SkipForward } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { Episode, MediaType, TitleDetail } from '../core/models';
import { ErrorState } from '../components/States';
import { ControlButton } from '../components/player/ControlButton';
import { EpisodeSheet } from '../components/player/EpisodeSheet';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useQuery } from '../hooks/useQuery';
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

  const next = useMemo(() => nextEpisode(title, episodes, season, episode), [title, episodes, season, episode]);
  const nextHref = next ? `/watch/tv/${id}/${next.season}/${next.episode}` : null;

  const exit = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/title/${type}/${id}`);
  };

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
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] md:px-6">
        <ControlButton label="Exit player" onClick={exit} className="bg-white/10 backdrop-blur-md">
          <ArrowLeft size={20} weight="bold" aria-hidden />
        </ControlButton>
        <div className="min-w-0 flex-1">
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
        {type === 'tv' && title && (
          <ControlButton label="Episodes" active={sheet} aria-expanded={sheet} onClick={() => setSheet((v) => !v)}>
            <Queue size={22} aria-hidden />
          </ControlButton>
        )}
        {nextHref && (
          <ControlButton label="Next episode" onClick={() => navigate(nextHref, { replace: true })}>
            <SkipForward size={22} weight="fill" aria-hidden />
          </ControlButton>
        )}
      </div>

      {/* Stage: the embedded player, letterboxed to 16:9. */}
      <div className="relative grid min-h-0 flex-1 place-items-center">
        <div className="relative aspect-video max-h-full w-full max-w-[calc((100dvh-72px)*16/9)]">
          <iframe
            key={`${season}-${episode}`}
            title={`${label} video`}
            src={embedUrl(type, id, season, episode)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
            className="absolute inset-0 size-full border-0 bg-black"
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
