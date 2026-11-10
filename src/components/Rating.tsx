import { Star } from '@phosphor-icons/react';
import { rating } from '../lib/format';

export function Rating({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tnum ${className}`}>
      <Star size={14} weight="fill" className="text-accent" aria-hidden />
      <span>
        <span className="sr-only">Rated </span>
        {rating(value)}
        <span className="sr-only"> out of 10</span>
      </span>
    </span>
  );
}
