import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTmdb } from '../app-context';
import { Img } from '../components/Img';
import { PosterCard } from '../components/PosterCard';
import { ErrorState } from '../components/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useEnter } from '../hooks/useEnter';
import { useQuery } from '../hooks/useQuery';
import { longDate } from '../lib/format';
import { GRID } from './Browse';
import NotFound from './NotFound';

export default function Person() {
  const { id } = useParams();
  const client = useTmdb();
  const pid = Number(id);
  const { data, error, retry } = useQuery((s) => client.person(pid, s), [pid], Number.isInteger(pid));
  const [expanded, setExpanded] = useState(false);
  useDocumentTitle(data?.name);
  const ref = useEnter<HTMLDivElement>('[data-enter-p]', data?.id, { stagger: 50 });

  if (!Number.isInteger(pid)) return <NotFound />;
  if (error) {
    if ('kind' in error && error.kind === 'notFound') return <NotFound />;
    return (
      <div className="mx-auto max-w-[1600px] px-4 pt-28 md:px-12">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const bio = data?.biography ?? '';
  const long = bio.length > 600;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-24 md:px-12 md:pt-28">
      {!data ? (
        <div className="grid gap-8 md:grid-cols-[240px_1fr]" aria-busy="true">
          <div className="skeleton aspect-[2/3] w-40 rounded-[var(--radius-card)] md:w-full" />
          <div>
            <div className="skeleton h-10 w-72 rounded-xl" />
            <div className="skeleton mt-5 h-4 w-full max-w-xl rounded-full" />
            <div className="skeleton mt-3 h-4 w-full max-w-lg rounded-full" />
          </div>
        </div>
      ) : (
        <>
          <div ref={ref} className="grid items-start gap-8 md:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
            <div data-enter-p className="w-40 overflow-hidden rounded-[var(--radius-card)] ring-1 ring-line md:w-full">
              <Img path={data.profilePath} size="w500" alt={data.name} fallback={data.name} priority className="aspect-[2/3] w-full" />
            </div>
            <div className="max-w-3xl">
              <h1 data-enter-p className="t-title1">
                {data.name}
              </h1>
              <p data-enter-p className="mt-2 text-text-2">
                {[data.knownForDepartment, data.birthday && `Born ${longDate(data.birthday)}`, data.placeOfBirth, data.deathday && `Died ${longDate(data.deathday)}`]
                  .filter(Boolean)
                  .join('. ')}
              </p>
              {bio && (
                <div data-enter-p className="mt-6">
                  <p className={`max-w-[65ch] whitespace-pre-line text-text-2 ${long && !expanded ? 'line-clamp-[8]' : ''}`}>{bio}</p>
                  {long && (
                    <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-medium text-accent-text hover:underline" aria-expanded={expanded}>
                      {expanded ? 'Show Less' : 'Read More'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {data.credits.length > 0 && (
            <section aria-labelledby="known-for" className="mt-14">
              <h2 id="known-for" className="t-title2">
                Known For
              </h2>
              <div className={`mt-5 ${GRID}`}>
                {data.credits.map((t) => (
                  <PosterCard key={`${t.mediaType}-${t.id}`} item={t} showType />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
