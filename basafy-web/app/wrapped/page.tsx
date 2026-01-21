import Link from 'next/link';

export default function WrappedStartPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Home
        </Link>

        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Step 1 of 3</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">Connect Gmail</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            This screen will host the read-only Gmail connect flow and demo option.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-8">
          <p className="text-sm text-muted-foreground">Placeholder</p>
          <p className="mt-4 text-base text-muted-foreground">
            We will mirror the trust card and connect button from Web Lite here.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/wrapped/analyzing"
            className="rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-sm font-semibold text-white"
          >
            Continue to Analysis
          </Link>
          <Link
            href="/wrapped/story"
            className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground"
          >
            Skip to Demo Story
          </Link>
        </div>
      </div>
    </main>
  );
}
