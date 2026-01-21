import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-8 top-16 h-64 w-64 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="absolute bottom-16 right-10 h-80 w-80 rounded-full bg-chart-2/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2" />
            <span className="text-lg font-semibold">Basafy</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link className="hover:text-foreground" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-foreground" href="/support">
              Support
            </Link>
            <Link
              href="/wrapped"
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:border-foreground"
            >
              Get Started
            </Link>
          </div>
        </nav>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-display text-5xl font-semibold leading-tight md:text-6xl">
              Basafy turns your Gmail into job search clarity
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Get instant insights into your job search journey. Track applications, analyze response rates, and
              optimize your strategy, all from your email.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/wrapped"
                className="rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(32,82,255,0.3)]"
              >
                Start Your Wrapped
              </Link>
              <Link
                href="/wrapped"
                className="rounded-full border border-border px-8 py-3 text-sm font-semibold text-foreground"
              >
                Get the App
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <FeatureCard title="Import" description="Connect your Gmail in seconds with read-only access.">
              <span className="text-chart-1">Mail</span>
            </FeatureCard>
            <FeatureCard title="Visualize" description="See your job search funnel, response times, and patterns.">
              <span className="text-chart-2">Chart</span>
            </FeatureCard>
            <FeatureCard title="Improve" description="Get actionable insights to optimize your job search strategy.">
              <span className="text-chart-3">Growth</span>
            </FeatureCard>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-3xl border border-border/50 bg-card/50 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chart-1/10 text-chart-1">
                Shield
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold">Your data stays private</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <TrustPoint text="Read-only Gmail access, we never send emails." />
                  <TrustPoint text="Disconnect anytime with one click." />
                  <TrustPoint text="No email content stored on our servers." />
                  <TrustPoint text="Built for students and early career professionals." />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Ready to see your job search story?</h2>
          <p className="mt-4 text-muted-foreground">
            Get your personalized Basafy Wrapped in under a minute.
          </p>
          <div className="mt-8">
            <Link
              href="/wrapped"
              className="rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-10 py-3 text-sm font-semibold text-white"
            >
              Start Wrapped Experience
            </Link>
          </div>
        </section>

        <footer className="border-t border-border/50 px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2" />
              <span>© 2026 Basafy</span>
            </div>
            <div className="flex items-center gap-6">
              <Link className="hover:text-foreground" href="/privacy">
                Privacy Policy
              </Link>
              <Link className="hover:text-foreground" href="/support">
                Support & Contact
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/50 bg-card/50 p-6 backdrop-blur-xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chart-1/10 text-sm font-semibold">
        {children}
      </div>
      <h3 className="mt-6 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TrustPoint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="mt-1 h-2 w-2 rounded-full bg-chart-1" />
      <span>{text}</span>
    </div>
  );
}
