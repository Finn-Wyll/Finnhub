import { ArrowClockwise, Key, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { TmdbError } from '../core/tmdb/client';
import { Button, LinkButton } from './Button';

export function ErrorState({ error, onRetry, compact }: { error: Error; onRetry?: () => void; compact?: boolean }) {
  const isAuth = error instanceof TmdbError && error.kind === 'auth';
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 ${compact ? '' : 'max-w-lg'}`}
    >
      <WarningCircle size={28} weight="duotone" className="text-danger" aria-hidden />
      <div>
        <p className="font-semibold">{isAuth ? 'Your TMDB Key Was Rejected' : 'Something Went Wrong'}</p>
        <p className="mt-1 text-sm text-text-2">{error.message}</p>
      </div>
      <div className="flex gap-2">
        {isAuth ? (
          <LinkButton to="/settings" size="sm" icon={<Key size={16} aria-hidden />}>
            Update Key
          </LinkButton>
        ) : (
          onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} icon={<ArrowClockwise size={16} aria-hidden />}>
              Try Again
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = <MagnifyingGlass size={32} weight="duotone" aria-hidden />,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex max-w-md flex-col items-start gap-3 py-10">
      <div className="text-text-3">{icon}</div>
      <p className="t-title2">{title}</p>
      {body && <p className="text-text-2">{body}</p>}
      {action}
    </div>
  );
}
