import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { dematerialize, materialize } from '../../lib/motion';

interface Props {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Glass menu that grows out of its trigger and retracts back into it.
 * Closes on Escape and outside pointer-down; focus returns to the trigger.
 */
export function Popover({ open, onClose, anchor, label, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.hidden = false;
      mounted.current = true;
      const a = anchor?.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      materialize(el, a ? { x: a.left + a.width / 2 - r.left, y: a.top + a.height / 2 - r.top } : undefined);
      el.querySelector<HTMLElement>('[aria-checked="true"], button, [tabindex]')?.focus({ preventScroll: true });
    } else if (mounted.current) {
      void dematerialize(el).then(() => {
        el.hidden = true;
      });
    }
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchor]);

  return (
    <div
      ref={ref}
      hidden
      role="dialog"
      aria-label={label}
      className={`glass-dark absolute bottom-[calc(100%+12px)] right-0 z-40 max-h-[60dvh] w-72 overflow-y-auto rounded-[var(--radius-panel)] p-2 text-white ${className}`}
    >
      {children}
    </div>
  );
}

export function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={title} className="py-1">
      <p className="px-3 pb-1 pt-2 text-xs font-medium text-white/60">{title}</p>
      {children}
    </div>
  );
}

export function MenuOption({ checked, onSelect, children, detail }: { checked: boolean; onSelect: () => void; children: ReactNode; detail?: string }) {
  return (
    <button
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="press flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[0.9375rem] hover:bg-white/10 focus-visible:bg-white/10"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${checked ? 'bg-accent' : 'bg-transparent'}`} aria-hidden />
      <span className="flex-1 truncate">{children}</span>
      {detail && <span className="text-xs text-white/55">{detail}</span>}
    </button>
  );
}
