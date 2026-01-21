'use client';

import { motion } from 'motion/react';
import { Mail, Shield, X, Lock } from 'lucide-react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import GmailConnectButtons from '../../components/GmailConnectButtons';

export default function WrappedStartPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-chart-1 to-chart-2 rounded-lg" />
          <span className="text-xl font-bold">Basafy</span>
        </div>
        <Link
          href="/"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      <div className="px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Step 1 of 3</span>
          <span className="text-sm text-muted-foreground">Connect</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 w-1/3 rounded-full bg-gradient-to-r from-chart-1 to-chart-2" />
        </div>
      </div>

      <div className="flex-1 px-6 py-12 max-w-3xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to see your job search story?
            </h1>
            <p className="text-xl text-muted-foreground">
              Connect your Gmail to generate your personalized Basafy Wrapped
            </p>
          </div>

          <Card className="p-8 mb-8 bg-card border-2 border-chart-1/20">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-full bg-chart-1/10">
                <Shield className="w-6 h-6 text-chart-1" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">What we access (read-only)</h3>
                <p className="text-muted-foreground">
                  We securely scan your Gmail to find job-related emails from the last 90 days.
                  We never send emails or access anything else.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <TrustItem
                icon={<Mail className="w-5 h-5" />}
                title="Email scanning"
                description="We look for job applications, interview invites, and company responses"
              />
              <TrustItem
                icon={<Lock className="w-5 h-5" />}
                title="Privacy first"
                description="All analysis happens securely. We don't store email content."
              />
              <TrustItem
                icon={<X className="w-5 h-5" />}
                title="Easy disconnect"
                description="Revoke access anytime from your Google account settings"
              />
            </div>
          </Card>

          <GmailConnectButtons />

          <p className="text-center text-sm text-muted-foreground mt-8">
            By connecting, you agree to our{' '}
            <Link
              href="/privacy"
              className="text-chart-1 hover:underline"
            >
              Privacy Policy
            </Link>
            . You can disconnect anytime.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

interface TrustItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function TrustItem({ icon, title, description }: TrustItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-chart-1 mt-0.5">{icon}</div>
      <div>
        <h4 className="font-medium mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
