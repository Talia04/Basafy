"use client";

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Shield } from 'lucide-react';
import { Card } from '../../components/ui/card';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link href="/" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 p-[2px]">
              <img src="/basafy-icon.png" alt="Basafy" className="h-full w-full rounded-[10px]" />
            </div>
            <span className="text-xl font-bold">Basafy</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center">
            <div className="mb-6 inline-flex rounded-full bg-chart-1/10 p-4">
              <Shield className="h-8 w-8 text-chart-1" />
            </div>
            <h1 className="text-4xl font-bold md:text-5xl">Privacy Policy</h1>
            <p className="mt-3 text-muted-foreground">Last updated: January 17, 2026</p>
          </div>

          <Card className="mt-10 bg-card/50 p-8 backdrop-blur-xl border-border/50">
            <Section title="Introduction">
              <p>
                Basafy (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, and protect your information when you use Basafy Web
                Lite and our mobile application.
              </p>
            </Section>

            <Section title="What We Access">
              <p>When you connect your Gmail account with read-only access, we access:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Job-related emails from the last 60-90 days</li>
                <li>Email metadata (sender, date, subject lines)</li>
                <li>Limited email content to identify job applications, interviews, and responses</li>
              </ul>
              <p className="mt-4">
                <strong>We NEVER:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Send emails on your behalf</li>
                <li>Access emails outside of job search context</li>
                <li>Share your email content with third parties</li>
                <li>Store raw email content on our servers</li>
              </ul>
            </Section>

            <Section title="How We Use Your Data">
              <p>We use your data solely to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Generate your personalized job search analytics</li>
                <li>Identify patterns and provide insights</li>
                <li>Track your application funnel and response rates</li>
              </ul>
            </Section>

            <Section title="Data Storage">
              <p>We store minimal processed data including:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
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
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
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
              </p>
            </Section>
          </Card>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
              Back to Home
            </Link>
            <Link href="/support" className="text-muted-foreground transition-colors hover:text-foreground">
              Support & Contact
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
      <div className="space-y-4 text-muted-foreground">{children}</div>
    </section>
  );
}
