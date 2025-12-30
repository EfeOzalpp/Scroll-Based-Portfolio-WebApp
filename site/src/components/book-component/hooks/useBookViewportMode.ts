// src/components/book-component/hooks/useBookViewportMode.ts
import { useEffect, useState } from 'react';

export type BookViewportMode = 'sm' | 'md' | 'lg';

export function useBookViewportMode(): BookViewportMode {
  const [mode, setMode] = useState<BookViewportMode>('lg');

  useEffect(() => {
    const sm = window.matchMedia('(max-width: 768px)');
    const md = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');
    const lg = window.matchMedia('(min-width: 1025px)');

    const compute = () => {
      if (sm.matches) return 'sm';
      if (md.matches) return 'md';
      return 'lg';
    };

    const update = () => setMode(compute());

    update();
    sm.addEventListener('change', update);
    md.addEventListener('change', update);
    lg.addEventListener('change', update);

    return () => {
      sm.removeEventListener('change', update);
      md.removeEventListener('change', update);
      lg.removeEventListener('change', update);
    };
  }, []);

  return mode;
}
