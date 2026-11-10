import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { PersonSummary, TitleSummary } from '../core/models';
import { Img } from '../components/Img';
import { PosterCard, PosterSkeleton } from '../components/PosterCard';
import { QueryRail } from '../components/QueryRail';
import { EmptyState, ErrorState } from '../components/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useQuery } from '../hooks/useQuery';
import { GRID } from './Browse';

export default function Search() {
  const client = useTmdb();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const input = useRef<HTMLInputElement>(null);
  useDocumentTitle(q ? `Search: ${q}` : 'Search');

  useEffect(() => {
    // Autofocus only with a precise pointer, so phones do not pop the keyboard unasked.
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus({ preventScroll: true });
  }, []);

  // Debounce typing into the URL so results are shareable and Back works.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = text.trim();
      if (trimmed === q) return;
      setParams(trimmed ? { q: trimmed } : {}, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, q, setParams]);

  const { data, error, loading, retry } = useQuery((s) => client.search(q, 1, s), [q], q.length > 0);
  const titles = (data?.results ?? []).filter((r) => r.kind === 'title').map((r) => r.item as TitleSummary);
  const people = (data?.results ?? []).filter((r) => r.kind === 'person').map((r) => r.item as PersonSummary);
  const stale = loading && q.length > 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-24 md:px-12 md:pt-28">
      <h1 className="sr-only">Search</h1>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(text.trim() ? { q: text.trim() } : {}, { replace: true });
          input.current?.blur();
        }}
        className="relative max-w-2xl"
      >
        <label htmlFor="search-input" className="mb-2 block text-sm font-medium text-text-2">
          Search films, series and people
        </label>
        <MagnifyingGlass size={20} className="pointer-events-none absolute bottom-[18px] left-5 text-text-3" aria-hidden />
        <input
          id="search-input"
          ref={input}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Try Dune or Hayao Miyazaki…"
          className="h-14 w-full rounded-full border border-line-strong bg-surface pl-13 pr-14 text-lg text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)] [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setText('');
              input.current?.focus();
            }}
            className="press absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-surface-2 text-text-2 hover:text-text"
          >
            <X size={14} weight="bold" aria-hidden />
          </button>
        )}
      </form>

      <div aria-live="polite" className="sr-only">
        {q && !loading && data ? `${data.totalResults} results for ${q}` : ''}
      </div>

      {!q ? (
        <div className="-mx-4 mt-12 md:-mx-12">
          <QueryRail id="search-trending" title="Trending Searches" eager showType load={(s) => client.trending('all', 'day', s)} />
        </div>
      ) : error ? (
        <div className="mt-10">
          <ErrorState error={error} onRetry={retry} />
        </div>
      ) : !loading && data && titles.length === 0 && people.length === 0 ? (
        <EmptyState title={`No results for "${q}"`} body="Check the spelling, or search for a person or a different title." />
      ) : (
        <div className={`transition-opacity ${stale && data ? 'opacity-60' : ''}`}>
          {people.length > 0 && (
            <section aria-labelledby="people-heading" className="mt-10">
              <h2 id="people-heading" className="t-title2">
                People
              </h2>
              <ul className="rail -mx-4 mt-4 flex gap-4 overflow-x-auto px-4">
                {people.slice(0, 12).map((p) => (
                  <li key={p.id} className="w-24 shrink-0 md:w-28">
                    <Link to={`/person/${p.id}`} className="press group block">
                      <div className="aspect-square overflow-hidden rounded-full bg-surface-2">
                        <Img path={p.profilePath} size="w185" alt="" fallback={p.name} className="size-full" />
                      </div>
                      <p className="mt-2 truncate text-center text-sm font-medium">{p.name}</p>
                      {p.knownForDepartment && <p className="truncate text-center text-xs text-text-3">{p.knownForDepartment}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="titles-heading" className="mt-10">
            <h2 id="titles-heading" className="t-title2">
              Films and Series
            </h2>
            <div className={`mt-5 ${GRID}`}>
              {titles.length
                ? titles.map((t) => <PosterCard key={`${t.mediaType}-${t.id}`} item={t} showType />)
                : Array.from({ length: 14 }, (_, i) => <PosterSkeleton key={i} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
