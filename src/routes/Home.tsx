import { useProgress, useTmdb, useWatchlist } from '../app-context';
import { ContinueCard } from '../components/ContinueCard';
import { continueTarget } from '../core/progress';
import { Hero, HeroSkeleton } from '../components/Hero';
import { QueryRail } from '../components/QueryRail';
import { PosterCard } from '../components/PosterCard';
import { RAIL_CARD, Rail } from '../components/Rail';
import { ErrorState } from '../components/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useQuery } from '../hooks/useQuery';

export default function Home() {
  const client = useTmdb();
  const { entries } = useWatchlist();
  const { all: progress, store } = useProgress();
  // In progress, or a series whose latest episode is done (the next one is a tap away).
  const continuing = Object.values(progress)
    .filter((p) => p.title && (continueTarget(p) || p.type === 'tv'))
    .sort((a, b) => b.last_updated - a.last_updated)
    .slice(0, 20);
  useDocumentTitle(null);

  const featured = useQuery((s) => client.trending('all', 'week', s), []);
  const heroItems = (featured.data?.results ?? []).filter((t) => t.backdropPath && t.overview).slice(0, 6);
  const seed = entries[0]?.item;

  return (
    <>
      {featured.error ? (
        <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-28 md:px-12">
          <ErrorState error={featured.error} onRetry={featured.retry} />
        </div>
      ) : heroItems.length ? (
        <Hero items={heroItems} />
      ) : (
        <HeroSkeleton />
      )}

      <div className="relative flex flex-col gap-10 pb-16 md:gap-14">
        {continuing.length > 0 && (
          <Rail id="continue" title="Continue Watching">
            {continuing.map((p) => (
              <ContinueCard key={`${p.type}-${p.id}`} entry={p} onRemove={() => store.remove(p.type, p.id)} />
            ))}
          </Rail>
        )}
        <QueryRail id="trending" title="Trending Today" eager showType load={(s) => client.trending('all', 'day', s)} />
        {entries.length > 0 && (
          <Rail id="your-list" title="Your Watchlist" href="/watchlist">
            {entries.slice(0, 20).map(({ item }) => (
              <PosterCard key={`${item.mediaType}-${item.id}`} item={item} widthClass={RAIL_CARD} showType />
            ))}
          </Rail>
        )}
        <QueryRail id="popular-movies" title="Popular Films" href="/movies" load={(s) => client.movieList('popular', 1, s)} />
        <QueryRail id="popular-tv" title="Popular Series" href="/tv" load={(s) => client.tvList('popular', 1, s)} />
        {seed && (
          <QueryRail
            id={`because-${seed.mediaType}-${seed.id}`}
            title={`Because You Saved ${seed.title}`}
            load={async (s) => (await client.detail(seed.mediaType, seed.id, s)).recommendations}
          />
        )}
        <QueryRail id="now-playing" title="In Cinemas Now" load={(s) => client.movieList('now_playing', 1, s)} />
        <QueryRail id="top-movies" title="Highest Rated Films" href="/movies?sort=vote_average.desc" load={(s) => client.movieList('top_rated', 1, s)} />
        <QueryRail id="on-air" title="New Episodes This Week" load={(s) => client.tvList('on_the_air', 1, s)} />
        <QueryRail id="top-tv" title="Highest Rated Series" href="/tv?sort=vote_average.desc" load={(s) => client.tvList('top_rated', 1, s)} />
        <QueryRail id="upcoming" title="Coming Soon" load={(s) => client.movieList('upcoming', 1, s)} />
      </div>
    </>
  );
}
