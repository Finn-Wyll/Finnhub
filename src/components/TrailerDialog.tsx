import { X, YoutubeLogo } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { Video } from '../core/models';
import { dematerialize, materialize } from '../lib/motion';
import { IconButton } from './Button';

interface Props {
  videos: Video[];
  initial: Video;
  title: string;
  /** Element that opened the dialog; the sheet grows from it and focus returns to it. */
  origin: HTMLElement | null;
  onClose: () => void;
}

/**
 * Trailer viewer built on the native <dialog> (focus trap, Esc, inert
 * background for free). Opens from the trigger and closes back along the same path.
 */
export function TrailerDialog({ videos, initial, title, origin, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(initial);
  const closing = useRef(false);
  const list = videos.filter((v) => v.site === 'YouTube').slice(0, 8);

  useEffect(() => {
    const d = dialog.current;
    const p = panel.current;
    if (!d || !p) return;
    d.showModal();
    document.body.style.overflow = 'hidden';
    let originPoint: { x: number; y: number } | undefined;
    if (origin) {
      const o = origin.getBoundingClientRect();
      const r = p.getBoundingClientRect();
      originPoint = { x: o.left + o.width / 2 - r.left, y: o.top + o.height / 2 - r.top };
    }
    materialize(p, originPoint);
    return () => {
      document.body.style.overflow = '';
    };
  }, [origin]);

  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    if (panel.current) await dematerialize(panel.current);
    dialog.current?.close();
    origin?.focus();
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      aria-label={`${title} videos`}
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) void close();
      }}
      className="m-0 h-full max-h-none w-full max-w-none overscroll-contain bg-transparent p-4 backdrop:bg-[var(--scrim)] backdrop:backdrop-blur-sm md:p-10"
    >
      <div ref={panel} className="mx-auto flex h-full max-w-6xl flex-col justify-center gap-4">
        <div className="flex items-center justify-between gap-4 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm text-white/70">{title}</p>
            <p className="truncate font-semibold">{current.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Fallback for browsers or extensions that strip the Referer header,
                which makes YouTube refuse the embed with Error 153. */}
            <a
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(current.key)}`}
              target="_blank"
              rel="noopener"
              className="press inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20"
            >
              <YoutubeLogo size={18} weight="fill" aria-hidden />
              <span className="hidden sm:inline">Watch on YouTube</span>
              <span className="sm:hidden">YouTube</span>
            </a>
            <IconButton label="Close" onClick={() => void close()} className="!bg-white/10 !text-white hover:!bg-white/20" variant="plain">
              <X size={18} weight="bold" aria-hidden />
            </IconButton>
          </div>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-panel)] bg-black shadow-2xl ring-1 ring-white/10">
          <iframe
            key={current.key}
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(current.key)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={current.name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {list.length > 1 && (
          <div className="rail -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="More videos">
            {list.map((v) => (
              <button
                key={v.key}
                role="option"
                aria-selected={v.key === current.key}
                onClick={() => setCurrent(v)}
                className={`press shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                  v.key === current.key ? 'bg-white text-zinc-900' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {v.type}: <span className="font-normal">{v.name.length > 36 ? `${v.name.slice(0, 36)}…` : v.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
