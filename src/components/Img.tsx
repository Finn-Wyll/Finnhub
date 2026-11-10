import { useState, type ImgHTMLAttributes } from 'react';
import { useApp } from '../app-context';
import type { ImageSize } from '../core/tmdb/client';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  path: string | null | undefined;
  size?: ImageSize;
  srcSizes?: ImageSize[];
  alt: string;
  /** Text used for the fallback tile when there is no image. */
  fallback?: string;
  priority?: boolean;
}

/** TMDB image with reserved space, lazy loading, a soft fade-in and a graceful fallback. */
export function Img({ path, size = 'w500', srcSizes, alt, fallback, priority, className = '', ...rest }: Props) {
  const { client } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = client?.image(path, size);

  if (!src || failed) {
    const initials = (fallback ?? alt)
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        className={`grid place-items-center bg-surface-2 text-text-3 ${className}`}
      >
        <span className="text-lg font-semibold tracking-tight" aria-hidden>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={src}
      srcSet={srcSizes ? client?.srcSet(path, srcSizes) : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`bg-surface-2 object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
}
