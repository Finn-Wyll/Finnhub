import { useEffect, useRef, useState } from 'react';
import type { Page, TitleSummary } from '../core/models';
import { useQuery } from '../hooks/useQuery';
import { enter } from '../lib/motion';
import { PosterCard, PosterSkeleton } from './PosterCard';
import { RAIL_CARD, Rail } from './Rail';
import { ErrorState } from './States';

interface Props {
  title: string;
  href?: string;
  id: string;
  load: (signal: AbortSignal) => Promise<Page<TitleSummary> | TitleSummary[]>;
  showType?: boolean;
  /** Load immediately instead of when scrolled near. */
  eager?: boolean;
}

/** A rail that fetches its own data once it comes within a screen of the viewport. */
export function QueryRail({ title, href, id, load, showType, eager }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!!eager);

  useEffect(() => {
    if (visible || !sentinel.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [visible]);

  const { data, error, loading, retry } = useQuery(load, [id], visible);
  const items = (Array.isArray(data) ? data : data?.results ?? []).filter((t) => t.posterPath);

  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!items.length || !wrap.current) return;
    const cards = wrap.current.querySelectorAll('[data-enter]');
    const anim = enter(Array.from(cards).slice(0, 8), { stagger: 35, distance: 10 });
    return () => {
      anim?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0]);

  if (visible && !loading && !error && items.length === 0) return null;

  return (
    <div ref={sentinel}>
      <div ref={wrap}>
        <Rail title={title} href={href} id={id}>
          {error ? (
            <ErrorState error={error} onRetry={retry} compact />
          ) : items.length ? (
            items.map((t, i) => <PosterCard key={`${t.mediaType}-${t.id}`} item={t} widthClass={RAIL_CARD} showType={showType} priority={eager && i < 6} />)
          ) : (
            Array.from({ length: 8 }, (_, i) => <PosterSkeleton key={i} widthClass={RAIL_CARD} />)
          )}
        </Rail>
      </div>
    </div>
  );
}
