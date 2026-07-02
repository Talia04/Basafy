'use client';

import { RefreshCw } from 'lucide-react';
import { ErrorState } from '../components/error/ErrorState';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="m-0 bg-[#05070d]">
        <main className="flex min-h-screen items-center justify-center px-4 text-white">
          <ErrorState
            title="Basafy needs a fresh start"
            message="The application could not load safely. Reload the experience to continue."
            primaryAction={{ label: 'Reload Basafy', onClick: reset, icon: <RefreshCw className="h-4 w-4" /> }}
            secondaryAction={{ label: 'Return home', href: '/' }}
          />
        </main>
      </body>
    </html>
  );
}
