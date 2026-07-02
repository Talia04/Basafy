'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { ErrorState, defaultHomeAction } from '../components/error/ErrorState';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-white">
      <ErrorState
        message="The page encountered an unexpected problem. Your account data was not changed."
        reference={error.digest}
        primaryAction={{ label: 'Try again', onClick: reset, icon: <RefreshCw className="h-4 w-4" /> }}
        secondaryAction={defaultHomeAction}
      />
    </main>
  );
}
