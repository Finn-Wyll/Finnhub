import { animate, spring, stagger, type JSAnimation } from 'animejs';
import { motionTokens } from '../design/tokens';

/**
 * Motion vocabulary for the whole app, built on Anime.js v4 springs.
 * Anime's spring uses Apple's "perceived duration + bounce" model, so these
 * map 1:1 to SwiftUI `.spring(duration:bounce:)` when porting to macOS.
 */

const toSpring = (s: { bounce: number; duration: number }) =>
  spring({ bounce: s.bounce, duration: s.duration * 1000 });

export const springs = {
  /** Critically damped. Default for anything that moves. */
  default: () => toSpring(motionTokens.springDefault),
  /** Short, no overshoot. Menus, chips, small UI. */
  snappy: () => toSpring(motionTokens.springSnappy),
  /** A touch of bounce. Only after a gesture that carried momentum. */
  momentum: () => toSpring(motionTokens.springMomentum),
};

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type Targets = Parameters<typeof animate>[0];

/** Content entering the screen: rises slightly and fades in. Cross-fade only under reduced motion. */
export function enter(targets: Targets, opts: { delay?: number; stagger?: number; distance?: number } = {}): JSAnimation | null {
  const reduce = prefersReducedMotion();
  const delay = opts.stagger ? stagger(reduce ? 0 : opts.stagger, { start: opts.delay ?? 0 }) : opts.delay ?? 0;
  if (reduce) {
    return animate(targets, { opacity: [0, 1], duration: 180, delay, ease: 'linear' });
  }
  return animate(targets, {
    opacity: [0, 1],
    translateY: [opts.distance ?? 14, 0],
    delay,
    ease: springs.default(),
  });
}

/** Materialise a glass surface from its trigger: scale + opacity together. */
export function materialize(target: HTMLElement, origin?: { x: number; y: number }): JSAnimation {
  if (origin) target.style.transformOrigin = `${origin.x}px ${origin.y}px`;
  if (prefersReducedMotion()) {
    return animate(target, { opacity: [0, 1], duration: 160, ease: 'linear' });
  }
  return animate(target, { opacity: [0, 1], scale: [0.94, 1], ease: springs.snappy() });
}

/** Reverse of materialize, along the same path. */
export function dematerialize(target: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const anim = prefersReducedMotion()
      ? animate(target, { opacity: 0, duration: 120, ease: 'linear' })
      : animate(target, { opacity: 0, scale: 0.96, duration: 160, ease: 'inQuad' });
    anim.then(() => resolve());
  });
}
