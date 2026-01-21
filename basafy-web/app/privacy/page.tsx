import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link
            href="/"
            className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2" />
            <span className="text-lg font-semibold">Basafy</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-chart-1/10 text-chart-1">
            <ShieldIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-4xl font-semibold md:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-base text-muted-foreground">Last updated: January 17, 2026</p>
        </div>

        <div className="mt-10 rounded-[32px] border border-border/50 bg-card/70 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <Section title="Introduction">
            <p>
              Basafy (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, and protect your information when you use Basafy Web
              Lite and our mobile application.
            </p>
          </Section>

          <Section title="What We Access">
            <p>When you connect your Gmail account with read-only access, we access:</p>
            <ul className="list-disc pl-6 text-muted-foreground">
              <li>Job-related emails from the last 60-90 days</li>
              <li>Email metadata (sender, date, subject lines)</li>
              <li>Limited email content to identify job applications, interviews, and responses</li>
            </ul>
            <p className="mt-4 font-semibold text-foreground">We never:</p>
            <ul className="list-disc pl-6 text-muted-foreground">
              <li>Send emails on your behalf</li>
              <li>Access emails outside of job search context</li>
              <li>Share your email content with third parties</li>
              <li>Store raw email content on our servers</li>
            </ul>
          </Section>

          <Section title="How We Use Your Data">
            <p>We use your data solely to:</p>
            <ul className="list-disc pl-6 text-muted-foreground">
              <li>Generate your personalized job search analytics</li>
              <li>Identify patterns and provide insights</li>
              <li>Track your application funnel and response rates</li>
            </ul>
          </Section>

          <Section title="Data Storage">
            <p>We store minimal processed data including:</p>
            <ul className="list-disc pl-6 text-muted-foreground">
              <li>Company names and application dates</li>
              <li>Application status and stage information</li>
              <li>Aggregated statistics and insights</li>
            </ul>
            <p className="mt-4">
              All data is encrypted in transit and at rest. We do not sell your data to third parties.
            </p>
          </Section>

          <Section title="Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground">
              <li>Disconnect Gmail access at any time from your Google account settings</li>
              <li>Request deletion of your data through our support page</li>
              <li>Export your data (coming soon)</li>
              <li>Contact us with privacy concerns</li>
            </ul>
          </Section>

          <Section title="Third-Party Services">
            <p>
              We use Supabase for authentication and secure data storage. Their privacy policy can be found at
              supabase.com/privacy.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@basafy.com" className="text-chart-1 hover:underline">
                privacy@basafy.com
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Back to Home
          </Link>
          <Link href="/support" className="hover:text-foreground">
            Support & Contact
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M12 3l8 4v6c0 4-3.4 7.7-8 9-4.6-1.3-8-5-8-9V7l8-4z" />
    </svg>
  );
}
