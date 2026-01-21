import Link from 'next/link';

const chapters = [
  {
    title: 'Your season in jobs',
    subtitle: "Here's your job search at a glance",
    hint: 'Applications • Companies • Interviews • Offers',
    type: 'overview'
  },
  {
    title: 'Your funnel',
    subtitle: 'Where your applications flow',
    hint: 'Applied → Assessment → Interview → Offer',
    type: 'placeholder'
  },
  {
    title: 'Momentum',
    subtitle: 'Your pace over time',
    hint: 'Weekly applications + replies',
    type: 'placeholder'
  },
  {
    title: 'Response time',
    subtitle: 'How fast companies reply to you',
    hint: '0-3 days • 4-7 days • 8-14 days',
    type: 'placeholder'
  },
  {
    title: 'Where interviews come from',
    subtitle: 'What sources work for you',
    hint: 'ATS platforms & sources',
    type: 'placeholder'
  },
  {
    title: 'Your highlights',
    subtitle: 'Your job search signature',
    hint: 'Signature card + share',
    type: 'placeholder'
  },
  {
    title: 'Next best moves',
    subtitle: 'Try these next',
    hint: 'Actionable recommendations',
    type: 'placeholder'
  },
  {
    title: 'Want Basafy to track this automatically?',
    subtitle: 'Get continuous insights with the mobile app',
    hint: 'App Store • Google Play',
    type: 'placeholder'
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
            {chapter.type === 'overview' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-1/10 via-transparent to-chart-2/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>

                  <div className="mt-10 grid gap-4 md:grid-cols-2">
                    <StatCard
                      title="Applications"
                      value="89"
                      description="Total applications detected"
                      gradient="from-chart-1 to-chart-2"
                      icon={<FileIcon className="h-6 w-6" />}
                    />
                    <StatCard
                      title="Companies"
                      value="42"
                      description="Unique companies applied to"
                      gradient="from-chart-2 to-chart-3"
                      icon={<BuildingIcon className="h-6 w-6" />}
                    />
                    <StatCard
                      title="Interviews"
                      value="12"
                      description="Interview invitations received"
                      gradient="from-chart-3 to-chart-4"
                      icon={<CalendarIcon className="h-6 w-6" />}
                    />
                    <StatCard
                      title="Offers"
                      value="3"
                      description="Offers received"
                      gradient="from-chart-4 to-chart-5"
                      icon={<AwardIcon className="h-6 w-6" />}
                    />
                  </div>
                </div>
              </div>
            ) : (
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
            )}
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

function StatCard({
  title,
  value,
  description,
  gradient,
  icon
}: {
  title: string;
  value: string;
  description: string;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/40 p-6 text-left">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white`}>
        {icon}
      </div>
      <div className="mt-4 text-4xl font-semibold">{value}</div>
      <div className="mt-2 text-base font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h2" />
      <path d="M9 13h2" />
      <path d="M9 17h2" />
      <path d="M13 9h2" />
      <path d="M13 13h2" />
      <path d="M13 17h2" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </svg>
  );
}

function AwardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M8 14l-2 7 6-3 6 3-2-7" />
    </svg>
  );
}
