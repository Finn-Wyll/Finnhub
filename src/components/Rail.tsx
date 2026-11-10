import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from './Button';

interface Props {
  title: string;
  href?: string;
  children: ReactNode;
  id?: string;
}

/**
 * Horizontal rail with native momentum scrolling + scroll-snap (the browser's
 * own projection physics), plus paging buttons for pointer users.
 */
export function Rail({ title, href, children, id }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Edge detection with IntersectionObserver on the first/last item: no scroll listeners.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const first = el.firstElementChild;
    const last = el.lastElementChild;
    if (!first || !last) return;
    const io = new IntersectionObserver(
      (entries) => {
        setEdges((prev) => {
          const next = { ...prev };
          for (const e of entries) {
            if (e.target === first) next.start = e.intersectionRatio > 0.9;
            if (e.target === last) next.end = e.intersectionRatio > 0.9;
          }
          return next.start === prev.start && next.end === prev.end ? prev : next;
        });
      },
      { root: el, threshold: [0, 0.9, 1] },
    );
    io.observe(first);
    io.observe(last);
    return () => io.disconnect();
  }, [children]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  };

  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section aria-labelledby={headingId} className="relative">
      <div className="mx-auto flex max-w-[1600px] items-end justify-between gap-4 px-4 md:px-12">
        <h2 id={headingId} className="t-title2">
          {href ? (
            <Link to={href} className="group inline-flex items-center gap-1 hover:text-text-2">
              {title}
              <CaretRight size={18} weight="bold" className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            title
          )}
        </h2>
        <div className="hidden gap-2 md:flex">
          <IconButton label={`Scroll ${title} back`} onClick={() => page(-1)} disabled={edges.start} className="disabled:opacity-30">
            <CaretLeft size={18} weight="bold" aria-hidden />
          </IconButton>
          <IconButton label={`Scroll ${title} forward`} onClick={() => page(1)} disabled={edges.end} className="disabled:opacity-30">
            <CaretRight size={18} weight="bold" aria-hidden />
          </IconButton>
        </div>
      </div>
      <div
        ref={track}
        className="rail relative mt-4 flex gap-3 overflow-x-auto px-4 pb-2 [--rail-pad:16px] md:gap-4 md:px-12 md:[--rail-pad:48px] min-[1696px]:px-[calc((100vw-1600px)/2+48px)]"
      >
        {children}
      </div>
    </section>
  );
}

export const RAIL_CARD = 'w-[38vw] sm:w-[28vw] md:w-[180px] lg:w-[196px]';
