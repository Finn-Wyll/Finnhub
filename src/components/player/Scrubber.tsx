import { useRef, useState } from 'react';
import { clock } from '../../lib/format';
import { Img } from '../Img';

interface Props {
  value: number;
  duration: number;
  buffered: number;
  previewPath: string | null;
  onSeek: (seconds: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

/**
 * Timeline. A native range input carries focus, keyboard and screen reader
 * semantics; the visible track, buffer and hover preview are layered on top.
 * The track thickens under the pointer so the hit target feels generous.
 */
export function Scrubber({ value, duration, buffered, previewPath, onSeek, onScrubStart, onScrubEnd }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const pct = duration ? (value / duration) * 100 : 0;
  const buf = duration ? (Math.min(buffered, duration) / duration) * 100 : 0;

  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    setHover({ x, t: (x / r.width) * duration });
  };

  const width = wrap.current?.clientWidth ?? 0;
  const tipX = hover ? Math.min(Math.max(hover.x, 88), Math.max(width - 88, 88)) : 0;

  return (
    <div
      ref={wrap}
      className="group/scrub relative flex h-6 items-center"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {hover && (
        <div className="pointer-events-none absolute bottom-7 -translate-x-1/2" style={{ left: tipX }} aria-hidden>
          <div className="glass-dark overflow-hidden rounded-[12px] p-1">
            <div className="relative aspect-video w-40 overflow-hidden rounded-[9px] bg-white/5">
              {previewPath && <Img path={previewPath} size="w300" alt="" className="size-full" />}
            </div>
            <p className="py-1 text-center font-mono text-xs text-white tnum">{clock(hover.t)}</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/20 transition-[height] duration-150 group-hover/scrub:h-1.5" aria-hidden>
        <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${buf}%` }} />
        {hover && <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${(hover.x / (width || 1)) * 100}%` }} />}
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <input
        type="range"
        className="scrub absolute inset-x-0"
        min={0}
        max={Math.max(1, Math.round(duration))}
        step={1}
        value={Math.round(value)}
        aria-label="Seek"
        aria-valuetext={`${clock(value)} of ${clock(duration)}`}
        onChange={(e) => onSeek(Number(e.target.value))}
        onPointerDown={onScrubStart}
        onPointerUp={onScrubEnd}
        onKeyDown={(e) => {
          // Let the player's own shortcuts handle arrows consistently.
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
        }}
      />
    </div>
  );
}
