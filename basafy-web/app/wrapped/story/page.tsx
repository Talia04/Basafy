import Link from 'next/link';

const chapters = [
  {
    title: 'Your season in jobs',
    subtitle: "Here's your job search at a glance",
    hint: 'Applications • Companies • Interviews • Offers'
  },
  {
    title: 'Your funnel',
    subtitle: 'Where your applications flow',
    hint: 'Applied → Assessment → Interview → Offer'
  },
  {
    title: 'Momentum',
    subtitle: 'Your pace over time',
    hint: 'Weekly applications + replies'
  },
  {
    title: 'Response time',
    subtitle: 'How fast companies reply to you',
    hint: '0-3 days • 4-7 days • 8-14 days'
  },
  {
    title: 'Where interviews come from',
    subtitle: 'What sources work for you',
    hint: 'ATS platforms & sources'
  },
  {
    title: 'Your highlights',
    subtitle: 'Your job search signature',
    hint: 'Signature card + share'
  },
  {
    title: 'Next best moves',
    subtitle: 'Try these next',
    hint: 'Actionable recommendations'
  },
  {
    title: 'Want Basafy to track this automatically?',
    subtitle: 'Get continuous insights with the mobile app',
    hint: 'App Store • Google Play'
  }
];

export default function WrappedStoryPage() {
  return (
    <main className="relative bg-background">
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2" />
            <span className="text-lg font-semibold">Basafy Wrapped</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
              Share
            </button>
            <button className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
              Download
            </button>
            <Link
              href="/"
              className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Close
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        {chapters.map((chapter, index) => (
          <div key={chapter.title} className="group relative flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full border border-muted-foreground/60" />
            <span className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
              {index + 1}. {chapter.title}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-20">
        {chapters.map((chapter, index) => (
          <section
            key={chapter.title}
            className="flex min-h-screen items-center justify-center px-6 py-20"
          >
            <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-1/10 via-transparent to-chart-2/10 opacity-80" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                <div className="mt-8 rounded-2xl border border-border/50 bg-background/40 px-6 py-5 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Placeholder</p>
                  <p className="mt-2">{chapter.hint}</p>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2" />
            <span>© 2026 Basafy</span>
          </div>
          <div className="flex items-center gap-6">
            <Link className="hover:text-foreground" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-foreground" href="/support">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
