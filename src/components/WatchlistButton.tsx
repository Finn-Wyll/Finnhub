import { Check, Plus } from '@phosphor-icons/react';
import { useRef } from 'react';
import { animate } from 'animejs';
import type { TitleSummary } from '../core/models';
import { useWatchlist } from '../app-context';
import { prefersReducedMotion, springs } from '../lib/motion';
import { Button } from './Button';

export function WatchlistButton({ item, size = 'lg' }: { item: TitleSummary; size?: 'md' | 'lg' }) {
  const { has, toggle } = useWatchlist();
  const icon = useRef<HTMLSpanElement>(null);
  const saved = has(item);

  const onClick = () => {
    toggle(item);
    if (icon.current && !prefersReducedMotion()) {
      animate(icon.current, { scale: [0.6, 1], rotate: [saved ? 0 : -90, 0], ease: springs.momentum() });
    }
  };

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={onClick}
      aria-pressed={saved}
      icon={
        <span ref={icon} className="inline-grid">
          {saved ? <Check size={18} weight="bold" aria-hidden /> : <Plus size={18} weight="bold" aria-hidden />}
        </span>
      }
    >
      {saved ? 'In Watchlist' : 'Watchlist'}
    </Button>
  );
}
