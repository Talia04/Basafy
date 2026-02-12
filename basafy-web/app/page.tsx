'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { useState, useEffect } from 'react';
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
  Star,
  MousePointer2
} from 'lucide-react';
import QuickStartGuide from '../components/QuickStartGuide';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasAnimated(true);
          animationFrame = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    const element = document.getElementById('stats-section');
    if (element) observer.observe(element);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [end, duration, hasAnimated]);

  return count;
}

export default function HomePage() {
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const [showGuide, setShowGuide] = useState(false);

  // Parallax transforms
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -100]);
  const phoneY = useTransform(smoothProgress, [0, 0.4], [0, -50]);
  const bgScale = useTransform(smoothProgress, [0, 1], [1, 1.2]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted overflow-hidden grain">
      <QuickStartGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onGetStarted={() => {
          setShowGuide(false);
          router.push('/wrapped');
        }}
        onTryDemo={() => {
          try {
            window.localStorage.setItem('basafy-story-data', 'demo');
          } catch {
            // ignore storage failures
          }
          setShowGuide(false);
          router.push('/wrapped/story');
        }}
      />

      {/* Scroll progress indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-chart-1 via-chart-2 to-chart-1 origin-left z-50"
        style={{ scaleX: smoothProgress }}
      />

      {/* Enhanced animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          style={{ scale: bgScale }}
          className="absolute inset-0"
        >
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl blob" />
          <div className="absolute top-40 right-20 w-64 h-64 bg-chart-2/15 rounded-full blur-3xl blob-delayed animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-chart-1/10 rounded-full blur-3xl float-soft" />
          <div className="absolute bottom-40 left-1/4 w-80 h-80 bg-chart-4/8 rounded-full blur-3xl float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-chart-1/5 to-transparent rounded-full blur-3xl" />
        </motion.div>

        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-chart-1/30 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 4 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto"
      >
        <motion.div
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 p-[2px] shadow-lg shadow-chart-1/30 hover-lift">
            <img
              src="/basafy-icon.png"
              alt="Basafy"
              className="h-full w-full rounded-[10px]"
            />
          </div>
          <span className="text-xl font-bold tracking-tight">Basafy</span>
        </motion.div>
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hidden sm:block hover:scale-105"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hidden sm:block hover:scale-105"
          >
            Terms
          </Link>
          <Link
            href="/support"
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hidden sm:block hover:scale-105"
          >
            Support
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => router.push('/wrapped')}
              className="bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-lg shadow-chart-1/30 transition-all duration-300 hover:shadow-xl hover:shadow-chart-1/40"
            >
              Get the App
            </Button>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-24 max-w-7xl mx-auto">
        <motion.div
          style={{ y: heroY }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-1/10 border border-chart-1/20 mb-8 cursor-default"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-4 h-4 text-chart-1" />
            </motion.div>
            <span className="text-sm font-medium">Your job search, on autopilot</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          >
            <motion.span
              className="inline-block bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Stop tracking.
            </motion.span>
            <br />
            <motion.span
              className="inline-block bg-gradient-to-r from-chart-1 via-chart-2 to-chart-1 bg-clip-text text-transparent gradient-shift bg-[length:200%_200%]"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Start landing.
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed"
          >
            Basafy reads your Gmail, tracks every application, and reminds you about interviews & assessments—<span className="text-foreground font-medium">automatically</span>.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="text-base md:text-lg text-muted-foreground/80 mb-6 max-w-2xl mx-auto"
          >
            Basafy is a job search companion that turns your emails into a clear pipeline, calendar, and to-do list so you always know what to do next.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto"
          >
            No more spreadsheets. No missed deadlines. Just clarity.
          </motion.p>

          <div className="mx-auto mb-10 max-w-3xl rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            We request read-only Gmail access to identify job-related emails and automatically build your application pipeline, tasks, and interview calendar.
            <span className="ml-2">
              <a href="/privacy" className="text-chart-1 hover:underline">Privacy Policy</a>
              {' '}|{' '}
              <a href="/terms" className="text-chart-1 hover:underline">Terms of Service</a>
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                onClick={() => router.push('/wrapped')}
                className="text-lg px-8 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-xl shadow-chart-1/30 w-full sm:w-auto group relative overflow-hidden shine"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Download for iOS
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowGuide(true)}
                className="text-lg px-8 py-6 w-full sm:w-auto border-0"
              >
                Try Web Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                  >
                    <Star className="w-4 h-4 fill-chart-4 text-chart-4" />
                  </motion.div>
                ))}
              </div>
              <span className="ml-2">4.9 on App Store</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <span className="hidden sm:block">Used by 10,000+ job seekers</span>
          </motion.div>
        </motion.div>

        {/* App Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 50 }}
          style={{ y: phoneY }}
          className="mt-16 relative max-w-4xl mx-auto"
        >
          {/* Phone glow effect */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[300px] h-[600px] bg-gradient-to-br from-chart-1/20 to-chart-2/20 rounded-[4rem] blur-3xl pulse-glow" />
          </div>

          <motion.div
            className="relative mx-auto w-[280px] h-[580px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-[3rem] p-3 shadow-2xl shadow-black/40"
            whileHover={{ rotateY: 5, rotateX: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ transformStyle: "preserve-3d", perspective: 1000 }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl" />
            <div className="w-full h-full bg-gradient-to-br from-background to-muted rounded-[2.5rem] overflow-hidden border border-border/50">
              {/* App UI Preview */}
              <div className="p-4 space-y-4">
                <motion.div
                  className="flex items-center justify-between"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Good morning,</p>
                    <p className="text-lg font-semibold">Sarah 👋</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-chart-1 to-chart-2" />
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                  className="grid grid-cols-2 gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                >
                  <div className="p-3 rounded-xl bg-chart-1/10 border border-chart-1/20">
                    <motion.p
                      className="text-2xl font-bold text-chart-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.6 }}
                    >
                      47
                    </motion.p>
                    <p className="text-xs text-muted-foreground">Applied</p>
                  </div>
                  <div className="p-3 rounded-xl bg-chart-2/10 border border-chart-2/20">
                    <motion.p
                      className="text-2xl font-bold text-chart-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.7 }}
                    >
                      12
                    </motion.p>
                    <p className="text-xs text-muted-foreground">Interviews</p>
                  </div>
                </motion.div>

                {/* Tasks Section */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.6 }}
                >
                  <p className="text-sm font-medium flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-chart-4" />
                    Upcoming Tasks
                  </p>
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2">
                    <motion.div
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.8 }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">OA: Stripe</p>
                        <p className="text-[10px] text-muted-foreground">Due Tomorrow</p>
                      </div>
                    </motion.div>
                    <motion.div
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 2.0 }}
                    >
                      <div className="w-2 h-2 rounded-full bg-chart-1" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Interview: Google</p>
                        <p className="text-[10px] text-muted-foreground">Jan 31, 2:00 PM</p>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 }}
                >
                  <p className="text-sm font-medium">Recent Activity</p>
                  <div className="space-y-1.5">
                    <motion.div
                      className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 2.2 }}
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <p className="text-xs">Meta moved to Interview</p>
                    </motion.div>
                    <motion.div
                      className="flex items-center gap-2 p-2 rounded-lg bg-chart-1/10"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 2.4 }}
                    >
                      <Mail className="w-3 h-3 text-chart-1" />
                      <p className="text-xs">New app: Amazon SDE</p>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Floating elements around phone */}
          <motion.div
            initial={{ opacity: 0, x: -40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
            className="absolute left-0 top-20 hidden lg:block float-soft"
          >
            <Card className="p-4 bg-card/90 backdrop-blur-xl border-border/50 shadow-xl max-w-[200px] hover-lift">
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
            initial={{ opacity: 0, x: 40, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 1.0, type: "spring", stiffness: 100 }}
            className="absolute right-0 top-40 hidden lg:block float-delayed"
          >
            <Card className="p-4 bg-card/90 backdrop-blur-xl border-border/50 shadow-xl max-w-[220px] hover-lift">
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, type: "spring", stiffness: 100 }}
            className="absolute right-10 bottom-20 hidden lg:block float-slow"
          >
            <Card className="p-4 bg-card/90 backdrop-blur-xl border-border/50 shadow-xl max-w-[180px] hover-lift">
              <div className="flex items-center gap-3">
                <motion.div
                  className="p-2 rounded-lg bg-chart-1/10"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Zap className="w-5 h-5 text-chart-1" />
                </motion.div>
                <div>
                  <p className="text-sm font-medium">Task Created</p>
                  <p className="text-xs text-muted-foreground">OA due in 3 days</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="flex flex-col items-center mt-16 text-muted-foreground"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <MousePointer2 className="w-5 h-5" />
          </motion.div>
          <span className="text-xs mt-2">Scroll to explore</span>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-6 py-24 max-w-6xl mx-auto overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-20"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-1/10 border border-chart-1/20 mb-6"
            whileHover={{ scale: 1.05 }}
          >
            <Zap className="w-4 h-4 text-chart-1" />
            <span className="text-sm font-medium">Quick Setup</span>
          </motion.div>
          <motion.h2
            className="text-3xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Get started in <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">3 steps</span>
          </motion.h2>
          <motion.p
            className="text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            From inbox chaos to job search clarity in under 2 minutes
          </motion.p>
        </motion.div>

        {/* Timeline container */}
        <div className="relative">
          {/* Connecting line - desktop */}
          <div className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5">
            <motion.div
              className="h-full bg-gradient-to-r from-chart-1 via-chart-2 to-chart-4 rounded-full"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              viewport={{ once: true }}
              style={{ transformOrigin: "left" }}
            />
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {[
              {
                number: "1",
                icon: <Mail className="w-7 h-7" />,
                title: "Connect Gmail",
                description: "One-click secure connection. Read-only access to job emails only. Disconnect anytime.",
                color: "chart-1"
              },
              {
                number: "2",
                icon: <Sparkles className="w-7 h-7" />,
                title: "Auto-Sync",
                description: "AI detects applications from Greenhouse, Lever, Workday & 50+ ATS platforms instantly.",
                color: "chart-2"
              },
              {
                number: "3",
                icon: <BellRing className="w-7 h-7" />,
                title: "Stay on Track",
                description: "Get smart reminders for OA deadlines, interviews, and follow-ups. All automatic.",
                color: "chart-4"
              },
            ].map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true, margin: "-50px" }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step number circle */}
                <motion.div
                  className={`relative z-10 w-12 h-12 rounded-full bg-${step.color} flex items-center justify-center text-white font-bold text-lg shadow-lg mb-6`}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    backgroundColor: step.color === 'chart-1' ? 'hsl(var(--chart-1))' :
                      step.color === 'chart-2' ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-4))',
                    boxShadow: `0 8px 24px ${step.color === 'chart-1' ? 'hsl(var(--chart-1) / 0.4)' :
                      step.color === 'chart-2' ? 'hsl(var(--chart-2) / 0.4)' : 'hsl(var(--chart-4) / 0.4)'}`
                  }}
                >
                  {step.number}
                </motion.div>

                {/* Icon */}
                <motion.div
                  className="p-4 rounded-2xl bg-card border border-border/50 mb-5 shadow-sm"
                  whileHover={{ y: -4, scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div style={{
                    color: step.color === 'chart-1' ? 'hsl(var(--chart-1))' :
                      step.color === 'chart-2' ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-4))'
                  }}>
                    {step.icon}
                  </div>
                </motion.div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="relative z-10 px-6 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-2/10 border border-chart-2/20 mb-6"
            whileHover={{ scale: 1.05 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Target className="w-4 h-4 text-chart-2" />
            </motion.div>
            <span className="text-sm font-medium">Powerful Features</span>
          </motion.div>
          <motion.h2
            className="text-3xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Everything you need to <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">land that offer</span>
          </motion.h2>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Featured Card - Gmail Auto-Sync - Spans 2 cols on lg */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, margin: "-50px" }}
            className="lg:col-span-2 group"
          >
            <Card className="relative h-full min-h-[280px] p-8 overflow-hidden bg-gradient-to-br from-chart-1/10 via-card to-chart-2/5 border-chart-1/20 hover:border-chart-1/40 transition-all duration-500 hover:shadow-xl hover:shadow-chart-1/10">
              {/* Animated gradient orb */}
              <motion.div
                className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-chart-1/20 to-chart-2/20 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative z-10">
                <motion.div
                  className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-chart-1 to-chart-2 text-white mb-6 shadow-lg shadow-chart-1/30"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Mail className="w-7 h-7" />
                </motion.div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold">Gmail Auto-Sync</h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-chart-1/20 text-chart-1 rounded-full">Popular</span>
                </div>
                <p className="text-muted-foreground max-w-md leading-relaxed">
                  Automatically imports applications from Greenhouse, Lever, Workday & 50+ ATS platforms. No manual entry needed—just connect and go.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {['Greenhouse', 'Lever', 'Workday', 'Ashby', '+50 more'].map((ats) => (
                    <span key={ats} className="px-3 py-1 text-xs bg-background/50 border border-border/50 rounded-full text-muted-foreground">
                      {ats}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Smart Task Generation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="group"
          >
            <Card className="relative h-full min-h-[280px] p-6 overflow-hidden bg-card/50 backdrop-blur-xl border-border/50 hover:border-chart-2/40 transition-all duration-500 hover:shadow-lg">
              <motion.div
                className="p-3 rounded-xl bg-chart-2/10 w-fit mb-4"
                whileHover={{ scale: 1.1, rotate: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Calendar className="w-6 h-6 text-chart-2" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-2 transition-colors">Smart Task Generation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                OA deadlines, interview dates, and follow-up reminders created automatically.
              </p>
              {/* Mini preview */}
              <div className="space-y-2 mt-auto">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/30">
                  <div className="w-2 h-2 rounded-full bg-chart-2" />
                  <span className="text-xs text-muted-foreground">OA Due: Google - 3 days</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/30">
                  <div className="w-2 h-2 rounded-full bg-chart-4" />
                  <span className="text-xs text-muted-foreground">Interview: Meta - Tomorrow</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Application Insights */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            viewport={{ once: true, margin: "-50px" }}
            className="group"
          >
            <Card className="relative h-full min-h-[240px] p-6 overflow-hidden bg-card/50 backdrop-blur-xl border-border/50 hover:border-chart-3/40 transition-all duration-500 hover:shadow-lg">
              <motion.div
                className="p-3 rounded-xl bg-chart-3/10 w-fit mb-4"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <BarChart3 className="w-6 h-6 text-chart-3" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-3 transition-colors">Application Insights</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                See your funnel, response rates, and identify what&apos;s working.
              </p>
              {/* Mini chart preview */}
              <div className="flex items-end gap-1 mt-4 h-12">
                {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-chart-3/40 to-chart-3/80 rounded-t"
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                    viewport={{ once: true }}
                  />
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Response Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true, margin: "-50px" }}
            className="group"
          >
            <Card className="relative h-full min-h-[240px] p-6 overflow-hidden bg-card/50 backdrop-blur-xl border-border/50 hover:border-chart-4/40 transition-all duration-500 hover:shadow-lg">
              <motion.div
                className="p-3 rounded-xl bg-chart-4/10 w-fit mb-4"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <TrendingUp className="w-6 h-6 text-chart-4" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-4 transition-colors">Response Analytics</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Track which companies respond fastest and optimize your strategy.
              </p>
              {/* Response time indicator */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg. Response</span>
                  <span className="font-medium text-chart-4">4.2 days</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-chart-4 to-chart-1 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: '65%' }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    viewport={{ once: true }}
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Timeline View - Spans 2 cols on lg */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            viewport={{ once: true, margin: "-50px" }}
            className="lg:col-span-2 group"
          >
            <Card className="relative h-full min-h-[200px] p-6 overflow-hidden bg-card/50 backdrop-blur-xl border-border/50 hover:border-chart-1/40 transition-all duration-500 hover:shadow-lg">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <motion.div
                    className="p-3 rounded-xl bg-chart-1/10 w-fit mb-4"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Clock className="w-6 h-6 text-chart-1" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-1 transition-colors">Timeline View</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                    See your entire job search journey. Never lose track of where you are.
                  </p>
                </div>
                {/* Timeline preview */}
                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                  {['Applied', 'OA', 'Phone', 'Onsite', 'Offer'].map((stage, i) => (
                    <motion.div
                      key={stage}
                      className="flex items-center"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + i * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <div className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${i < 3 ? 'bg-chart-1/20 text-chart-1' : 'bg-muted/50 text-muted-foreground'
                        }`}>
                        {stage}
                      </div>
                      {i < 4 && <div className={`w-4 md:w-8 h-0.5 ${i < 2 ? 'bg-chart-1/40' : 'bg-muted/30'}`} />}
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Instant Updates */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true, margin: "-50px" }}
            className="group"
          >
            <Card className="relative h-full min-h-[200px] p-6 overflow-hidden bg-card/50 backdrop-blur-xl border-border/50 hover:border-chart-2/40 transition-all duration-500 hover:shadow-lg">
              <motion.div
                className="p-3 rounded-xl bg-chart-2/10 w-fit mb-4"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Zap className="w-6 h-6 text-chart-2" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-2 transition-colors">Instant Updates</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Status changes detected in real-time. Know when you move forward.
              </p>
              {/* Notification preview */}
              <motion.div
                className="mt-4 p-3 rounded-xl bg-chart-2/5 border border-chart-2/20"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-chart-2 animate-pulse" />
                  <span className="text-xs font-medium">Stripe moved to Interview</span>
                </div>
              </motion.div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section id="stats-section" className="relative z-10 px-6 py-16 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <Card className="p-8 md:p-12 bg-gradient-to-br from-chart-1/5 via-card/50 to-chart-2/5 backdrop-blur-xl border-border/50 overflow-hidden relative">
            {/* Animated background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-chart-1/10 to-transparent rounded-full blur-3xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-chart-2/10 to-transparent rounded-full blur-3xl"
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="relative grid md:grid-cols-4 gap-8 text-center">
              <StatItem value="10K+" label="Active Job Seekers" delay={0} />
              <StatItem value="500K+" label="Applications Tracked" delay={0.1} />
              <StatItem value="98%" label="Time Saved on Tracking" delay={0.2} />
              <StatItem value="4.9★" label="App Store Rating" delay={0.3} />
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Privacy Section */}
      <section className="relative z-10 px-6 py-16 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <Card className="p-8 md:p-10 bg-card/50 backdrop-blur-xl border-border/50 overflow-hidden relative group">
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex flex-col md:flex-row items-start gap-8">
              <motion.div
                className="p-4 rounded-2xl bg-gradient-to-br from-chart-1/20 to-chart-2/20"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Shield className="w-10 h-10 text-chart-1" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-2xl md:text-3xl font-bold mb-2">Privacy-first by design</h3>
                <p className="text-muted-foreground mb-6 max-w-2xl">
                  We only read job-related emails. Your personal conversations stay private. Always.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    "Read-only access—we never send emails on your behalf",
                    "Only job-related emails are processed",
                    "Disconnect Gmail with one tap, anytime",
                    "No email content stored after processing",
                    "SOC 2 compliant infrastructure",
                    "Your data is never sold to third parties",
                  ].map((text, index) => (
                    <TrustPoint key={text} text={text} delay={index * 0.1} />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Loved by job seekers
          </h2>
          <p className="text-muted-foreground">See what others are saying about Basafy</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { quote: "I was using a spreadsheet to track 100+ applications. Basafy saved my sanity and helped me land my dream job at Google.", author: "Sarah K.", role: "SWE @ Google" },
            { quote: "The auto-generated tasks for OA deadlines are a game-changer. I never miss an assessment deadline anymore.", author: "Marcus T.", role: "New Grad @ Meta" },
            { quote: "Finally, an app that understands the chaos of job hunting. The insights helped me realize which companies actually respond.", author: "Emily R.", role: "Product Manager @ Stripe" },
          ].map((testimonial, index) => (
            <TestimonialCard key={testimonial.author} {...testimonial} delay={index * 0.15} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-24 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          viewport={{ once: true, margin: "-100px" }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-chart-1/20 via-transparent to-chart-2/20 rounded-3xl blur-3xl pulse-glow" />
          <motion.div
            className="relative bg-card/30 backdrop-blur-xl rounded-3xl border border-border/50 p-12 md:p-16 overflow-hidden"
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {/* Animated particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-chart-1/40 rounded-full"
                  style={{
                    left: `${10 + i * 12}%`,
                    top: `${20 + (i % 4) * 20}%`,
                  }}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.2, 0.8, 0.2],
                  }}
                  transition={{
                    duration: 3 + i * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>

            <motion.h2
              className="text-4xl md:text-5xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              Your next offer is waiting
            </motion.h2>
            <motion.p
              className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
            >
              Join thousands of job seekers who've simplified their search with Basafy
            </motion.p>
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
            >
              <motion.div
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  size="lg"
                  onClick={() => router.push('/wrapped')}
                  className="text-lg px-10 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-xl shadow-chart-1/30 group relative overflow-hidden shine"
                >
                  <Smartphone className="w-5 h-5 mr-2" />
                  Get Basafy Free
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </motion.div>
            <motion.p
              className="text-sm text-muted-foreground mt-6"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
            >
              Free forever for basic features. No credit card required.
            </motion.p>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="flex flex-col md:flex-row items-center justify-between gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2 p-[2px] shadow-lg shadow-chart-1/30">
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
            </motion.div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <motion.div whileHover={{ scale: 1.05 }}>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }}>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }}>
                <Link href="/support" className="hover:text-foreground transition-colors">
                  Support
                </Link>
              </motion.div>
              <span>© 2026 Basafy</span>
            </div>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}

// Component definitions

interface StatItemProps {
  value: string;
  label: string;
  delay?: number;
}

function StatItem({ value, label, delay = 0 }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.05 }}
    >
      <motion.p
        className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent mb-2"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.1, type: "spring", stiffness: 100 }}
        viewport={{ once: true }}
      >
        {value}
      </motion.p>
      <p className="text-muted-foreground">{label}</p>
    </motion.div>
  );
}

interface TrustPointProps {
  text: string;
  delay?: number;
}

function TrustPoint({ text, delay = 0 }: TrustPointProps) {
  return (
    <motion.div
      className="flex items-start gap-3 group"
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      viewport={{ once: true }}
    >
      <motion.div
        whileHover={{ scale: 1.2, rotate: 360 }}
        transition={{ duration: 0.3 }}
      >
        <CheckCircle2 className="w-5 h-5 text-chart-1 mt-0.5 flex-shrink-0" />
      </motion.div>
      <span className="text-sm group-hover:text-foreground transition-colors">{text}</span>
    </motion.div>
  );
}

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  delay?: number;
}

function TestimonialCard({ quote, author, role, delay = 0 }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: -10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, delay }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      style={{ transformPerspective: 1000 }}
    >
      <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/50 h-full hover:shadow-xl hover:shadow-chart-1/10 transition-all duration-300 group">
        <motion.div
          className="flex mb-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: delay + 0.2 }}
          viewport={{ once: true }}
        >
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.3 + i * 0.05 }}
              viewport={{ once: true }}
            >
              <Star className="w-4 h-4 fill-chart-4 text-chart-4" />
            </motion.div>
          ))}
        </motion.div>
        <p className="text-muted-foreground mb-6 leading-relaxed group-hover:text-foreground/80 transition-colors">"{quote}"</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chart-1 to-chart-2 flex items-center justify-center text-white font-semibold">
            {author.charAt(0)}
          </div>
          <div>
            <p className="font-semibold">{author}</p>
            <p className="text-sm text-muted-foreground">{role}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
