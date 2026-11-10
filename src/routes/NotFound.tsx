import { LinkButton } from '../components/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Not found');
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[1600px] flex-col items-start justify-center px-4 pt-24 md:px-12">
      <p className="font-mono text-sm text-text-3">404</p>
      <h1 className="t-title1 mt-2">This Page Is Not Here</h1>
      <p className="mt-3 max-w-md text-text-2">The link may be broken, or the title was removed from TMDB.</p>
      <LinkButton to="/" className="mt-6">
        Back to Home
      </LinkButton>
    </div>
  );
}
