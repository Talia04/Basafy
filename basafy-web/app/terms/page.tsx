"use client";

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Card } from '../../components/ui/card';

export default function TermsPage() {
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
            <div className="mb-6 inline-flex rounded-full bg-chart-2/10 p-4">
              <FileText className="h-8 w-8 text-chart-2" />
            </div>
            <h1 className="text-4xl font-bold md:text-5xl">Terms of Service</h1>
            <p className="mt-3 text-muted-foreground">Last updated: February 11, 2026</p>
          </div>

          <Card className="mt-10 bg-card/50 p-8 backdrop-blur-xl border-border/50">
            <Section title="Agreement to Terms">
              <p>
                By accessing or using Basafy Web Lite or the Basafy mobile app, you agree to these Terms of Service.
                If you do not agree, do not use our services.
              </p>
            </Section>

            <Section title="Who Can Use Basafy">
              <p>
                You must be at least 13 years old to use Basafy. If you are using Basafy on behalf of an organization,
                you confirm that you have the authority to bind that organization to these terms.
              </p>
            </Section>

            <Section title="What Basafy Does">
              <p>
                Basafy helps you track job applications by scanning job-related emails (with read-only Gmail access)
                and organizing your pipeline, tasks, and events.
              </p>
            </Section>

            <Section title="Your Account">
              <p>
                You are responsible for maintaining the security of your account and for all activities that occur
                under it. If you believe your account has been compromised, contact us immediately.
              </p>
            </Section>

            <Section title="Gmail Access">
              <p>
                If you connect Gmail, you grant Basafy read-only access to job-related emails. We do not send email on
                your behalf and you can revoke access at any time from your Google account settings.
              </p>
            </Section>

            <Section title="Acceptable Use">
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Do not misuse or attempt to disrupt the service.</li>
                <li>Do not reverse engineer or scrape the service without permission.</li>
                <li>Do not use Basafy in violation of any law or regulation.</li>
              </ul>
            </Section>

            <Section title="Data & Privacy">
              <p>
                We only use your data to provide the service. For details on what we collect and how we protect it,
                please review our Privacy Policy.
              </p>
            </Section>

            <Section title="Third-Party Services">
              <p>
                Basafy integrates with third-party services like Google and Supabase. Your use of those services is
                subject to their terms and policies.
              </p>
            </Section>

            <Section title="Disclaimer">
              <p>
                Basafy is provided “as is” without warranties of any kind. We do not guarantee uninterrupted service,
                error-free operation, or perfect accuracy of insights.
              </p>
            </Section>

            <Section title="Limitation of Liability">
              <p>
                To the maximum extent permitted by law, Basafy is not liable for indirect, incidental, special, or
                consequential damages arising from your use of the service.
              </p>
            </Section>

            <Section title="Changes to These Terms">
              <p>
                We may update these Terms from time to time. If we make material changes, we will update the date at
                the top of this page.
              </p>
            </Section>

            <Section title="Contact Us">
              <p>
                Questions about these Terms? Email us at{' '}
                <a href="mailto:terms@basafy.com" className="text-chart-2 hover:underline">
                  terms@basafy.com
                </a>
              </p>
            </Section>
          </Card>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
              Back to Home
            </Link>
            <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
              Privacy Policy
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
