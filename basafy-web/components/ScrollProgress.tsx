'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring, MotionValue } from 'motion/react';

const chapterTitles = [
  'Overview',
  'Funnel',
  'Momentum',
  'Response Time',
  'Sources',
  'Best Time',
  'Ghost Report',
  'Highlights',
  'Next Steps',
  'Get the App'
];

export default function ScrollProgress() {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (latest) => {
      setIsVisible(latest > 0.01 && latest < 0.99);
    });

    return () => unsubscribe();
  }, [scrollYProgress]);

  if (!isVisible) return null;

  return (
    <>
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-chart-1 via-chart-2 to-chart-3"
        style={{ scaleX }}
      />
      <div className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        {chapterTitles.map((title, index) => {
          const start = index / chapterTitles.length;
          const end = (index + 1) / chapterTitles.length;
          return (
            <ChapterDot
              key={title}
              label={title}
              start={start}
              end={end}
              scrollYProgress={scrollYProgress}
            />
          );
        })}
      </div>
    </>
  );
}

function ChapterDot({
  label,
  start,
  end,
  scrollYProgress
}: {
  label: string;
  start: number;
  end: number;
  scrollYProgress: MotionValue<number>;
}) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (latest: number) => {
      setIsActive(latest >= start && latest < end);
    });

    return () => unsubscribe();
  }, [scrollYProgress, start, end]);

  return (
    <div className="relative group">
      <motion.div
        animate={{
          scale: isActive ? 1.2 : 1,
          opacity: isActive ? 1 : 0.4
        }}
        transition={{ duration: 0.2 }}
        className={`h-3 w-3 rounded-full border-2 transition-colors ${isActive ? 'bg-chart-1 border-chart-1' : 'border-muted-foreground bg-transparent'
          }`}
      />

      <div className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-sm opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </div>
    </div>
  );
}
