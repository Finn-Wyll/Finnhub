import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { useState } from 'react';
import { useApp, useWatchlist, type ThemePref } from '../app-context';
import { Button } from '../components/Button';
import { KeyForm } from '../components/KeyForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Desktop },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
];

export default function Settings() {
  const { theme, setTheme, credentialSource, credential, setCredential } = useApp();
  const { entries } = useWatchlist();
  const [replacing, setReplacing] = useState(false);
  useDocumentTitle('Settings');

  const masked = credential ? `${credential.slice(0, 6)}…${credential.slice(-4)}` : '';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 md:px-12 md:pt-28">
      <h1 className="t-title1">Settings</h1>

      <section aria-labelledby="appearance" className="mt-10 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
        <h2 id="appearance" className="text-lg font-semibold">
          Appearance
        </h2>
        <div role="radiogroup" aria-labelledby="appearance" className="mt-4 grid grid-cols-3 gap-2">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`press flex h-20 flex-col items-center justify-center gap-1.5 rounded-[12px] border text-sm font-medium ${
                theme === value ? 'border-accent bg-surface-2 text-text' : 'border-line text-text-2 hover:text-text'
              }`}
            >
              <Icon size={22} weight={theme === value ? 'fill' : 'regular'} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="tmdb" className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
        <h2 id="tmdb" className="text-lg font-semibold">
          TMDB Connection
        </h2>
        {credentialSource !== 'none' && !replacing ? (
          <div className="mt-3">
            <p className="text-text-2">
              Connected with <span className="font-mono text-sm text-text">{masked}</span>
              {credentialSource === 'env' ? ' from the build environment.' : ', saved in this browser.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
                Replace Key
              </Button>
              {credentialSource === 'user' && (
                <Button variant="ghost" size="sm" onClick={() => setCredential(null)} className="!text-danger">
                  Remove Key
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <KeyForm submitLabel="Save Key" onSaved={() => setReplacing(false)} />
          </div>
        )}
      </section>

      <section aria-labelledby="data" className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
        <h2 id="data" className="text-lg font-semibold">
          Data
        </h2>
        <p className="mt-2 text-text-2">
          Your watchlist has {entries.length} {entries.length === 1 ? 'title' : 'titles'} and lives only in this browser.
        </p>
        <p className="mt-4 text-sm text-text-3">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </section>
    </div>
  );
}
