import { useProgress } from '../app-context';
import type { MediaType } from '../core/models';
import { continueTarget, progressKey, type ContinueTarget } from '../core/progress';

export interface PlayTarget {
  href: string;
  /** Button label: "Play", "Resume", "Resume S2 E3" or "Play S2 E4". */
  label: string;
  target: ContinueTarget | null;
}

/**
 * Where a Play button should go for a title, taking saved progress into
 * account. Pass `seasons` (from the title's details) so a finished episode
 * leads to the next one.
 */
export function useContinue() {
  const { all } = useProgress();
  return (t: { mediaType: MediaType; id: number; seasons?: { seasonNumber: number; episodeCount: number }[] }): PlayTarget => {
    const target = continueTarget(all[progressKey(t.mediaType, t.id)], t.seasons);
    if (t.mediaType === 'movie') {
      return { href: `/watch/movie/${t.id}`, label: target ? 'Resume' : 'Play', target };
    }
    if (!target) return { href: `/watch/tv/${t.id}/1/1`, label: t.seasons ? 'Play S1 E1' : 'Play', target };
    const ep = `S${target.season} E${target.episode}`;
    return {
      href: `/watch/tv/${t.id}/${target.season}/${target.episode}`,
      label: target.kind === 'resume' && target.at > 0 ? `Resume ${ep}` : `Play ${ep}`,
      target,
    };
  };
}
