import Link from 'next/link';
import GmailConnectButtons from '../../components/GmailConnectButtons';

export default function WrappedStartPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-muted">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-16 top-12 h-48 w-48 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="absolute bottom-16 right-12 h-64 w-64 rounded-full bg-chart-2/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2" />
            <span className="text-lg font-semibold">Basafy</span>
          </div>
          <Link
            href="/"
            className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Close
          </Link>
        </header>

        <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8">
          <div className="mb-10">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <span>Step 1 of 3</span>
              <span>Connect</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div className="h-2 w-1/3 rounded-full bg-gradient-to-r from-chart-1 to-chart-2" />
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[32px] border border-border/60 bg-card/70 p-10 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chart-1/10 text-chart-1">
                  <ShieldIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold md:text-4xl">Ready to see your job search story?</h1>
                  <p className="mt-3 text-base text-muted-foreground">
                    Connect your Gmail to generate your personalized Basafy Wrapped.
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <TrustItem
                  icon={<MailIcon className="h-5 w-5" />}
                  title="Email scanning"
                  description="We look for job applications, interview invites, and company responses."
                />
                <TrustItem
                  icon={<LockIcon className="h-5 w-5" />}
                  title="Privacy first"
                  description="All analysis happens securely. We don't store email content."
                />
                <TrustItem
                  icon={<DisconnectIcon className="h-5 w-5" />}
                  title="Easy disconnect"
                  description="Revoke access anytime from your Google account settings."
                />
              </div>

              <GmailConnectButtons />

              <p className="mt-6 text-center text-xs text-muted-foreground">
                By connecting, you agree to our{' '}
                <Link href="/privacy" className="text-chart-1 hover:underline">
                  Privacy Policy
                </Link>
                . You can disconnect anytime.
              </p>
            </div>

            <aside className="rounded-[32px] border border-border/40 bg-background/40 p-8 text-sm text-muted-foreground">
              <h2 className="text-lg font-semibold text-foreground">What we access (read-only)</h2>
              <p className="mt-3">
                We securely scan your Gmail to find job-related emails from the last 90 days. We never send emails or
                access anything else.
              </p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-chart-1" />
                  Read-only Gmail access, no sending rights.
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-chart-1" />
                  Email content stays private and is never stored.
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-chart-1" />
                  Disconnect anytime with one click.
                </li>
              </ul>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function TrustItem({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
      <div className="text-chart-1">{icon}</div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="m22 8-10 6L2 8" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M12 3l8 4v6c0 4-3.4 7.7-8 9-4.6-1.3-8-5-8-9V7l8-4z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function DisconnectIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 4l16 16" />
      <path d="M8.5 8.5A3 3 0 0 1 12 7a3 3 0 0 1 3.5 3.5" />
      <path d="M7 13a5 5 0 0 0 7.8 4" />
      <path d="M17 11a5 5 0 0 0-1-3" />
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
