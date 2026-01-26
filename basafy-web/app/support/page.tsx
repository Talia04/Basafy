import Link from 'next/link';

const faqs = [
  {
    question: 'How do I connect my Gmail account?',
    answer:
      'Click the "Start Wrapped" button, then "Connect with Gmail". You will be redirected to Google’s secure OAuth flow where you grant read-only access to Basafy. We never store your Gmail password.'
  },
  {
    question: 'Is my data safe and private?',
    answer:
      "Yes. We use read-only access and only scan job-related emails. We do not store email content, never send emails on your behalf, and encrypt all data in transit and at rest. You can disconnect anytime."
  },
  {
    question: 'How do I disconnect my Gmail account?',
    answer:
      'You can disconnect Basafy from your Google account settings at myaccount.google.com/permissions. You can also contact us to request full data deletion.'
  },
  {
    question: 'What emails does Basafy scan?',
    answer:
      'Basafy scans emails from the last 60-90 days looking for job applications, interview invites, assessments, and company responses. We filter for common job search patterns and ATS systems like Greenhouse, Lever, and Workday.'
  },
  {
    question: 'How do I delete my data?',
    answer:
      'Contact us at support@basafy.com with your request. We will delete all your data within 7 business days and send you confirmation.'
  },
  {
    question: 'Can I use Basafy without connecting Gmail?',
    answer:
      'Yes. Try our demo mode to see sample insights. However, for personalized data, you will need to connect your Gmail account.'
  },
  {
    question: 'Does Basafy work with other email providers?',
    answer:
      'Currently, Basafy only supports Gmail. We are working on adding Outlook and other providers in the future.'
  },
  {
    question: 'Is Basafy free?',
    answer:
      'Basafy Web Lite is free to use. The mobile app offers a free tier with basic tracking and premium features for continuous monitoring and advanced analytics.'
  }
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link
            href="/"
            className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Back
          </Link>
          <div className="flex items-center gap-3">
            <img
              src="/basafy-icon.png"
              alt="Basafy"
              className="h-8 w-8 rounded-xl"
            />
            <span className="text-lg font-semibold">Basafy</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-chart-1/10 text-chart-1">
            <HelpIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-4xl font-semibold md:text-5xl">Support & Contact</h1>
          <p className="mt-3 text-base text-muted-foreground">We are here to help.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <ContactCard
            title="Email Support"
            description="Get help via email"
            action="support@basafy.com"
            href="mailto:support@basafy.com"
            icon={<MailIcon className="h-6 w-6" />}
            color="from-chart-1 to-chart-2"
          />
          <ContactCard
            title="Product Feedback"
            description="Share your thoughts"
            action="support@basafy.com"
            href="mailto:support@basafy.com"
            icon={<MessageIcon className="h-6 w-6" />}
            color="from-chart-3 to-chart-4"
          />
        </div>

        <div className="mt-10 rounded-[32px] border border-border/50 bg-card/70 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-border/40 bg-background/40 px-5 py-4">
                <h3 className="text-base font-semibold">{faq.question}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-destructive/20 bg-card/70 p-8 text-sm text-muted-foreground">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <TrashIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Delete Your Data</h3>
              <p className="mt-2">
                Need to delete your Basafy data? Send an email to{' '}
                <a className="text-destructive hover:underline" href="mailto:support@basafy.com">
                  support@basafy.com
                </a>{' '}
                with the subject &quot;Data Deletion Request&quot; and we will process it within 7 business days.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                You should also revoke Basafy&apos;s access from your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  className="text-chart-1 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google account settings
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Back to Home
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}

function ContactCard({
  title,
  description,
  action,
  href,
  icon,
  color
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-[28px] border border-border/50 bg-card/70 p-6 shadow-[0_16px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-white`}>
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <a href={href} className="mt-4 inline-flex items-center text-sm font-semibold text-chart-1 hover:underline">
        {action} →
      </a>
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

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4z" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 3.5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 6h18" />
      <path d="M8 6v-2h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </svg>
  );
}
