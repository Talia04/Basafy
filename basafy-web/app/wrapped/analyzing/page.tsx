import Link from 'next/link';

export default function WrappedAnalyzingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <Link href="/wrapped" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Connect
        </Link>

        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Step 2 of 3</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">Analyzing</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            This page will host the animated analysis sequence with counters.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-8">
          <p className="text-sm text-muted-foreground">Placeholder</p>
          <p className="mt-4 text-base text-muted-foreground">
            We will bring over the stepper, progress bar, and animated metrics.
          </p>
        </div>

        <Link
          href="/wrapped/story"
          className="w-fit rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-sm font-semibold text-white"
        >
          Continue to Story
        </Link>
      </div>
    </main>
  );
}
