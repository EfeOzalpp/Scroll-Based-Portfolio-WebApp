// src/components/book-component/hooks/useInertialDragScroll.ts
import { useEffect, useRef, useState } from 'react';

type Args = {
  setScrollX: React.Dispatch<React.SetStateAction<number>>;
  enabled: boolean;
};

export function useInertialDragScroll({ setScrollX, enabled }: Args) {
  const [isDragging, setIsDragging] = useState(false);

  const ref = useRef<{
    pointerId: number | null;
    lastX: number;
    lastT: number;
    v: number; // px/ms
  } | null>(null);

  const rafRef = useRef<number | null>(null);

  const stopInertia = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(() => stopInertia, []);

  const begin = (pointerId: number, clientX: number) => {
    if (!enabled) return;
    stopInertia();
    ref.current = {
      pointerId,
      lastX: clientX,
      lastT: performance.now(),
      v: 0,
    };
  };

  const dragBy = (pointerId: number, clientX: number) => {
    if (!enabled) return;

    const d = ref.current;
    if (!d || d.pointerId !== pointerId) return;

    const now = performance.now();
    const dx = clientX - d.lastX;
    const dt = Math.max(1, now - d.lastT);

    // Natural: finger right => content moves right.
    setScrollX((x) => x + dx);

    const vNow = dx / dt; // px/ms
    d.v = d.v * 0.8 + vNow * 0.2;

    d.lastX = clientX;
    d.lastT = now;
  };

  const end = (pointerId: number) => {
    if (!enabled) return;

    const d = ref.current;
    if (!d || d.pointerId !== pointerId) return;

    ref.current = null;
    setIsDragging(false);

    let v = d.v;

    const STOP_V = 0.01;
    const FRICTION = 0.0026;

    if (Math.abs(v) < STOP_V) return;

    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;

      setScrollX((x) => x + v * dt);

      const dec = FRICTION * dt;
      if (v > 0) v = Math.max(0, v - dec);
      else v = Math.min(0, v + dec);

      if (Math.abs(v) > STOP_V) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const setDragging = (v: boolean) => setIsDragging(v);

  return { begin, dragBy, end, isDragging, setDragging };
}
