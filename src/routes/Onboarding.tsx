import { Logo } from '../components/Logo';
import { KeyForm } from '../components/KeyForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useEnter } from '../hooks/useEnter';

export default function Onboarding() {
  useDocumentTitle('Welcome');
  const ref = useEnter<HTMLDivElement>('[data-enter-o]', 0, { stagger: 70 });
  return (
    <main id="main" className="mx-auto flex min-h-[100dvh] max-w-[1600px] flex-col justify-center px-4 py-16 md:px-12">
      <div ref={ref} className="max-w-xl">
        <div data-enter-o>
          <Logo />
        </div>
        <h1 data-enter-o className="t-display mt-10">
          Films and series, all in one place.
        </h1>
        <p data-enter-o className="mt-4 max-w-[48ch] text-lg text-text-2">
          Finnhub reads its catalogue from TMDB. Add your free API key to start browsing.
        </p>
        <div data-enter-o className="mt-10">
          <KeyForm submitLabel="Start Browsing" />
        </div>
      </div>
    </main>
  );
}
