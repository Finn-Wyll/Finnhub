import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { TitleSummary } from '../core/models';
import { Img } from './Img';
import { Rating } from './Rating';

export const titleHref = (t: Pick<TitleSummary, 'mediaType' | 'id'>) => `/title/${t.mediaType}/${t.id}`;

interface Props {
  item: TitleSummary;
  priority?: boolean;
  /** Width class for rails. Grids leave it unset to fill their cell. */
  widthClass?: string;
  showType?: boolean;
}

export const PosterCard = memo(function PosterCard({ item, priority, widthClass = '', showType }: Props) {
  return (
    <Link
      to={titleHref(item)}
      className={`group/card press relative block shrink-0 rounded-[var(--radius-card)] ${widthClass}`}
      data-enter
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-card)] bg-surface-2 ring-1 ring-line ring-inset">
        <Img
          path={item.posterPath}
          size="w342"
          srcSizes={['w185', 'w342', 'w500']}
          sizes="(min-width: 1024px) 200px, 40vw"
          alt=""
          fallback={item.title}
          priority={priority}
          className="absolute inset-0 size-full transition-transform duration-500 ease-out group-hover/card:scale-[1.04]"
        />
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-[0.9375rem] font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-text-3">
          {item.year && <span className="tnum">{item.year}</span>}
          {showType && <span>{item.mediaType === 'movie' ? 'Film' : 'Series'}</span>}
          {item.voteCount > 20 && <Rating value={item.rating} className="text-text-2" />}
        </p>
      </div>
    </Link>
  );
});

export function PosterSkeleton({ widthClass = '' }: { widthClass?: string }) {
  return (
    <div className={`shrink-0 ${widthClass}`} aria-hidden>
      <div className="skeleton aspect-[2/3] rounded-[var(--radius-card)]" />
      <div className="skeleton mt-3 h-3.5 w-3/4 rounded-full" />
      <div className="skeleton mt-2 h-3 w-1/3 rounded-full" />
    </div>
  );
}
