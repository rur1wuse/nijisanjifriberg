import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const EDGE = 12;

interface Props {
  content: string;
  children: ReactNode;
}

interface Position {
  left: number;
  top: number;
  arrowLeft: number;
  placement: 'top' | 'bottom';
}

export default function HoverTooltip({ content, children }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const bubble = bubbleRef.current;
      if (!trigger || !bubble) return;
      const rect = trigger.getBoundingClientRect();
      const width = bubble.offsetWidth;
      const height = bubble.offsetHeight;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, EDGE),
        Math.max(EDGE, window.innerWidth - EDGE - width)
      );
      const above = rect.top - height - GAP >= EDGE;
      const top = above ? rect.top - height - GAP : rect.bottom + GAP;
      const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - left, 12), Math.max(12, width - 12));
      setPosition({ left, top, arrowLeft, placement: above ? 'top' : 'bottom' });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className="collab-group-note"
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            id={id}
            ref={bubbleRef}
            role="tooltip"
            className="hover-tooltip"
            data-placement={position?.placement ?? 'top'}
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            {content}
            <span className="hover-tooltip-arrow" style={{ left: position?.arrowLeft ?? 0 }} />
          </div>,
          document.body
        )}
    </>
  );
}
