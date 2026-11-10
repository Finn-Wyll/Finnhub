import { ArrowSquareOut, CaretDown, FilmReel, Play } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import type { MediaType, TitleDetail, Video } from '../core/models';
import { IconButton, LinkButton } from '../components/Button';
import { watchHref } from '../components/Hero';
import { Img } from '../components/Img';
import { PosterCard } from '../components/PosterCard';
import { RAIL_CARD, Rail } from '../components/Rail';
import { Rating } from '../components/Rating';
import { ErrorState } from '../components/States';
import { TrailerDialog } from '../components/TrailerDialog';
import { WatchlistButton } from '../components/WatchlistButton';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useEnter } from '../hooks/useEnter';
import { useQuery } from '../hooks/useQuery';
import { language, longDate, money, plural, runtime } from '../lib/format';
import NotFound from './NotFound';

export default function Title() {
  const { type, id } = useParams();
  const mediaType = type === 'tv' ? 'tv' : type === 'movie' ? 'movie' : null;
  const numericId = Number(id);
  if (!mediaType || !Number.isInteger(numericId)) return <NotFound />;
  return <TitleView key={`${mediaType}-${numericId}`} type={mediaType} id={numericId} />;
}

function TitleView({ type, id }: { type: MediaType; id: number }) {
  const client = useTmdb();
  const { data, error, retry } = useQuery((s) => client.detail(type, id, s), [type, id]);
  useDocumentTitle(data?.title);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type, id]);

  if (error) {
    if ('kind' in error && error.kind === 'notFound') return <NotFound />;
    return (
      <div className="mx-auto max-w-[1600px] px-4 pt-28 md:px-12">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }
  if (!data) return <TitleSkeleton />;
  return <TitleContent t={data} />;
}

function TitleContent({ t }: { t: TitleDetail }) {
  const [trailer, setTrailer] = useState<{ video: Video; origin: HTMLElement | null } | null>(null);
  const trailerBtn = useRef<HTMLButtonElement>(null);
  const intro = useEnter<HTMLDivElement>('[data-enter-hero]', t.id, { stagger: 55 });

  const facts: [string, string][] = (
    [
      ['Released', longDate(t.date)],
      ['Status', t.status],
      ['Language', language(t.originalLanguage)],
      [t.directors.length > 1 ? 'Directors' : 'Director', t.directors.map((d) => d.name).join(', ')],
      [t.creators.length > 1 ? 'Creators' : 'Created by', t.creators.map((d) => d.name).join(', ')],
      ['Writing', t.writers.map((d) => d.name).join(', ')],
      ['Network', t.networks.slice(0, 2).join(', ')],
      ['Studio', t.productionCompanies.slice(0, 2).join(', ')],
      ['Budget', money(t.budget)],
      ['Box office', money(t.revenue)],
    ] as [string, string | null][]
  ).filter((f): f is [string, string] => !!f[1]);

  const meta = [
    t.year ? String(t.year) : null,
    t.certification,
    t.mediaType === 'movie' ? runtime(t.runtime) : t.numberOfSeasons ? plural(t.numberOfSeasons, 'season') : null,
  ].filter(Boolean) as string[];

  const extras = t.videos.filter((v) => v.site === 'YouTube' && v.key !== t.trailer?.key).slice(0, 12);

  return (
    <article>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Img path={t.backdropPath} size="original" srcSizes={['w780', 'w1280']} sizes="100vw" alt="" priority className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/50 to-transparent" />
        </div>
        <div
          ref={intro}
          className="mx-auto grid min-h-[min(80dvh,760px)] max-w-[1600px] items-end gap-8 px-4 pb-12 pt-28 md:grid-cols-[220px_minmax(0,1fr)] md:px-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12"
        >
          <div data-enter-hero className="hidden overflow-hidden rounded-[var(--radius-card)] shadow-2xl ring-1 ring-white/10 md:block">
            <Img path={t.posterPath} size="w500" alt={`${t.title} poster`} priority className="aspect-[2/3] w-full" />
          </div>
          <div className="max-w-3xl">
            <h1 data-enter-hero className="pb-1">
              {t.logoPath ? (
                <Img
                  path={t.logoPath}
                  size="w500"
                  alt={t.title}
                  priority
                  className="!bg-transparent max-h-32 w-auto max-w-[min(440px,85vw)] object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
                />
              ) : (
                <span className="t-display block">{t.title}</span>
              )}
            </h1>
            {t.tagline && (
              <p data-enter-hero className="mt-4 text-lg italic text-text-2">
                {t.tagline}
              </p>
            )}
            <div data-enter-hero className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem] text-text-2">
              {t.voteCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Rating value={t.rating} className="font-semibold text-text" />
                  <span className="text-text-3 tnum">({new Intl.NumberFormat(undefined, { notation: 'compact' }).format(t.voteCount)})</span>
                </span>
              )}
              {meta.map((m) =>
                m === t.certification ? (
                  <span key={m} className="rounded-md border border-line-strong px-1.5 text-xs font-semibold leading-5 text-text">
                    {m}
                  </span>
                ) : (
                  <span key={m} className="tnum">
                    {m}
                  </span>
                ),
              )}
            </div>
            {t.genres.length > 0 && (
              <ul data-enter-hero className="mt-4 flex flex-wrap gap-2" aria-label="Genres">
                {t.genres.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`/${t.mediaType === 'movie' ? 'movies' : 'tv'}?genre=${g.id}`}
                      className="press glass inline-flex h-8 items-center rounded-full px-3.5 text-sm text-text hover:bg-surface-2"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p data-enter-hero className="mt-5 max-w-[65ch] text-[1.0625rem] text-text-2">
              {t.overview || 'No overview is available for this title yet.'}
            </p>
            <div data-enter-hero className="mt-7 flex flex-wrap items-center gap-3">
              <LinkButton to={watchHref(t)} size="lg" icon={<Play size={18} weight="fill" aria-hidden />}>
                {t.mediaType === 'tv' ? 'Play S1 E1' : 'Play'}
              </LinkButton>
              <WatchlistButton item={t} />
              {t.trailer && (
                <IconButton
                  ref={trailerBtn}
                  label="Watch trailer"
                  className="size-12"
                  onClick={() => setTrailer({ video: t.trailer!, origin: trailerBtn.current })}
                >
                  <FilmReel size={20} aria-hidden />
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-14 pb-24 pt-6">
        {t.mediaType === 'tv' && t.seasons.length > 0 && <Seasons t={t} />}

        {t.cast.length > 0 && (
          <Rail id="cast" title="Cast">
            {t.cast.map((c) => (
              <Link key={c.id} to={`/person/${c.id}`} className="press group w-28 shrink-0 md:w-32">
                <div className="aspect-square overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ring-inset">
                  <Img path={c.profilePath} size="w185" alt="" fallback={c.name} className="size-full transition-transform duration-500 group-hover:scale-105" />
                </div>
                <p className="mt-3 truncate text-center text-sm font-medium">{c.name}</p>
                <p className="truncate text-center text-sm text-text-3">{c.character}</p>
              </Link>
            ))}
          </Rail>
        )}

        {extras.length > 0 && (
          <Rail id="videos" title="Trailers and Clips">
            {extras.map((v) => (
              <VideoCard key={v.key} video={v} onOpen={(origin) => setTrailer({ video: v, origin })} />
            ))}
          </Rail>
        )}

        {facts.length > 0 && (
          <section aria-labelledby="about-heading" className="px-4 md:px-12">
            <h2 id="about-heading" className="t-title2">
              About
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:grid-cols-3 lg:grid-cols-5">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-sm text-text-3">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {t.imdbId && (
                <a className="inline-flex items-center gap-1 text-text-2 hover:text-text" href={`https://www.imdb.com/title/${t.imdbId}/`} target="_blank" rel="noreferrer">
                  IMDb <ArrowSquareOut size={14} aria-hidden />
                </a>
              )}
              <a className="inline-flex items-center gap-1 text-text-2 hover:text-text" href={`https://www.themoviedb.org/${t.mediaType}/${t.id}`} target="_blank" rel="noreferrer">
                TMDB <ArrowSquareOut size={14} aria-hidden />
              </a>
              {t.homepage && (
                <a className="inline-flex items-center gap-1 text-text-2 hover:text-text" href={t.homepage} target="_blank" rel="noreferrer">
                  Official site <ArrowSquareOut size={14} aria-hidden />
                </a>
              )}
            </div>
          </section>
        )}

        {(t.recommendations.length > 0 || t.similar.length > 0) && (
          <Rail id="more" title="More Like This">
            {(t.recommendations.length ? t.recommendations : t.similar).map((r) => (
              <PosterCard key={`${r.mediaType}-${r.id}`} item={r} widthClass={RAIL_CARD} />
            ))}
          </Rail>
        )}
      </div>

      {trailer && (
        <TrailerDialog videos={t.videos} initial={trailer.video} title={t.title} origin={trailer.origin} onClose={() => setTrailer(null)} />
      )}
    </article>
  );
}

function VideoCard({ video, onOpen }: { video: Video; onOpen: (origin: HTMLElement) => void }) {
  return (
    <button onClick={(e) => onOpen(e.currentTarget)} className="press group w-[72vw] shrink-0 text-left sm:w-80" aria-label={`Play ${video.type}: ${video.name}`}>
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-surface-2 ring-1 ring-line ring-inset">
        <img
          src={`https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="glass-dark absolute bottom-3 left-3 inline-grid size-10 place-items-center rounded-full text-white">
          <Play size={16} weight="fill" aria-hidden />
        </span>
      </div>
      <p className="mt-2.5 truncate text-[0.9375rem] font-medium">{video.name}</p>
      <p className="text-sm text-text-3">{video.type}</p>
    </button>
  );
}

function Seasons({ t }: { t: TitleDetail }) {
  const client = useTmdb();
  const [params, setParams] = useSearchParams();
  const selectId = useId();
  const requested = Number(params.get('season'));
  const season = t.seasons.find((s) => s.seasonNumber === requested) ?? t.seasons[0];
  const { data: episodes, error, retry, loading } = useQuery((s) => client.season(t.id, season.seasonNumber, s), [t.id, season.seasonNumber]);
  const list = useEnter<HTMLOListElement>('[data-ep]', `${season.seasonNumber}-${episodes?.length ?? 0}`, { stagger: 30 });

  return (
    <section aria-labelledby="episodes-heading" className="px-4 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="episodes-heading" className="t-title2">
          Episodes
        </h2>
        {t.seasons.length > 1 ? (
          <div className="relative">
            <label htmlFor={selectId} className="sr-only">
              Season
            </label>
            <select
              id={selectId}
              value={season.seasonNumber}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set('season', e.target.value);
                setParams(next, { replace: true, preventScrollReset: true });
              }}
              className="press glass h-10 cursor-pointer appearance-none rounded-full pl-4 pr-10 text-sm font-medium text-text"
            >
              {t.seasons.map((s) => (
                <option key={s.seasonNumber} value={s.seasonNumber}>
                  {s.name} ({s.episodeCount})
                </option>
              ))}
            </select>
            <CaretDown size={14} weight="bold" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-2" aria-hidden />
          </div>
        ) : (
          <p className="text-sm text-text-2">{season.name}</p>
        )}
      </div>

      {error ? (
        <div className="mt-5">
          <ErrorState error={error} onRetry={retry} />
        </div>
      ) : (
        <ol ref={list} className="mt-5 grid gap-x-6 gap-y-3 lg:grid-cols-2" aria-busy={loading}>
          {(loading && (!episodes || episodes[0]?.seasonNumber !== season.seasonNumber)
            ? Array.from({ length: 4 }, () => null)
            : episodes ?? []
          ).map((ep, i) =>
            ep ? (
              <li key={ep.id} data-ep>
                <Link
                  to={`/watch/tv/${t.id}/${ep.seasonNumber}/${ep.episodeNumber}`}
                  className="press group grid grid-cols-[132px_minmax(0,1fr)] gap-4 rounded-[var(--radius-card)] p-2 hover:bg-surface sm:grid-cols-[176px_minmax(0,1fr)]"
                >
                  <div className="relative aspect-video overflow-hidden rounded-[10px] bg-surface-2">
                    <Img path={ep.stillPath ?? t.backdropPath} size="w300" alt="" fallback={`${ep.episodeNumber}`} className="size-full" />
                    <span className="glass-dark absolute inset-0 m-auto grid size-9 place-items-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Play size={14} weight="fill" aria-hidden />
                    </span>
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="truncate font-medium">
                      <span className="text-text-3 tnum">{ep.episodeNumber}.</span> {ep.name}
                    </p>
                    <p className="mt-0.5 text-sm text-text-3 tnum">
                      {[runtime(ep.runtime), longDate(ep.airDate)].filter(Boolean).join(', ')}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-text-2">{ep.overview || 'No description yet.'}</p>
                  </div>
                </Link>
              </li>
            ) : (
              <li key={i} className="grid grid-cols-[132px_minmax(0,1fr)] gap-4 p-2 sm:grid-cols-[176px_minmax(0,1fr)]" aria-hidden>
                <div className="skeleton aspect-video rounded-[10px]" />
                <div className="py-1">
                  <div className="skeleton h-4 w-2/3 rounded-full" />
                  <div className="skeleton mt-2 h-3 w-1/3 rounded-full" />
                  <div className="skeleton mt-3 h-3 w-full rounded-full" />
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}

function TitleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading title" className="mx-auto grid min-h-[min(80dvh,760px)] max-w-[1600px] items-end gap-12 px-4 pb-12 pt-28 md:grid-cols-[220px_1fr] md:px-12 lg:grid-cols-[260px_1fr]">
      <div className="skeleton hidden aspect-[2/3] rounded-[var(--radius-card)] md:block" />
      <div>
        <div className="skeleton h-14 w-96 max-w-full rounded-xl" />
        <div className="skeleton mt-6 h-4 w-60 rounded-full" />
        <div className="skeleton mt-6 h-4 w-full max-w-xl rounded-full" />
        <div className="skeleton mt-3 h-4 w-full max-w-lg rounded-full" />
        <div className="mt-8 flex gap-3">
          <div className="skeleton h-12 w-28 rounded-full" />
          <div className="skeleton h-12 w-36 rounded-full" />
        </div>
      </div>
    </div>
  );
}
