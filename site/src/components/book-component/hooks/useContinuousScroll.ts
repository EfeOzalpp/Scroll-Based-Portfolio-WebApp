import { useEffect, useRef } from 'react';

type Args = {
  enabled: boolean;
  setScrollX: React.Dispatch<React.SetStateAction<number>>;
  speedPxPerSec?: number;
};

export function useContinuousScroll({ enabled, setScrollX, speedPxPerSec = 60 }: Args) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(24, now - last); // tighter feels "sharper"
      last = now;

      setScrollX((x) => x + (speedPxPerSec * dt) / 1000);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, setScrollX, speedPxPerSec]);
}
