import { CaretDown } from '@phosphor-icons/react';
import { useEffect, useId, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { MediaType, SortKey } from '../core/models';
import { Button } from '../components/Button';
import { PosterCard, PosterSkeleton } from '../components/PosterCard';
import { EmptyState, ErrorState } from '../components/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfinite } from '../hooks/useInfinite';
import { useQuery } from '../hooks/useQuery';
import { enter } from '../lib/motion';

const SORTS: { value: SortKey; label: string; tv?: boolean }[] = [
  { value: 'popularity.desc', label: 'Most popular', tv: true },
  { value: 'vote_average.desc', label: 'Highest rated', tv: true },
  { value: 'primary_release_date.desc', label: 'Newest', tv: true },
  { value: 'revenue.desc', label: 'Box office' },
];

export const GRID = 'grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 md:gap-x-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';

export default function Browse({ type }: { type: MediaType }) {
  const client = useTmdb();
  const [params, setParams] = useSearchParams();
  const genre = Number(params.get('genre')) || undefined;
  const sortParam = params.get('sort') as SortKey | null;
  const sort = SORTS.some((s) => s.value === sortParam && (type === 'movie' || s.tv)) ? (sortParam as SortKey) : 'popularity.desc';
  const heading = type === 'movie' ? 'Films' : 'Series';
  const sortId = useId();

  const genres = useQuery((s) => client.genres(type, s), [type]);
  const activeGenre = genres.data?.find((g) => g.id === genre);
  useDocumentTitle(activeGenre ? `${activeGenre.name} ${heading.toLowerCase()}` : heading);

  const list = useInfinite(
    (page, s) => client.discover(type, { genre, sort, page }, s),
    (t) => `${t.mediaType}-${t.id}`,
    [type, genre, sort],
  );

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Infinite scroll via sentinel.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && list.loadMore(), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [list.loadMore]);

  // First page enters with a short stagger.
  const grid = useRef<HTMLDivElement>(null);
  const firstPageReady = list.items.length > 0;
  useEffect(() => {
    if (!firstPageReady || !grid.current) return;
    const anim = enter(Array.from(grid.current.querySelectorAll('[data-enter]')).slice(0, 18), { stagger: 22, distance: 10 });
    return () => {
      anim?.revert();
    };
  }, [firstPageReady, type, genre, sort]);

  const visibleItems = list.items.filter((t) => t.posterPath);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-24 md:px-12 md:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="t-title1">{activeGenre ? `${activeGenre.name} ${heading.toLowerCase()}` : heading}</h1>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm text-text-2">
            Sort
          </label>
          <div className="relative">
            <select
              id={sortId}
              value={sort}
              onChange={(e) => update('sort', e.target.value === 'popularity.desc' ? null : e.target.value)}
              className="press glass h-10 cursor-pointer appearance-none rounded-full pl-4 pr-10 text-sm font-medium text-text"
            >
              {SORTS.filter((s) => type === 'movie' || s.tv).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <CaretDown size={14} weight="bold" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-2" aria-hidden />
          </div>
        </div>
      </div>

      <div role="group" aria-label="Genre" className="rail -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {[{ id: 0, name: 'All' }, ...(genres.data ?? [])].map((g) => {
          const active = (g.id || undefined) === genre;
          return (
            <button
              key={g.id}
              aria-pressed={active}
              onClick={() => update('genre', g.id ? String(g.id) : null)}
              className={`press h-9 shrink-0 rounded-full px-4 text-sm font-medium ${
                active ? 'bg-text text-bg' : 'border border-line bg-surface text-text-2 hover:text-text'
              }`}
            >
              {g.name}
            </button>
          );
        })}
        {genres.loading && !genres.data && Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-9 w-20 shrink-0 rounded-full" />)}
      </div>

      <div ref={grid} className={`mt-8 ${GRID}`} aria-busy={list.loading}>
        {visibleItems.map((t, i) => (
          <PosterCard key={`${t.mediaType}-${t.id}`} item={t} priority={i < 6} />
        ))}
        {list.loading && Array.from({ length: list.items.length ? 7 : 21 }, (_, i) => <PosterSkeleton key={`s${i}`} />)}
      </div>

      {list.error && (
        <div className="mt-8">
          <ErrorState error={list.error} onRetry={list.retry} />
        </div>
      )}
      {!list.loading && !list.error && visibleItems.length === 0 && (
        <EmptyState
          title="Nothing Matches These Filters"
          body="Try another genre or sort order."
          action={
            <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
              Clear Filters
            </Button>
          }
        />
      )}
      <div ref={sentinel} aria-hidden className="h-px" />
      {!list.hasMore && visibleItems.length > 0 && <p className="mt-12 text-center text-sm text-text-3">You have reached the end of this list.</p>}
    </div>
  );
}
