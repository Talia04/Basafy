'use client';

import { useEffect, useState } from 'react';

const chapterTitles = [
  'Overview',
  'Funnel',
  'Momentum',
  'Response Time',
  'Sources',
  'Highlights',
  'Next Steps',
  'Get the App'
];

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      const value = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
      setProgress(value);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const activeIndex = Math.min(
    chapterTitles.length - 1,
    Math.floor(progress * chapterTitles.length)
  );

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-chart-1 via-chart-2 to-chart-3" style={{ transform: `scaleX(${progress})` }} />
      <div className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        {chapterTitles.map((title, index) => (
          <div key={title} className="group relative flex items-center gap-3">
            <div
              className={
                index === activeIndex
                  ? 'h-2.5 w-2.5 rounded-full bg-chart-1'
                  : 'h-2.5 w-2.5 rounded-full border border-muted-foreground/60'
              }
            />
            <span className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
              {index + 1}. {title}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
