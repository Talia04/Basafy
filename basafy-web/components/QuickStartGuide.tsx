'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { X, Mail, BarChart, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

export default function QuickStartGuide() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('basafy-has-seen-guide');
    if (!hasSeenGuide) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('basafy-has-seen-guide', 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="pointer-events-auto w-full max-w-2xl"
            >
              <Card className="p-8 bg-card border-2 border-chart-1/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-chart-1/10 rounded-full blur-3xl" />

                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="relative z-10">
                  <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-chart-1 to-chart-2 mb-4">
                      <img
                        src="/basafy-icon.png"
                        alt="Basafy"
                        className="h-10 w-10 rounded-2xl"
                      />
                    </div>
                    <h2 className="text-3xl font-bold mb-3">Welcome to Basafy Wrapped!</h2>
                    <p className="text-muted-foreground">
                      Get instant insights into your job search journey in 3 simple steps
                    </p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <Step
                      number={1}
                      icon={<Mail className="w-5 h-5" />}
                      title="Connect Your Gmail"
                      description="Securely connect with read-only access. We never send emails or store content."
                    />
                    <Step
                      number={2}
                      icon={<BarChart className="w-5 h-5" />}
                      title="Watch the Analysis"
                      description="Our system scans job-related emails and generates your personalized insights."
                    />
                    <Step
                      number={3}
                      icon={<Sparkles className="w-5 h-5" />}
                      title="Explore Your Story"
                      description="Scroll through 8 chapters of stats, charts, and actionable recommendations."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleClose}
                      className="flex-1 bg-gradient-to-r from-chart-1 to-chart-2"
                    >
                      Get Started
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="outline"
                      className="flex-1"
                    >
                      Try Demo First
                    </Button>
                  </div>

                  <p className="text-center text-sm text-muted-foreground mt-6">
                    🔒 Your privacy is our priority. Read our{' '}
                    <Link href="/privacy" className="text-chart-1 hover:underline" onClick={handleClose}>
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link href="/terms" className="text-chart-1 hover:underline" onClick={handleClose}>
                      Terms of Service
                    </Link>
                    .
                  </p>
                </div>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

interface StepProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function Step({ number, icon, title, description }: StepProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chart-1 to-chart-2 flex items-center justify-center text-white font-bold">
          {number}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-chart-1">{icon}</div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
