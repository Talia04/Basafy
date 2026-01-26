'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Mail, BarChart3, TrendingUp, Shield, CheckCircle2 } from 'lucide-react';
import QuickStartGuide from '../components/QuickStartGuide';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted overflow-hidden">
      <QuickStartGuide />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-chart-1/10 rounded-full blur-3xl" />
      </div>

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img
            src="/basafy-icon.png"
            alt="Basafy"
            className="h-8 w-8 rounded-lg"
          />
          <span className="text-xl font-bold">Basafy</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/privacy')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </button>
          <button
            onClick={() => router.push('/support')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </button>
          <Button variant="outline" onClick={() => router.push('/wrapped')}>
            Get Started
          </Button>
        </div>
      </nav>

      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Basafy turns your Gmail into job search clarity
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Get instant insights into your job search journey. Track applications, analyze response rates, and optimize
            your strategy—all from your email.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => router.push('/wrapped')}
              className="text-lg px-8 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90"
            >
              Start Your Wrapped
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/wrapped')}
              className="text-lg px-8 py-6"
            >
              Get the App
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mt-20"
        >
          <FeatureCard
            icon={<Mail className="w-8 h-8" />}
            title="Import"
            description="Connect your Gmail in seconds with read-only access"
          />
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8" />}
            title="Visualize"
            description="See your job search funnel, response times, and patterns"
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Improve"
            description="Get actionable insights to optimize your job search strategy"
          />
        </motion.div>
      </section>

      <section className="relative z-10 px-6 py-16 max-w-7xl mx-auto">
        <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/50">
          <div className="flex items-start gap-6">
            <div className="p-3 rounded-lg bg-chart-1/10">
              <Shield className="w-6 h-6 text-chart-1" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-semibold mb-4">Your data stays private</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <TrustPoint text="Read-only Gmail access—we never send emails" />
                <TrustPoint text="Disconnect anytime with one click" />
                <TrustPoint text="No email content stored on our servers" />
                <TrustPoint text="Built for students and early career professionals" />
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold mb-4">Ready to see your job search story?</h2>
          <p className="text-muted-foreground mb-8">Get your personalized Basafy Wrapped in under a minute</p>
          <Button
            size="lg"
            onClick={() => router.push('/wrapped')}
            className="text-lg px-10 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90"
          >
            Start Wrapped Experience
          </Button>
        </motion.div>
      </section>

      <footer className="relative z-10 px-6 py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/basafy-icon.png"
              alt="Basafy"
              className="h-6 w-6 rounded"
            />
            <span className="text-sm text-muted-foreground">© 2026 Basafy</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => router.push('/privacy')} className="hover:text-foreground transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => router.push('/support')} className="hover:text-foreground transition-colors">
              Support & Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/50 hover:border-border transition-all">
      <div className="p-3 rounded-lg bg-chart-1/10 w-fit mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  );
}

interface TrustPointProps {
  text: string;
}

function TrustPoint({ text }: TrustPointProps) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="w-5 h-5 text-chart-1 mt-0.5 flex-shrink-0" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
