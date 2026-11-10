import { BookmarkSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { useWatchlist } from '../app-context';
import { LinkButton } from '../components/Button';
import { PosterCard } from '../components/PosterCard';
import { EmptyState } from '../components/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useEnter } from '../hooks/useEnter';
import { GRID } from './Browse';

type Filter = 'all' | 'movie' | 'tv';

export default function Watchlist() {
  const { entries } = useWatchlist();
  const [filter, setFilter] = useState<Filter>('all');
  useDocumentTitle('Watchlist');
  const shown = entries.filter((e) => filter === 'all' || e.item.mediaType === filter);
  const grid = useEnter<HTMLDivElement>('[data-enter]', filter, { stagger: 25 });

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-24 md:px-12 md:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="t-title1">Watchlist</h1>
        {entries.length > 0 && (
          <div role="group" aria-label="Filter" className="glass inline-flex rounded-full p-1">
            {(['all', 'movie', 'tv'] as Filter[]).map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`press h-8 rounded-full px-4 text-sm font-medium ${filter === f ? 'bg-text text-bg' : 'text-text-2 hover:text-text'}`}
              >
                {f === 'all' ? 'All' : f === 'movie' ? 'Films' : 'Series'}
              </button>
            ))}
          </div>
        )}
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon={<BookmarkSimple size={32} weight="duotone" aria-hidden />}
          title="Your Watchlist Is Empty"
          body="Open any film or series and choose Watchlist to save it here. Your list is stored in this browser."
          action={<LinkButton to="/">Browse Home</LinkButton>}
        />
      ) : shown.length === 0 ? (
        <EmptyState title={`No ${filter === 'movie' ? 'films' : 'series'} saved yet`} />
      ) : (
        <div ref={grid} className={`mt-8 ${GRID}`}>
          {shown.map(({ item }) => (
            <PosterCard key={`${item.mediaType}-${item.id}`} item={item} showType={filter === 'all'} />
          ))}
        </div>
      )}
    </div>
  );
}
