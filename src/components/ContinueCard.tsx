import { X } from '@phosphor-icons/react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { continueTarget, episodeKey, watchedShare, type MediaProgress } from '../core/progress';
import { Img } from './Img';

/** Landscape card for Continue Watching: opens the player where it was left. */
export const ContinueCard = memo(function ContinueCard({ entry, onRemove }: { entry: MediaProgress; onRemove: () => void }) {
  const target = continueTarget(entry);
  const name = entry.title ?? (entry.type === 'movie' ? 'Film' : 'Series');
  const ep = entry.type === 'tv' && entry.last_season_watched && entry.last_episode_watched
    ? entry.show_progress?.[episodeKey(entry.last_season_watched, entry.last_episode_watched)]?.progress
    : undefined;
  const p = entry.type === 'movie' ? entry.progress : ep ?? entry.progress;

  // A finished episode has no known successor without the show's seasons, so it opens the title page.
  const href = !target
    ? `/title/tv/${entry.id}`
    : entry.type === 'movie'
      ? `/watch/movie/${entry.id}`
      : `/watch/tv/${entry.id}/${target.season}/${target.episode}`;
  const left = Math.max(1, Math.round((p.duration - p.watched) / 60));
  const detail = !target
    ? 'Next episode'
    : entry.type === 'tv'
      ? `S${target.season} E${target.episode}, ${left} min left`
      : `${left} min left`;
  const share = target ? watchedShare(p) : 1;

  return (
    <div className="group/card relative w-[72vw] shrink-0 sm:w-[44vw] md:w-[300px] lg:w-[320px]" data-enter>
      <Link to={href} className="press block rounded-[var(--radius-card)]" aria-label={`${target ? 'Continue' : 'Open'} ${name}, ${detail}`}>
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-surface-2 ring-1 ring-line ring-inset">
          <Img
            path={entry.backdrop_path ?? entry.poster_path}
            size="w780"
            alt=""
            fallback={name}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04]"
          />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
          </div>
        </div>
        <div className="mt-2.5 px-0.5">
          <p className="truncate text-[0.9375rem] font-medium leading-snug">{name}</p>
          <p className="mt-0.5 truncate text-sm text-text-3 tnum">{detail}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name} from Continue Watching`}
        title="Remove"
        className="press glass-dark absolute right-2 top-2 grid size-8 place-items-center rounded-full text-white opacity-0 outline-offset-2 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <X size={14} weight="bold" aria-hidden />
      </button>
    </div>
  );
});
