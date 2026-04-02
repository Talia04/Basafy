import { Suspense } from 'react';
import CallbackClient from './CallbackClient';

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-muted px-6">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/80 p-8 text-center shadow-xl backdrop-blur">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-chart-1/10" />
            <h1 className="mb-2 text-2xl font-semibold">Finishing Gmail connection</h1>
            <p className="text-sm text-muted-foreground">
              Completing sign-in and sending you to your Basafy Wrapped.
            </p>
          </div>
        }
      >
        <CallbackClient />
      </Suspense>
    </div>
  );
}
