import { CaretDown, X } from '@phosphor-icons/react';
import { animate } from 'animejs';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTmdb } from '../../app-context';
import type { TitleDetail } from '../../core/models';
import { useQuery } from '../../hooks/useQuery';
import { runtime } from '../../lib/format';
import { prefersReducedMotion, springs } from '../../lib/motion';
import { Img } from '../Img';
import { ControlButton } from './ControlButton';

interface Props {
  open: boolean;
  onClose: () => void;
  show: TitleDetail;
  season: number;
  episode: number;
}

/**
 * Side sheet listing episodes. It enters from the right edge and leaves the
 * same way, as a parallel panel (no scrim) so the stage stays visible.
 */
export function EpisodeSheet({ open, onClose, show, season, episode }: Props) {
  const client = useTmdb();
  const ref = useRef<HTMLElement>(null);
  const [viewSeason, setViewSeason] = useState(season);
  const selectId = useId();
  const { data: episodes, loading } = useQuery((s) => client.season(show.id, viewSeason, s), [show.id, viewSeason], open);

  useEffect(() => setViewSeason(season), [season]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = prefersReducedMotion();
    if (open) {
      el.hidden = false;
      animate(el, reduce ? { opacity: [0, 1], duration: 160 } : { translateX: ['104%', '0%'], opacity: [0.6, 1], ease: springs.default() });
      el.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
      el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    } else if (!el.hidden) {
      animate(el, reduce ? { opacity: 0, duration: 120 } : { translateX: '104%', ease: springs.snappy() }).then(() => {
        el.hidden = true;
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  return (
    <aside
      ref={ref}
      hidden
      aria-label="Episodes"
      className="glass-dark absolute inset-y-3 right-3 z-40 flex w-[min(400px,calc(100vw-24px))] flex-col rounded-[var(--radius-panel)] text-white"
    >
      <div className="flex items-center gap-2 p-3 pl-5">
        <div className="relative mr-auto">
          <label htmlFor={selectId} className="sr-only">
            Season
          </label>
          <select
            id={selectId}
            value={viewSeason}
            onChange={(e) => setViewSeason(Number(e.target.value))}
            className="h-10 cursor-pointer appearance-none rounded-full bg-white/10 pl-4 pr-9 text-sm font-medium text-white [color-scheme:dark]"
          >
            {show.seasons.map((s) => (
              <option key={s.seasonNumber} value={s.seasonNumber}>
                {s.name}
              </option>
            ))}
          </select>
          <CaretDown size={12} weight="bold" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden />
        </div>
        <ControlButton label="Close episodes" onClick={onClose}>
          <X size={18} weight="bold" aria-hidden />
        </ControlButton>
      </div>
      <ol className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {loading && !episodes
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex gap-3 p-2" aria-hidden>
                <div className="aspect-video w-32 shrink-0 rounded-[10px] bg-white/10" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3.5 w-3/4 rounded-full bg-white/10" />
                  <div className="h-3 w-1/3 rounded-full bg-white/10" />
                </div>
              </li>
            ))
          : (episodes ?? []).map((ep) => {
              const current = ep.seasonNumber === season && ep.episodeNumber === episode;
              return (
                <li key={ep.id}>
                  <Link
                    to={`/watch/tv/${show.id}/${ep.seasonNumber}/${ep.episodeNumber}`}
                    replace
                    aria-current={current}
                    onClick={onClose}
                    className={`press flex gap-3 rounded-[12px] p-2 ${current ? 'bg-white/14' : 'hover:bg-white/8'}`}
                  >
                    <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-[10px] bg-white/5">
                      <Img path={ep.stillPath ?? show.backdropPath} size="w300" alt="" fallback={String(ep.episodeNumber)} className="size-full !bg-white/5" />
                      {current && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" aria-hidden />}
                    </div>
                    <div className="min-w-0 py-0.5">
                      <p className="truncate text-sm font-medium">
                        <span className="text-white/55 tnum">{ep.episodeNumber}.</span> {ep.name}
                      </p>
                      <p className="mt-0.5 text-xs text-white/55 tnum">{runtime(ep.runtime) ?? ''}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-white/70">{ep.overview}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
      </ol>
    </aside>
  );
}
