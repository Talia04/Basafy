import Link from 'next/link';
import ScrollProgress from '../../../components/ScrollProgress';

const funnelData = [
  { stage: 'Applied', count: 89, percentage: 100, barClass: 'bg-chart-1' },
  { stage: 'Assessment', count: 34, percentage: 38, barClass: 'bg-chart-2' },
  { stage: 'Interview', count: 12, percentage: 13, barClass: 'bg-chart-3' },
  { stage: 'Offer', count: 3, percentage: 3, barClass: 'bg-chart-4' }
];

const biggestDropOff = 'Applied → Assessment (62% drop)';

const momentumData = [
  { week: 'Week 1', applications: 8, replies: 2 },
  { week: 'Week 2', applications: 15, replies: 5 },
  { week: 'Week 3', applications: 22, replies: 8 },
  { week: 'Week 4', applications: 18, replies: 6 },
  { week: 'Week 5', applications: 12, replies: 4 },
  { week: 'Week 6', applications: 14, replies: 7 }
];

const bestWeek = 'Week 3 (22 applications)';
const slowestWeek = 'Week 1 (8 applications)';

const responseData = [
  { range: '0-3 days', count: 15 },
  { range: '4-7 days', count: 22 },
  { range: '8-14 days', count: 18 },
  { range: '15+ days', count: 8 }
];

const avgResponseTime = '7.2 days';
const medianResponseTime = '6 days';

const sourcesData = [
  { platform: 'Greenhouse', count: 24, interviews: 6 },
  { platform: 'Lever', count: 18, interviews: 4 },
  { platform: 'Workday', count: 15, interviews: 2 },
  { platform: 'LinkedIn', count: 12, interviews: 0 },
  { platform: 'Direct Email', count: 10, interviews: 0 },
  { platform: 'Other', count: 10, interviews: 0 }
];

const personalities = [
  {
    type: 'sprinter',
    title: 'The Sprinter',
    description: 'High volume, high energy',
    stat: '89 applications in 6 weeks',
    gradient: 'from-chart-1 to-chart-2'
  },
  {
    type: 'strategist',
    title: 'The Strategist',
    description: 'Quality over quantity',
    stat: '13% interview rate',
    gradient: 'from-chart-3 to-chart-4'
  },
  {
    type: 'explorer',
    title: 'The Explorer',
    description: 'Diverse industries',
    stat: '8 different sectors',
    gradient: 'from-chart-5 to-chart-1'
  }
];

const primaryPersonality = personalities[0];

const recommendations = [
  {
    title: 'Follow up on stalled applications',
    insight: '15 applications pending for 14+ days',
    action: 'Send polite check-in emails',
    gradient: 'from-chart-1 to-chart-2'
  },
  {
    title: 'Apply more to sources with higher conversion',
    insight: 'Greenhouse has 25% interview rate vs 8% overall',
    action: 'Focus on Greenhouse-powered companies',
    gradient: 'from-chart-3 to-chart-4'
  },
  {
    title: 'Schedule time blocks for interview prep',
    insight: 'You have 3 upcoming interviews',
    action: 'Block 2 hours daily for preparation',
    gradient: 'from-chart-5 to-chart-1'
  }
];

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
    type: 'funnel'
  },
  {
    title: 'Momentum',
    subtitle: 'Your pace over time',
    hint: 'Weekly applications + replies',
    type: 'momentum'
  },
  {
    title: 'Response time',
    subtitle: 'How fast companies reply to you',
    hint: '0-3 days • 4-7 days • 8-14 days',
    type: 'response'
  },
  {
    title: 'Where interviews come from',
    subtitle: 'What sources work for you',
    hint: 'ATS platforms & sources',
    type: 'sources'
  },
  {
    title: 'Your highlights',
    subtitle: 'Your job search signature',
    hint: 'Signature card + share',
    type: 'highlights'
  },
  {
    title: 'Next best moves',
    subtitle: 'Try these next',
    hint: 'Actionable recommendations',
    type: 'next-steps'
  },
  {
    title: 'Want Basafy to track this automatically?',
    subtitle: 'Get continuous insights with the mobile app',
    hint: 'App Store • Google Play',
    type: 'cta'
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

      <ScrollProgress />

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
            ) : chapter.type === 'funnel' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-2/10 via-transparent to-chart-3/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className="mt-10 space-y-4">
                  {funnelData.map((stage) => (
                    <FunnelRow
                      key={stage.stage}
                      stage={stage.stage}
                      count={stage.count}
                      percentage={stage.percentage}
                      barClass={stage.barClass}
                    />
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-border/50 bg-background/40 px-6 py-5 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Biggest drop-off</p>
                  <p className="mt-2 text-base text-foreground">{biggestDropOff}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Consider following up on pending applications and tailoring your approach for better conversion.
                  </p>
                </div>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  45 rejections • Keep going, you are making progress!
                </p>
              </div>
            ) : chapter.type === 'momentum' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-3/10 via-transparent to-chart-4/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className="mt-10 rounded-3xl border border-border/50 bg-background/40 px-6 py-6">
                  <div className="space-y-4">
                    {momentumData.map((item) => (
                      <div key={item.week} className="flex items-center gap-4">
                        <span className="w-16 text-xs text-muted-foreground">{item.week}</span>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-full rounded-full bg-muted/60">
                            <div
                              className="h-3 rounded-full bg-chart-1"
                              style={{ width: `${(item.applications / 24) * 100}%` }}
                            />
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted/40">
                            <div
                              className="h-2 rounded-full bg-chart-2"
                              style={{ width: `${(item.replies / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-foreground">{item.applications}</span> apps •{' '}
                          <span className="text-foreground">{item.replies}</span> replies
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-chart-1/30 bg-chart-1/10 px-5 py-4 text-sm">
                    <div className="flex items-center gap-3">
                      <TrendIcon className="h-5 w-5 text-chart-1" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Best week</p>
                        <p className="mt-2 text-base text-foreground">{bestWeek}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/40 bg-background/40 px-5 py-4 text-sm">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Slowest week</p>
                        <p className="mt-2 text-base text-foreground">{slowestWeek}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border/50 bg-background/40 px-6 py-4 text-center text-sm text-muted-foreground">
                  Tip: Consistent weekly applications (10-15) tend to yield better results than sporadic bursts.
                </div>
              </div>
            ) : chapter.type === 'response' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-4/10 via-transparent to-chart-5/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className="mt-10 rounded-3xl border border-border/50 bg-background/40 px-6 py-6">
                  <div className="space-y-4">
                    {responseData.map((item) => (
                      <div key={item.range} className="flex items-center gap-4">
                        <span className="w-24 text-xs text-muted-foreground">{item.range}</span>
                        <div className="h-3 flex-1 rounded-full bg-muted/60">
                          <div
                            className="h-3 rounded-full bg-chart-3"
                            style={{ width: `${(item.count / 24) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-chart-3/30 bg-chart-3/10 px-5 py-4 text-center text-sm">
                    <div className="flex items-center justify-center gap-3">
                      <ClockIcon className="h-5 w-5 text-chart-3" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Average response</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{avgResponseTime}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/40 bg-background/40 px-5 py-4 text-center text-sm">
                    <div className="flex items-center justify-center gap-3">
                      <ClockIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Median response</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{medianResponseTime}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border/50 bg-background/40 px-6 py-4 text-center text-sm text-muted-foreground">
                  Most companies respond within 4-7 days. If you have not heard back in 2 weeks, consider a polite
                  follow-up.
                </div>
              </div>
            ) : chapter.type === 'sources' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-5/10 via-transparent to-chart-1/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className="mt-10 rounded-3xl border border-border/50 bg-background/40 px-6 py-6">
                  <div className="space-y-4">
                    {sourcesData.map((source) => (
                      <div key={source.platform} className="flex items-center gap-4">
                        <span className="w-28 text-xs text-muted-foreground">{source.platform}</span>
                        <div className="h-3 flex-1 rounded-full bg-muted/60">
                          <div
                            className="h-3 rounded-full bg-chart-1"
                            style={{ width: `${(source.count / 26) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{source.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-chart-1/30 bg-chart-1/10 px-6 py-5 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <GlobeIcon className="mt-1 h-5 w-5 text-chart-1" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Top platforms detected</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {sourcesData.slice(0, 3).map((source) => (
                          <div key={source.platform}>
                            <p className="text-sm font-semibold text-foreground">{source.platform}</p>
                            <p className="text-xs text-muted-foreground">
                              {source.count} apps • {source.interviews} interviews
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground">
                        Greenhouse and Lever yielded the highest interview rates. Consider focusing more effort on
                        companies using these platforms.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : chapter.type === 'highlights' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-2/10 via-transparent to-chart-5/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className={`mt-10 rounded-[32px] bg-gradient-to-br ${primaryPersonality.gradient} p-10 text-white`}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
                    <SparkleBadgeIcon className="h-7 w-7" />
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold">{primaryPersonality.title}</h2>
                  <p className="mt-2 text-lg text-white/80">{primaryPersonality.description}</p>
                  <p className="mt-4 text-2xl font-semibold">{primaryPersonality.stat}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button className="rounded-full border border-white/30 bg-white/15 px-5 py-2 text-xs font-semibold text-white">
                      Share Your Card
                    </button>
                    <button className="rounded-full border border-white/30 px-5 py-2 text-xs font-semibold text-white/80">
                      Download
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Other personalities detected
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {personalities
                      .filter((personality) => personality.type !== primaryPersonality.type)
                      .map((personality) => (
                        <div
                          key={personality.type}
                          className="rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-sm text-muted-foreground"
                        >
                          <p className="text-sm font-semibold text-foreground">{personality.title}</p>
                          <p className="text-xs text-muted-foreground">{personality.description}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : chapter.type === 'next-steps' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-4/10 via-transparent to-chart-1/10 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className="mt-10 space-y-4">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.title}
                      className="rounded-2xl border border-border/40 bg-background/40 px-6 py-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${rec.gradient} text-white`}
                          >
                            <ArrowIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{rec.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{rec.insight}</p>
                            <p className="mt-2 text-sm font-semibold text-chart-1">{rec.action}</p>
                          </div>
                        </div>
                        <button className="rounded-full border border-border px-5 py-2 text-xs font-semibold text-foreground">
                          Do this in Basafy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-border/50 bg-background/40 px-6 py-4 text-center text-sm text-muted-foreground">
                  These insights are based on your current job search pattern. Track your progress continuously with
                  the Basafy mobile app.
                </div>
              </div>
            ) : chapter.type === 'cta' ? (
              <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-1/15 via-transparent to-chart-2/15 opacity-80" />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Final Chapter</p>
                  <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                  <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                </div>

                <div className="mt-10 flex flex-col items-center gap-8">
                  <div className="relative h-72 w-44 rounded-[28px] bg-gradient-to-br from-chart-1 to-chart-2 shadow-[0_25px_60px_rgba(32,82,255,0.35)]">
                    <div className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-chart-1 text-white">
                      <CheckIcon className="h-6 w-6" />
                    </div>
                    <div className="flex h-full items-center justify-center text-white/80">
                      <PhoneIcon className="h-20 w-20" />
                    </div>
                  </div>

                  <div className="w-full max-w-md space-y-3">
                    <button className="w-full rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-sm font-semibold text-white">
                      Download on App Store
                    </button>
                    <button className="w-full rounded-full bg-gradient-to-r from-chart-3 to-chart-4 px-6 py-3 text-sm font-semibold text-white">
                      Get it on Google Play
                    </button>
                    <button className="w-full rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground">
                      Email me the link
                    </button>
                  </div>

                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <FeatureItem text="Auto-sync with Gmail" />
                    <FeatureItem text="Real-time tracking" />
                    <FeatureItem text="Interview reminders" />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Basafy is read-only and you can disconnect anytime.{' '}
                    <Link className="text-chart-1 hover:underline" href="/privacy">
                      Privacy Policy
                    </Link>
                    .
                  </p>
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

function FunnelRow({
  stage,
  count,
  percentage,
  barClass
}: {
  stage: string;
  count: number;
  percentage: number;
  barClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 px-5 py-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{stage}</span>
        <span>
          {count} ({percentage}%)
        </span>
      </div>
      <div className="mt-3 h-3 w-full rounded-full bg-muted/60">
        <div
          className={`h-3 rounded-full ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h7v7" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a12 12 0 0 0 0 18" />
      <path d="M12 3a12 12 0 0 1 0 18" />
    </svg>
  );
}

function SparkleBadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3z" />
      <path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M5 12h12" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-border/50 bg-background/40 px-4 py-2">
      <CheckIcon className="h-4 w-4 text-chart-1" />
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <circle cx="12" cy="18" r="1" />
    </svg>
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
