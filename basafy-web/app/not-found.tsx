'use client';

import { ErrorState, defaultHomeAction } from '../components/error/ErrorState';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-white">
      <ErrorState
        kind="unknown"
        title="This route does not exist"
        message="The page may have moved, or the link may be incomplete."
        primaryAction={defaultHomeAction}
        secondaryAction={{ label: 'Open Wrapped', href: '/wrapped' }}
      />
    </main>
  );
}
