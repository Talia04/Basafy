"use client";

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, MessageCircle, HelpCircle, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';

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

      <div className="mx-auto max-w-5xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-12 text-center">
            <div className="mb-6 inline-flex rounded-full bg-chart-1/10 p-4">
              <HelpCircle className="h-8 w-8 text-chart-1" />
            </div>
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">Support & Contact</h1>
            <p className="text-xl text-muted-foreground">We're here to help</p>
          </div>

          <div className="mb-12 grid gap-6 md:grid-cols-2">
            <ContactCard
              title="Email Support"
              description="Get help via email"
              action="support@basafy.com"
              href="mailto:support@basafy.com"
              icon={<Mail className="h-6 w-6" />}
              color="from-chart-1 to-chart-2"
            />
            <ContactCard
              title="Feedback"
              description="Share your thoughts"
              action="feedback@basafy.com"
              href="mailto:feedback@basafy.com"
              icon={<MessageCircle className="h-6 w-6" />}
              color="from-chart-3 to-chart-4"
            />
          </div>

          <Card className="mb-12 bg-card/50 p-8 backdrop-blur-xl border-border/50">
            <h2 className="mb-6 text-2xl font-semibold">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, idx) => (
                <AccordionItem key={faq.question} value={`item-${idx}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          <Card className="bg-card/50 p-8 backdrop-blur-xl border-destructive/20">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-destructive/10 p-3">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Delete Your Data</h3>
                <p className="mb-4 text-muted-foreground">
                  Need to delete your Basafy data? Send an email to{' '}
                  <a href="mailto:support@basafy.com" className="text-destructive hover:underline">
                    support@basafy.com
                  </a>{' '}
                  with the subject &quot;Data Deletion Request&quot; and we'll process it within 7 business days.
                </p>
                <p className="text-sm text-muted-foreground">
                  You should also revoke Basafy&apos;s access from your{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-chart-1 hover:underline"
                  >
                    Google account settings
                  </a>
                  .
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
              Back to Home
            </Link>
            <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
          </div>
        </motion.div>
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
    <Card className="group bg-card/50 p-6 backdrop-blur-xl border-border/50 hover:border-border transition-all">
      <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${color} p-3`}>
        <div className="text-white">{icon}</div>
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="mb-4 text-muted-foreground">{description}</p>
      <a
        href={href}
        className="inline-block font-medium text-chart-1 transition-transform group-hover:translate-x-1 hover:underline"
      >
        {action} →
      </a>
    </Card>
  );
}
