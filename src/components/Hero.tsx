import { Info, Play, FilmReel } from '@phosphor-icons/react';
import { animate, stagger } from 'animejs';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { TitleSummary } from '../core/models';
import { useQuery } from '../hooks/useQuery';
import { runtime } from '../lib/format';
import { prefersReducedMotion, springs } from '../lib/motion';
import { IconButton, LinkButton } from './Button';
import { Img } from './Img';
import { titleHref } from './PosterCard';
import { Rating } from './Rating';
import { TrailerDialog } from './TrailerDialog';

const ADVANCE_MS = 9000;

export const watchHref = (t: Pick<TitleSummary, 'mediaType' | 'id'>) =>
  t.mediaType === 'movie' ? `/watch/movie/${t.id}` : `/watch/tv/${t.id}/1/1`;

export function Hero({ items }: { items: TitleSummary[] }) {
  const client = useTmdb();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const trailerBtn = useRef<HTMLButtonElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const item = items[index];

  // Detail for the active slide: logo, runtime, genres, trailer.
  const { data: detail } = useQuery((s) => client.detail(item.mediaType, item.id, s), [item.mediaType, item.id]);
  const current = detail && detail.id === item.id ? detail : undefined;

  // Auto-advance, paused on hover / focus / hidden tab / reduced motion / open dialog.
  useEffect(() => {
    if (paused || trailerOpen || prefersReducedMotion() || items.length < 2) return;
    const bar = progress.current;
    const anim = bar ? animate(bar, { scaleX: [0, 1], duration: ADVANCE_MS, ease: 'linear' }) : null;
    const t = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % items.length);
    }, ADVANCE_MS);
    return () => {
      window.clearTimeout(t);
      anim?.pause();
    };
  }, [index, paused, trailerOpen, items.length]);

  // Copy enters each time the slide changes.
  useEffect(() => {
    if (!copy.current) return;
    const nodes = copy.current.querySelectorAll('[data-hero]');
    const reduce = prefersReducedMotion();
    const anim = animate(nodes, reduce
      ? { opacity: [0, 1], duration: 200, ease: 'linear' }
      : { opacity: [0, 1], translateX: [-18, 0], delay: stagger(60), ease: springs.default() });
    return () => {
      anim.revert();
    };
  }, [index, current?.logoPath]);

  const genres = current?.genres.slice(0, 2).map((g) => g.name) ?? [];
  const meta = [
    item.year ? String(item.year) : null,
    current?.certification,
    item.mediaType === 'movie' ? runtime(current?.runtime) : current?.numberOfSeasons ? `${current.numberOfSeasons} seasons` : null,
    ...genres,
  ].filter(Boolean) as string[];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured this week"
      className="relative isolate flex min-h-[min(88dvh,860px)] flex-col justify-end overflow-hidden"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Backdrops stacked; the active one cross-fades in. */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        {items.map((t, i) => (
          <Img
            key={`${t.mediaType}-${t.id}`}
            path={t.backdropPath}
            size="original"
            srcSizes={['w780', 'w1280']}
            sizes="100vw"
            alt=""
            priority={i === 0}
            className={`absolute inset-0 size-full !transition-[opacity] !duration-1000 ${i === index ? '' : '!opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/30 to-transparent" />
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] items-end gap-8 px-4 pb-10 pt-28 md:px-12 md:pb-14 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div ref={copy} key={`${item.mediaType}-${item.id}`} className="max-w-xl" aria-live="polite">
          <h1 data-hero className="pb-1">
            <Link to={titleHref(item)} className="block">
              {current?.logoPath ? (
                <Img
                  path={current.logoPath}
                  size="w500"
                  alt={item.title}
                  priority
                  className="!bg-transparent max-h-36 w-auto max-w-[min(420px,80vw)] object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                />
              ) : (
                <span className="t-display block">{item.title}</span>
              )}
            </Link>
          </h1>
          <div data-hero className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem] text-text-2">
            {item.voteCount > 20 && <Rating value={item.rating} className="font-medium text-text" />}
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <p data-hero className="line-clamp-3 mt-3 max-w-[60ch] text-[1.0625rem] text-text-2 md:line-clamp-2">
            {item.overview}
          </p>
          <div data-hero className="mt-6 flex items-center gap-3">
            <LinkButton to={watchHref(item)} size="lg" icon={<Play size={18} weight="fill" aria-hidden />}>
              Play
            </LinkButton>
            <LinkButton to={titleHref(item)} variant="secondary" size="lg" icon={<Info size={18} aria-hidden />}>
              Details
            </LinkButton>
            {current?.trailer && (
              <IconButton ref={trailerBtn} label="Watch trailer" className="size-12" onClick={() => setTrailerOpen(true)}>
                <FilmReel size={20} aria-hidden />
              </IconButton>
            )}
          </div>
        </div>

        {items.length > 1 && (
          <div role="tablist" aria-label="Choose featured title" className="flex gap-2 lg:gap-3">
            {items.map((t, i) => (
              <button
                key={`${t.mediaType}-${t.id}`}
                role="tab"
                aria-selected={i === index}
                aria-label={t.title}
                onClick={() => setIndex(i)}
                className={`press group relative overflow-hidden rounded-full lg:rounded-[10px] ${
                  i === index ? 'h-1.5 w-8 bg-white/30 lg:h-16 lg:w-28' : 'h-1.5 w-3 bg-white/25 lg:h-16 lg:w-28'
                } transition-[width] duration-300`}
              >
                <Img
                  path={t.backdropPath}
                  size="w300"
                  alt=""
                  className={`absolute inset-0 hidden size-full lg:block ${i === index ? '' : 'opacity-50 group-hover:opacity-80'}`}
                />
                {i === index && (
                  <span
                    ref={progress}
                    className="absolute inset-x-0 bottom-0 h-full origin-left bg-white lg:h-0.5"
                    style={{ transform: 'scaleX(0)' }}
                    aria-hidden
                  />
                )}
                {i === index && <span className="absolute inset-0 hidden rounded-[10px] ring-2 ring-white lg:block" aria-hidden />}
              </button>
            ))}
          </div>
        )}
      </div>

      {trailerOpen && current?.trailer && (
        <TrailerDialog
          videos={current.videos}
          initial={current.trailer}
          title={current.title}
          origin={trailerBtn.current}
          onClose={() => setTrailerOpen(false)}
        />
      )}
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative flex min-h-[min(88dvh,860px)] flex-col justify-end" aria-busy="true" aria-label="Loading">
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-14 md:px-12">
        <div className="skeleton h-16 w-80 max-w-full rounded-xl" />
        <div className="skeleton mt-6 h-4 w-64 rounded-full" />
        <div className="skeleton mt-3 h-4 w-[28rem] max-w-full rounded-full" />
        <div className="mt-6 flex gap-3">
          <div className="skeleton h-12 w-28 rounded-full" />
          <div className="skeleton h-12 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
