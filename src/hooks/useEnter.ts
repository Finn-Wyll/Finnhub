import { useEffect, useRef } from 'react';
import { enter } from '../lib/motion';

/**
 * Runs the shared "enter" motion on children matching `selector` once the
 * container mounts or `key` changes. Elements start visible in markup, so
 * content is never hidden if JS or animation fails.
 */
export function useEnter<T extends HTMLElement>(selector: string, key: unknown, opts: { stagger?: number; delay?: number } = {}) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>(selector);
    if (!targets.length) return;
    const anim = enter(targets, { stagger: opts.stagger ?? 40, delay: opts.delay });
    return () => {
      anim?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ref;
}
