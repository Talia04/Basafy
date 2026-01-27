'use client';

import { useEffect, useState } from 'react';
import { cn } from './ui/utils';

export default function MotionToggle() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) {
      root.classList.add('reduce-motion');
      return;
    }
    root.classList.remove('reduce-motion');
  }, [reduceMotion]);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 px-4 py-3 shadow-lg backdrop-blur-xl">
        <button
          type="button"
          role="switch"
          aria-checked={reduceMotion}
          aria-label="Reduce motion"
          onClick={() => setReduceMotion((prev) => !prev)}
          className={cn(
            'relative inline-flex h-[1.15rem] w-8 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            reduceMotion ? 'bg-primary' : 'bg-[var(--switch-background)] dark:bg-input/80'
          )}
        >
          <span
            className={cn(
              'block h-4 w-4 rounded-full bg-card transition-transform',
              reduceMotion ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'
            )}
          />
        </button>
        <span className="text-sm font-medium">Reduce Motion</span>
      </div>
    </div>
  );
}
