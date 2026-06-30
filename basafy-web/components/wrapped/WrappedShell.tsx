'use client';

import Link from 'next/link';
import { Check, X } from 'lucide-react';

const stages = ['Connect', 'Sync', 'Results'];

export function WrappedProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={`Step ${current} of 3`}>
      {stages.map((stage, index) => {
        const step = index + 1;
        const complete = step < current;
        const active = step === current;

        return (
          <div key={stage} className="min-w-0">
            <div className={`mb-2 h-1 overflow-hidden rounded-full ${step <= current ? 'bg-white/12' : 'bg-white/[0.05]'}`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  complete || active ? 'w-full bg-gradient-to-r from-blue-500 via-violet-400 to-emerald-400' : 'w-0'
                }`}
              />
            </div>
            <div className={`flex items-center gap-2 text-xs ${active ? 'text-white' : 'text-white/45'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                complete
                  ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-300'
                  : active
                    ? 'border-blue-400/40 bg-blue-400/12 text-blue-200'
                    : 'border-white/10 bg-white/[0.03]'
              }`}>
                {complete ? <Check className="h-3 w-3" /> : step}
              </span>
              <span className="truncate font-medium">{stage}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WrappedShell({
  current,
  children,
  width = 'max-w-6xl',
}: {
  current: 1 | 2 | 3;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <main className="relative min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#05070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(52,211,153,0.08),transparent_28%),linear-gradient(145deg,#070914_0%,#03050a_62%,#070912_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />

      <div className={`relative z-10 mx-auto flex min-h-screen min-w-0 w-full ${width} flex-col px-4 py-4 sm:px-6 sm:py-6`}>
        <header className="flex items-center justify-between border-b border-white/8 pb-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Basafy home">
            <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 via-violet-400 to-emerald-400 p-[2px] shadow-[0_0_28px_rgba(59,130,246,0.25)]">
              <img src="/basafy-icon.png" alt="" className="h-full w-full rounded-[6px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Basafy</span>
              <span className="block text-[10px] text-white/40">Wrapped</span>
            </span>
          </Link>
          <Link
            href="/"
            title="Close Wrapped"
            aria-label="Close Wrapped"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="mx-auto w-full max-w-xl py-6 sm:py-8">
          <WrappedProgress current={current} />
        </div>

        <div className="flex min-w-0 flex-1 items-center py-4 sm:py-8">{children}</div>
      </div>
    </main>
  );
}
