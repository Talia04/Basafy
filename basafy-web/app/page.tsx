'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { 
  Mail, 
  BarChart3, 
  TrendingUp, 
  Shield, 
  CheckCircle2, 
  Sparkles,
  Calendar,
  BellRing,
  Zap,
  Target,
  Clock,
  ArrowRight,
  ChevronRight,
  Smartphone,
  Star
} from 'lucide-react';
import QuickStartGuide from '../components/QuickStartGuide';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted overflow-hidden">
      <QuickStartGuide />

      {/* Enhanced background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-64 h-64 bg-chart-2/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-chart-1/10 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-1/4 w-80 h-80 bg-chart-4/5 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 p-[2px] shadow-lg shadow-chart-1/20">
            <img
              src="/basafy-icon.png"
              alt="Basafy"
              className="h-full w-full rounded-[10px]"
            />
          </div>
          <span className="text-xl font-bold tracking-tight">Basafy</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/privacy')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Privacy
          </button>
          <button
            onClick={() => router.push('/support')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Support
          </button>
          <Button 
            onClick={() => router.push('/wrapped')}
            className="bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-lg shadow-chart-1/20"
          >
            Get the App
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-1/10 border border-chart-1/20 mb-8"
          >
            <Sparkles className="w-4 h-4 text-chart-1" />
            <span className="text-sm font-medium">Your job search, on autopilot</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Stop tracking.
            </span>
            <br />
            <span className="bg-gradient-to-r from-chart-1 via-chart-2 to-chart-1 bg-clip-text text-transparent">
              Start landing.
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed">
            Basafy reads your Gmail, tracks every application, and reminds you about interviews & assessments—automatically.
          </p>
          
          <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto">
            No more spreadsheets. No missed deadlines. Just clarity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              size="lg"
              onClick={() => router.push('/wrapped')}
              className="text-lg px-8 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-xl shadow-chart-1/25 w-full sm:w-auto group"
            >
              <Smartphone className="w-5 h-5 mr-2" />
              Download for iOS
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/wrapped')}
              className="text-lg px-8 py-6 w-full sm:w-auto"
            >
              Try Web Demo
            </Button>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-chart-4 text-chart-4" />
                ))}
              </div>
              <span className="ml-2">4.9 on App Store</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <span className="hidden sm:block">Used by 10,000+ job seekers</span>
          </div>
        </motion.div>

        {/* App Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 relative max-w-4xl mx-auto"
        >
          <div className="relative mx-auto w-[280px] h-[580px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-[3rem] p-3 shadow-2xl shadow-black/30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl" />
            <div className="w-full h-full bg-gradient-to-br from-background to-muted rounded-[2.5rem] overflow-hidden border border-border/50">
              {/* App UI Preview */}
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Good morning,</p>
                    <p className="text-lg font-semibold">Sarah 👋</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-chart-1 to-chart-2" />
                </div>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-chart-1/10 border border-chart-1/20">
                    <p className="text-2xl font-bold text-chart-1">47</p>
                    <p className="text-xs text-muted-foreground">Applied</p>
                  </div>
                  <div className="p-3 rounded-xl bg-chart-2/10 border border-chart-2/20">
                    <p className="text-2xl font-bold text-chart-2">12</p>
                    <p className="text-xs text-muted-foreground">Interviews</p>
                  </div>
                </div>

                {/* Tasks Section */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-chart-4" />
                    Upcoming Tasks
                  </p>
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">OA: Stripe</p>
                        <p className="text-[10px] text-muted-foreground">Due Tomorrow</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-chart-1" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Interview: Google</p>
                        <p className="text-[10px] text-muted-foreground">Jan 31, 2:00 PM</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recent Activity</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <p className="text-xs">Meta moved to Interview</p>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-chart-1/10">
                      <Mail className="w-3 h-3 text-chart-1" />
                      <p className="text-xs">New app: Amazon SDE</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating elements around phone */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute left-0 top-20 hidden lg:block"
          >
            <Card className="p-4 bg-card/80 backdrop-blur-xl border-border/50 shadow-lg max-w-[200px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Mail className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Auto-detected</p>
                  <p className="text-xs text-muted-foreground">New application synced</p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="absolute right-0 top-40 hidden lg:block"
          >
            <Card className="p-4 bg-card/80 backdrop-blur-xl border-border/50 shadow-lg max-w-[220px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-4/10">
                  <Calendar className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Interview Reminder</p>
                  <p className="text-xs text-muted-foreground">Tomorrow at 2:00 PM</p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="absolute right-10 bottom-20 hidden lg:block"
          >
            <Card className="p-4 bg-card/80 backdrop-blur-xl border-border/50 shadow-lg max-w-[180px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-1/10">
                  <Zap className="w-5 h-5 text-chart-1" />
                </div>
                <div>
                  <p className="text-sm font-medium">Task Created</p>
                  <p className="text-xs text-muted-foreground">OA due in 3 days</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            How it works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From inbox chaos to job search clarity in 3 simple steps
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          <StepCard
            number="01"
            icon={<Mail className="w-8 h-8" />}
            title="Connect Gmail"
            description="Secure read-only access. We scan for job emails, nothing else. Disconnect anytime."
            gradient="from-chart-1 to-chart-2"
          />
          <StepCard
            number="02"
            icon={<Sparkles className="w-8 h-8" />}
            title="Auto-Sync Applications"
            description="Basafy detects applications from Greenhouse, Lever, Workday & 50+ ATS platforms automatically."
            gradient="from-chart-2 to-chart-3"
          />
          <StepCard
            number="03"
            icon={<BellRing className="w-8 h-8" />}
            title="Never Miss a Beat"
            description="Get reminders for OA deadlines, interview prep, and follow-ups. All created automatically."
            gradient="from-chart-4 to-chart-1"
          />
        </div>
      </section>

      {/* Key Features */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-2/10 border border-chart-2/20 mb-6">
            <Target className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium">Powerful Features</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything you need to <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">land that offer</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Mail className="w-6 h-6" />}
            title="Gmail Auto-Sync"
            description="Automatically imports applications from 50+ ATS platforms. No manual entry needed."
            highlight
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Smart Task Generation"
            description="OA deadlines, interview dates, and follow-up reminders created automatically from your emails."
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="Application Insights"
            description="See your funnel, response rates, best application days, and identify what's working."
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Response Analytics"
            description="Track which companies respond fastest and optimize your targeting strategy."
          />
          <FeatureCard
            icon={<Clock className="w-6 h-6" />}
            title="Timeline View"
            description="See your entire job search journey on a beautiful timeline. Never lose track."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Instant Updates"
            description="Status changes detected in real-time. Know when you move forward instantly."
          />
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="relative z-10 px-6 py-16 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Card className="p-8 md:p-12 bg-gradient-to-br from-chart-1/5 via-card/50 to-chart-2/5 backdrop-blur-xl border-border/50">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <StatItem value="10K+" label="Active Job Seekers" />
              <StatItem value="500K+" label="Applications Tracked" />
              <StatItem value="98%" label="Time Saved on Tracking" />
              <StatItem value="4.9★" label="App Store Rating" />
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Privacy Section */}
      <section className="relative z-10 px-6 py-16 max-w-7xl mx-auto">
        <Card className="p-8 md:p-10 bg-card/50 backdrop-blur-xl border-border/50">
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-chart-1/20 to-chart-2/20">
              <Shield className="w-10 h-10 text-chart-1" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">Privacy-first by design</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl">
                We only read job-related emails. Your personal conversations stay private. Always.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <TrustPoint text="Read-only access—we never send emails on your behalf" />
                <TrustPoint text="Only job-related emails are processed" />
                <TrustPoint text="Disconnect Gmail with one tap, anytime" />
                <TrustPoint text="No email content stored after processing" />
                <TrustPoint text="SOC 2 compliant infrastructure" />
                <TrustPoint text="Your data is never sold to third parties" />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Loved by job seekers
          </h2>
          <p className="text-muted-foreground">See what others are saying about Basafy</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          <TestimonialCard
            quote="I was using a spreadsheet to track 100+ applications. Basafy saved my sanity and helped me land my dream job at Google."
            author="Sarah K."
            role="SWE @ Google"
          />
          <TestimonialCard
            quote="The auto-generated tasks for OA deadlines are a game-changer. I never miss an assessment deadline anymore."
            author="Marcus T."
            role="New Grad @ Meta"
          />
          <TestimonialCard
            quote="Finally, an app that understands the chaos of job hunting. The insights helped me realize which companies actually respond."
            author="Emily R."
            role="Product Manager @ Stripe"
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-24 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-chart-1/20 via-transparent to-chart-2/20 rounded-3xl blur-3xl" />
          <div className="relative bg-card/30 backdrop-blur-xl rounded-3xl border border-border/50 p-12 md:p-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Your next offer is waiting
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of job seekers who've simplified their search with Basafy
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => router.push('/wrapped')}
                className="text-lg px-10 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-xl shadow-chart-1/25 group"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Get Basafy Free
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Free forever for basic features. No credit card required.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2 p-[2px] shadow-lg shadow-chart-1/20">
                <img
                  src="/basafy-icon.png"
                  alt="Basafy"
                  className="h-full w-full rounded-[6px]"
                />
              </div>
              <div>
                <span className="font-semibold">Basafy</span>
                <p className="text-xs text-muted-foreground">Your job search, simplified.</p>
              </div>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <button onClick={() => router.push('/privacy')} className="hover:text-foreground transition-colors">
                Privacy Policy
              </button>
              <button onClick={() => router.push('/support')} className="hover:text-foreground transition-colors">
                Support
              </button>
              <span>© 2026 Basafy</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Component definitions

interface StepCardProps {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

function StepCard({ number, icon, title, description, gradient }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/50 hover:border-border/80 transition-all h-full relative overflow-hidden group">
        <div className={`absolute top-0 right-0 text-8xl font-bold bg-gradient-to-br ${gradient} bg-clip-text text-transparent opacity-10 group-hover:opacity-20 transition-opacity`}>
          {number}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} w-fit mb-6`}>
          <div className="text-white">{icon}</div>
        </div>
        <h3 className="text-xl font-semibold mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </Card>
    </motion.div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}

function FeatureCard({ icon, title, description, highlight }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <Card className={`p-6 backdrop-blur-xl border-border/50 hover:border-border/80 transition-all h-full ${highlight ? 'bg-gradient-to-br from-chart-1/10 to-chart-2/5 border-chart-1/20' : 'bg-card/50'}`}>
        <div className={`p-3 rounded-xl w-fit mb-4 ${highlight ? 'bg-gradient-to-br from-chart-1 to-chart-2 text-white' : 'bg-chart-1/10 text-chart-1'}`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </Card>
    </motion.div>
  );
}

interface StatItemProps {
  value: string;
  label: string;
}

function StatItem({ value, label }: StatItemProps) {
  return (
    <div>
      <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent mb-2">
        {value}
      </p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

interface TrustPointProps {
  text: string;
}

function TrustPoint({ text }: TrustPointProps) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-chart-1 mt-0.5 flex-shrink-0" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
}

function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/50 h-full">
        <div className="flex mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-chart-4 text-chart-4" />
          ))}
        </div>
        <p className="text-muted-foreground mb-6 leading-relaxed">"{quote}"</p>
        <div>
          <p className="font-semibold">{author}</p>
          <p className="text-sm text-muted-foreground">{role}</p>
        </div>
      </Card>
    </motion.div>
  );
}
