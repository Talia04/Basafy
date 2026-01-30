'use client';

import { useRouter } from 'next/navigation';
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
  
  // Parallax transforms
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -100]);
  const phoneY = useTransform(smoothProgress, [0, 0.4], [0, -50]);
  const bgScale = useTransform(smoothProgress, [0, 1], [1, 1.2]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted overflow-hidden grain">
      <QuickStartGuide />

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
          <button
            onClick={() => router.push('/privacy')}
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hidden sm:block hover:scale-105"
          >
            Privacy
          </button>
          <button
            onClick={() => router.push('/support')}
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hidden sm:block hover:scale-105"
          >
            Support
          </button>
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-1/10 border border-chart-1/20 mb-8 neo-btn cursor-default"
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
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto"
          >
            No more spreadsheets. No missed deadlines. Just clarity.
          </motion.p>

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
                onClick={() => router.push('/wrapped')}
                className="text-lg px-8 py-6 w-full sm:w-auto neo-btn border-0"
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
                  <div className="p-3 rounded-xl bg-chart-1/10 border border-chart-1/20 neo-flat">
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
                  <div className="p-3 rounded-xl bg-chart-2/10 border border-chart-2/20 neo-flat">
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
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2 neo-flat">
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
            <Card className="p-4 bg-card/90 backdrop-blur-xl border-border/50 shadow-xl max-w-[200px] neo-convex hover-lift">
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
            <Card className="p-4 bg-card/90 backdrop-blur-xl border-border/50 shadow-xl max-w-[220px] neo-convex hover-lift">
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
            <Card className="p-4 bg-card/90 backdrop-blur-xl border-border/50 shadow-xl max-w-[180px] neo-convex hover-lift">
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
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <motion.h2 
            className="text-3xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            How it works
          </motion.h2>
          <motion.p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            From inbox chaos to job search clarity in 3 simple steps
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { number: "01", icon: <Mail className="w-8 h-8" />, title: "Connect Gmail", description: "Secure read-only access. We scan for job emails, nothing else. Disconnect anytime.", gradient: "from-chart-1 to-chart-2" },
            { number: "02", icon: <Sparkles className="w-8 h-8" />, title: "Auto-Sync Applications", description: "Basafy detects applications from Greenhouse, Lever, Workday & 50+ ATS platforms automatically.", gradient: "from-chart-2 to-chart-3" },
            { number: "03", icon: <BellRing className="w-8 h-8" />, title: "Never Miss a Beat", description: "Get reminders for OA deadlines, interview prep, and follow-ups. All created automatically.", gradient: "from-chart-4 to-chart-1" },
          ].map((step, index) => (
            <StepCard key={step.number} {...step} delay={index * 0.15} />
          ))}
        </div>
      </section>

      {/* Key Features */}
      <section className="relative z-10 px-6 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-2/10 border border-chart-2/20 mb-6 neo-btn"
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
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent gradient-shift bg-[length:200%_200%]">land that offer</span>
          </motion.h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Mail className="w-6 h-6" />, title: "Gmail Auto-Sync", description: "Automatically imports applications from 50+ ATS platforms. No manual entry needed.", highlight: true },
            { icon: <Calendar className="w-6 h-6" />, title: "Smart Task Generation", description: "OA deadlines, interview dates, and follow-up reminders created automatically from your emails." },
            { icon: <BarChart3 className="w-6 h-6" />, title: "Application Insights", description: "See your funnel, response rates, best application days, and identify what's working." },
            { icon: <TrendingUp className="w-6 h-6" />, title: "Response Analytics", description: "Track which companies respond fastest and optimize your targeting strategy." },
            { icon: <Clock className="w-6 h-6" />, title: "Timeline View", description: "See your entire job search journey on a beautiful timeline. Never lose track." },
            { icon: <Zap className="w-6 h-6" />, title: "Instant Updates", description: "Status changes detected in real-time. Know when you move forward instantly." },
          ].map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} delay={index * 0.1} />
          ))}
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
          <Card className="p-8 md:p-12 bg-gradient-to-br from-chart-1/5 via-card/50 to-chart-2/5 backdrop-blur-xl border-border/50 neo-convex overflow-hidden relative">
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
          <Card className="p-8 md:p-10 bg-card/50 backdrop-blur-xl border-border/50 neo-convex overflow-hidden relative group">
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative flex flex-col md:flex-row items-start gap-8">
              <motion.div 
                className="p-4 rounded-2xl bg-gradient-to-br from-chart-1/20 to-chart-2/20 neo-flat"
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
            className="relative bg-card/30 backdrop-blur-xl rounded-3xl border border-border/50 p-12 md:p-16 neo-convex overflow-hidden"
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
              <motion.button 
                onClick={() => router.push('/privacy')} 
                className="hover:text-foreground transition-colors"
                whileHover={{ scale: 1.05 }}
              >
                Privacy Policy
              </motion.button>
              <motion.button 
                onClick={() => router.push('/support')} 
                className="hover:text-foreground transition-colors"
                whileHover={{ scale: 1.05 }}
              >
                Support
              </motion.button>
              <span>© 2026 Basafy</span>
            </div>
          </motion.div>
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
  delay?: number;
}

function StepCard({ number, icon, title, description, gradient, delay = 0 }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
    >
      <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/50 hover:border-chart-1/30 transition-all duration-500 h-full relative overflow-hidden group neo-convex hover:shadow-xl hover:shadow-chart-1/10">
        {/* Animated number background */}
        <motion.div 
          className={`absolute top-0 right-0 text-8xl font-bold bg-gradient-to-br ${gradient} bg-clip-text text-transparent opacity-10`}
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.2 }}
          viewport={{ once: true }}
        >
          {number}
        </motion.div>
        <motion.div 
          className="absolute top-0 right-0 text-8xl font-bold bg-gradient-to-br from-chart-1 to-chart-2 bg-clip-text text-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        >
          {number}
        </motion.div>
        
        {/* Icon with animation */}
        <motion.div 
          className={`p-3 rounded-xl bg-gradient-to-br ${gradient} w-fit mb-6 shadow-lg`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="text-white">{icon}</div>
        </motion.div>
        
        <h3 className="text-xl font-semibold mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        
        {/* Hover gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none`} />
      </Card>
    </motion.div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
  delay?: number;
}

function FeatureCard({ icon, title, description, highlight, delay = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
    >
      <Card className={`p-6 backdrop-blur-xl border-border/50 transition-all duration-300 h-full group hover:shadow-lg ${highlight ? 'bg-gradient-to-br from-chart-1/10 to-chart-2/5 border-chart-1/20 neo-convex hover:shadow-chart-1/20' : 'bg-card/50 neo-flat hover:shadow-black/5'}`}>
        <motion.div 
          className={`p-3 rounded-xl w-fit mb-4 ${highlight ? 'bg-gradient-to-br from-chart-1 to-chart-2 text-white shadow-lg shadow-chart-1/30' : 'bg-chart-1/10 text-chart-1'}`}
          whileHover={{ scale: 1.1, rotate: highlight ? 10 : 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {icon}
        </motion.div>
        <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-1 transition-colors duration-300">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </Card>
    </motion.div>
  );
}

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
      <Card className="p-6 bg-card/50 backdrop-blur-xl border-border/50 h-full neo-convex hover:shadow-xl hover:shadow-chart-1/10 transition-all duration-300 group">
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
