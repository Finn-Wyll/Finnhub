import { ArrowRight, CircleNotch } from '@phosphor-icons/react';
import { useId, useState } from 'react';
import { useApp } from '../app-context';
import { TmdbError } from '../core/tmdb/client';
import { Button } from './Button';

export function KeyForm({ submitLabel = 'Continue', onSaved }: { submitLabel?: string; onSaved?: () => void }) {
  const { makeClient, setCredential } = useApp();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) {
      setError('Paste your TMDB API key or read access token to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await makeClient(key).validate();
      setCredential(key);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof TmdbError && err.kind === 'auth'
          ? 'TMDB did not accept that key. Check that you copied all of it.'
          : err instanceof Error
            ? err.message
            : 'Could not verify the key.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-lg flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        TMDB API key or read access token
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={`${id}-help ${id}-err`}
        className="h-12 rounded-[12px] border border-line-strong bg-surface px-4 font-mono text-sm text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)] aria-[invalid=true]:border-danger"
        placeholder="eyJhbGciOiJIUzI1NiJ9…"
      />
      <p id={`${id}-help`} className="text-sm text-text-2">
        Free from{' '}
        <a className="font-medium text-accent-text underline-offset-2 hover:underline" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
          themoviedb.org/settings/api
        </a>
        . It stays in this browser and is only sent to TMDB.
      </p>
      <p id={`${id}-err`} role="alert" className="min-h-5 text-sm text-danger">
        {error}
      </p>
      <Button type="submit" disabled={busy} className="mt-1 self-start" icon={busy ? <CircleNotch size={18} className="animate-spin" aria-hidden /> : undefined}>
        {busy ? 'Checking…' : submitLabel}
        {!busy && <ArrowRight size={16} weight="bold" aria-hidden />}
      </Button>
    </form>
  );
}
