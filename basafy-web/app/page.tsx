'use client';

import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { useState, useRef } from 'react';
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
  MousePointer2,
} from 'lucide-react';
import QuickStartGuide from '../components/QuickStartGuide';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

/* ── Gallery image data ────────────────────────────────────────── */
const galleryImages = [
  {
    src: '/graphics/basafy-gallery/screen-mock-1/basafy-screen-mock-1-slice-01.png',
    alt: 'Basafy analytics screen panorama slice 1',
  },
  {
    src: '/graphics/basafy-gallery/screen-mock-1/basafy-screen-mock-1-slice-02.png',
    alt: 'Basafy email parsing screen panorama slice 2',
  },
  {
    src: '/graphics/basafy-gallery/screen-mock-1/basafy-screen-mock-1-slice-03.png',
    alt: 'Basafy dashboard screen panorama slice 3',
  },
  {
    src: '/graphics/basafy-gallery/screen-mock-1/basafy-screen-mock-1-slice-04.png',
    alt: 'Basafy applications screen panorama slice 4',
  },
  {
    src: '/graphics/basafy-gallery/screen-mock-1/basafy-screen-mock-1-slice-05.png',
    alt: 'Basafy tasks screen panorama slice 5',
  },
];

const featurePhones = [
  {
    src: '/graphics/basafy-feature-phones/generated/basafy-feature-pipeline-phone-normalized.png',
    alt: 'Basafy Applications pipeline iPhone mockup',
    label: 'Pipeline',
    desc: 'Track every application'
  },
  {
    src: '/graphics/basafy-feature-phones/generated/basafy-feature-tasks-phone-normalized.png',
    alt: 'Basafy Tasks iPhone mockup',
    label: 'Tasks',
    desc: 'Never miss a deadline'
  },
  {
    src: '/graphics/basafy-feature-phones/generated/basafy-feature-insights-phone-normalized.png',
    alt: 'Basafy Insights iPhone mockup',
    label: 'Insights',
    desc: 'Know what works'
  },
];

export default function HomePage() {
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const [showGuide, setShowGuide] = useState(false);

  // Parallax transforms
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -100]);

  // iPhone cards scroll expansion
  const cardsRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: cardsProgress } = useScroll({
    target: cardsRef,
    offset: ['start end', 'end start']
  });
  const smoothCards = useSpring(cardsProgress, { stiffness: 80, damping: 25, restDelta: 0.001 });

  const card1X = useTransform(smoothCards, [0.1, 0.45], [40, -320]);
  const card1Rotate = useTransform(smoothCards, [0.1, 0.45], [-8, 0]);
  const card1Scale = useTransform(smoothCards, [0.1, 0.45], [0.92, 1]);
  const card2Scale = useTransform(smoothCards, [0.1, 0.45], [0.95, 1]);
  const card2Y = useTransform(smoothCards, [0.1, 0.45], [20, 0]);
  const card3X = useTransform(smoothCards, [0.1, 0.45], [-40, 320]);
  const card3Rotate = useTransform(smoothCards, [0.1, 0.45], [8, 0]);
  const card3Scale = useTransform(smoothCards, [0.1, 0.45], [0.92, 1]);
  const labelOpacity = useTransform(smoothCards, [0.4, 0.55], [0, 1]);

  // Curved gallery cylinder scroll
  const galleryRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: galleryProgress } = useScroll({
    target: galleryRef,
    offset: ['start end', 'end start']
  });
  const smoothGallery = useSpring(galleryProgress, { stiffness: 60, damping: 20 });

  // Cylinder rotation: the whole band rotates on Y-axis
  const bandRotateY = useTransform(smoothGallery, [0, 1], [-18, 18]);
  const bandX = useTransform(smoothGallery, [0, 1], ['-8%', '8%']);

  // Keep individual panels unwarped so the sliced master image stays aligned.
  const panelRotations = [-5, -2.5, 0, 2.5, 5];
  const panelDepths = [-18, -8, 0, -8, -18];

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
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
            // ignore
          }
          setShowGuide(false);
          router.push('/wrapped/story');
        }}
      />

      {/* Scroll progress */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-chart-1 via-chart-4 to-chart-2 origin-left z-50"
        style={{ scaleX: smoothProgress }}
      />

      {/* Ambient gradient mesh background — no blur blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-br from-chart-1/8 via-transparent to-chart-4/6" />
        <div className="absolute bottom-0 right-0 w-full h-[40vh] bg-gradient-to-tl from-chart-2/8 via-transparent to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-3 max-w-7xl mx-auto mt-3">
        <div className="flex items-center justify-between glass-liquid rounded-2xl px-6 py-3">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 p-[2px] shadow-lg shadow-chart-1/30">
              <img src="/basafy-icon.png" alt="Basafy" className="h-full w-full rounded-[10px]" />
            </div>
            <span className="text-xl font-bold tracking-tight">Basafy</span>
          </motion.div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300">Privacy Policy</a>
            <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300">Terms of Service</a>
            <a href="/support" className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300">Support</a>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => router.push('/wrapped')}
                className="bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-lg shadow-chart-1/30"
              >
                Get Started
              </Button>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pt-20 pb-28 max-w-7xl mx-auto">
        <motion.div style={{ y: heroY }} className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-refract mb-8 cursor-default"
          >
            <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
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
              className="inline-block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Stop tracking.
            </motion.span>
            <br />
            <motion.span
              className="inline-block bg-gradient-to-r from-chart-1 via-chart-4 to-chart-2 bg-clip-text text-transparent gradient-shift bg-[length:200%_200%]"
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
            Basafy reads your Gmail, tracks every application, and reminds you about interviews &amp; assessments&mdash;<span className="text-foreground font-medium">automatically</span>.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="text-base md:text-lg text-muted-foreground/80 mb-6 max-w-2xl mx-auto"
          >
            Turn your inbox into a clear pipeline, calendar, and to-do list so you always know what to do next.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto"
          >
            No more spreadsheets. No missed deadlines. Just clarity.
          </motion.p>

          <div className="mx-auto mb-10 max-w-3xl rounded-2xl glass-refract px-4 py-3 text-sm text-muted-foreground">
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
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                onClick={() => router.push('/wrapped')}
                className="text-lg px-8 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-xl shadow-chart-1/30 w-full sm:w-auto group relative overflow-hidden shine"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowGuide(true)}
                className="text-lg px-8 py-6 w-full sm:w-auto border-0 glass-refract"
              >
                Try Web Demo
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="flex flex-col items-center mt-12 text-muted-foreground"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
            <MousePointer2 className="w-5 h-5" />
          </motion.div>
          <span className="text-xs mt-2">Scroll to explore</span>
        </motion.div>
      </section>

      {/* ── Curved Panoramic Gallery ─────────────────────────── */}
      <section
        ref={galleryRef}
        className="relative z-10 py-8 md:py-16 overflow-hidden"
        style={{ perspective: '1200px' }}
      >
        {/* SVG mask for the curved band shape */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <clipPath id="curvedBand" clipPathUnits="objectBoundingBox">
              <path d="M 0 0.05 Q 0.5 0.15 1 0.05 L 1 0.95 Q 0.5 0.85 0 0.95 Z" />
            </clipPath>
          </defs>
        </svg>

        <motion.div
          className="relative mx-auto"
          style={{
            x: bandX,
            rotateY: bandRotateY,
            transformStyle: 'preserve-3d',
            width: '112%',
            maxWidth: '1680px',
            marginLeft: '-6%',
          }}
        >
          <div
            className="grid gap-2 md:gap-3"
            style={{
              gridTemplateColumns: 'repeat(5, 1fr)',
              aspectRatio: '1980 / 793',
              height: 'auto',
              clipPath: 'url(#curvedBand)',
              transformStyle: 'preserve-3d',
            }}
          >
            {galleryImages.map((img, i) => (
              <motion.div
                key={img.alt}
                className="relative overflow-hidden"
                style={{
                  rotateY: `${panelRotations[i]}deg`,
                  z: panelDepths[i],
                  transformStyle: 'preserve-3d',
                }}
              >
                <motion.img
                  src={img.src}
                  alt={img.alt}
                  loading={i === 2 ? 'eager' : 'lazy'}
                  className="w-full h-full object-fill"
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── iPhone Cards Section ──────────────────────────────── */}
      <section ref={cardsRef} className="relative z-10 py-24 md:py-32 max-w-7xl mx-auto min-h-[90vh] px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-refract mb-6"
            whileHover={{ scale: 1.05 }}
          >
            <Smartphone className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium">Three Views, Total Clarity</span>
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            See your job search{' '}
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">come alive</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Pipeline, tasks, and insights &mdash; all powered by your inbox
          </p>
        </motion.div>

        {/* Desktop: scroll-linked expansion */}
        <div className="hidden md:flex items-center justify-center relative h-[600px]">
          <motion.div style={{ x: card1X, rotate: card1Rotate, scale: card1Scale }} className="absolute z-10">
            <FeaturePhoneCard phone={featurePhones[0]} />
          </motion.div>
          <motion.div style={{ scale: card2Scale, y: card2Y }} className="absolute z-20">
            <FeaturePhoneCard phone={featurePhones[1]} />
          </motion.div>
          <motion.div style={{ x: card3X, rotate: card3Rotate, scale: card3Scale }} className="absolute z-10">
            <FeaturePhoneCard phone={featurePhones[2]} />
          </motion.div>
        </div>

        {/* Desktop labels */}
        <motion.div
          style={{ opacity: labelOpacity }}
          className="hidden md:flex items-start justify-between max-w-[980px] mx-auto mt-8 px-8"
        >
          {featurePhones.map((item) => (
            <div key={item.label} className="w-[300px] text-center">
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Mobile: vertical stack */}
        <div className="md:hidden flex flex-col items-center gap-8">
          {featurePhones.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              viewport={{ once: true, margin: "-50px" }}
              className="text-center"
            >
              <FeaturePhoneCard phone={item} />
              <p className="font-semibold text-sm mt-4">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 max-w-6xl mx-auto overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-20"
        >
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-refract mb-6" whileHover={{ scale: 1.05 }}>
            <Zap className="w-4 h-4 text-chart-1" />
            <span className="text-sm font-medium">Quick Setup</span>
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Get started in <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">3 steps</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            From inbox chaos to job search clarity in under 2 minutes
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line - desktop */}
          <div className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5">
            <motion.div
              className="h-full bg-gradient-to-r from-chart-1 via-chart-4 to-chart-2 rounded-full"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              viewport={{ once: true }}
              style={{ transformOrigin: "left" }}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {[
              { number: "1", icon: <Mail className="w-7 h-7" />, title: "Connect Gmail", description: "One-click secure connection. Read-only access to job emails only. Disconnect anytime.", color: "chart-1" },
              { number: "2", icon: <Sparkles className="w-7 h-7" />, title: "Auto-Sync", description: "AI detects applications from Greenhouse, Lever, Workday & 50+ ATS platforms instantly.", color: "chart-2" },
              { number: "3", icon: <BellRing className="w-7 h-7" />, title: "Stay on Track", description: "Get smart reminders for OA deadlines, interviews, and follow-ups. All automatic.", color: "chart-4" },
            ].map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true, margin: "-50px" }}
                className="relative flex flex-col items-center text-center"
              >
                <motion.div
                  className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg mb-6"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  style={{
                    backgroundColor: `var(--${step.color})`,
                    boxShadow: `0 8px 24px color-mix(in oklch, var(--${step.color}) 40%, transparent)`
                  }}
                >
                  {step.number}
                </motion.div>
                <motion.div
                  className="p-4 rounded-2xl glass-refract relative glass-edge-light mb-5"
                  whileHover={{ y: -4, scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div style={{ color: `var(--${step.color})` }}>{step.icon}</div>
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key Features ──────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-refract mb-6" whileHover={{ scale: 1.05 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
              <Target className="w-4 h-4 text-chart-2" />
            </motion.div>
            <span className="text-sm font-medium">Powerful Features</span>
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything you need to <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">land that offer</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Gmail Auto-Sync - 2 cols */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true, margin: "-50px" }} className="lg:col-span-2 group">
            <Card className="relative h-full min-h-[280px] p-8 overflow-hidden glass-liquid glass-edge-light border-chart-1/20 hover:border-chart-1/40 transition-all duration-500 hover:shadow-xl hover:shadow-chart-1/10">
              <motion.div
                className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-chart-1/15 to-chart-4/15 rounded-full blur-2xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative z-10">
                <motion.div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-chart-1 to-chart-2 text-white mb-6 shadow-lg shadow-chart-1/30" whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Mail className="w-7 h-7" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">Gmail Auto-Sync</h3>
                <p className="text-muted-foreground max-w-md leading-relaxed">
                  Automatically imports applications from Greenhouse, Lever, Workday &amp; 50+ ATS platforms. No manual entry needed&mdash;just connect and go.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {['Greenhouse', 'Lever', 'Workday', 'Ashby', '+50 more'].map((ats) => (
                    <span key={ats} className="px-3 py-1 text-xs glass-refract rounded-full text-muted-foreground">{ats}</span>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Smart Task Generation */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} viewport={{ once: true, margin: "-50px" }} className="group">
            <Card className="relative h-full min-h-[280px] p-6 overflow-hidden glass-refract glass-edge-light hover:border-chart-2/40 transition-all duration-500 hover:shadow-lg">
              <motion.div className="p-3 rounded-xl bg-chart-2/10 w-fit mb-4" whileHover={{ scale: 1.1, rotate: -5 }} transition={{ type: "spring", stiffness: 300 }}>
                <Calendar className="w-6 h-6 text-chart-2" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-2 transition-colors">Smart Task Generation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">OA deadlines, interview dates, and follow-up reminders created automatically.</p>
              <div className="space-y-2 mt-auto">
                <div className="flex items-center gap-2 p-2 rounded-lg glass"><div className="w-2 h-2 rounded-full bg-chart-2" /><span className="text-xs text-muted-foreground">OA Due: Google - 3 days</span></div>
                <div className="flex items-center gap-2 p-2 rounded-lg glass"><div className="w-2 h-2 rounded-full bg-chart-4" /><span className="text-xs text-muted-foreground">Interview: Meta - Tomorrow</span></div>
              </div>
            </Card>
          </motion.div>

          {/* Application Insights */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} viewport={{ once: true, margin: "-50px" }} className="group">
            <Card className="relative h-full min-h-[240px] p-6 overflow-hidden glass-refract glass-edge-light hover:border-chart-3/40 transition-all duration-500 hover:shadow-lg">
              <motion.div className="p-3 rounded-xl bg-chart-3/10 w-fit mb-4" whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
                <BarChart3 className="w-6 h-6 text-chart-3" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-3 transition-colors">Application Insights</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">See your funnel, response rates, and identify what&apos;s working.</p>
              <div className="flex items-end gap-1 mt-4 h-12">
                {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                  <motion.div key={i} className="flex-1 bg-gradient-to-t from-chart-3/40 to-chart-3/80 rounded-t" initial={{ height: 0 }} whileInView={{ height: `${h}%` }} transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }} viewport={{ once: true }} />
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Response Analytics */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true, margin: "-50px" }} className="group">
            <Card className="relative h-full min-h-[240px] p-6 overflow-hidden glass-refract glass-edge-light hover:border-chart-4/40 transition-all duration-500 hover:shadow-lg">
              <motion.div className="p-3 rounded-xl bg-chart-4/10 w-fit mb-4" whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
                <TrendingUp className="w-6 h-6 text-chart-4" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-4 transition-colors">Response Analytics</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Track which companies respond fastest and optimize your strategy.</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Avg. Response</span><span className="font-medium text-chart-4">4.2 days</span></div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-chart-4 to-chart-1 rounded-full" initial={{ width: 0 }} whileInView={{ width: '65%' }} transition={{ duration: 0.8, delay: 0.3 }} viewport={{ once: true }} />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Timeline View - 2 cols */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} viewport={{ once: true, margin: "-50px" }} className="lg:col-span-2 group">
            <Card className="relative h-full min-h-[200px] p-6 overflow-hidden glass-refract glass-edge-light hover:border-chart-1/40 transition-all duration-500 hover:shadow-lg">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <motion.div className="p-3 rounded-xl bg-chart-1/10 w-fit mb-4" whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Clock className="w-6 h-6 text-chart-1" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-1 transition-colors">Timeline View</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">See your entire job search journey. Never lose track of where you are.</p>
                </div>
                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                  {['Applied', 'OA', 'Phone', 'Onsite', 'Offer'].map((stage, i) => (
                    <motion.div key={stage} className="flex items-center" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.4 + i * 0.1 }} viewport={{ once: true }}>
                      <div className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${i < 3 ? 'bg-chart-1/20 text-chart-1' : 'bg-muted/50 text-muted-foreground'}`}>{stage}</div>
                      {i < 4 && <div className={`w-4 md:w-8 h-0.5 ${i < 2 ? 'bg-chart-1/40' : 'bg-muted/30'}`} />}
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Instant Updates */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} viewport={{ once: true, margin: "-50px" }} className="group">
            <Card className="relative h-full min-h-[200px] p-6 overflow-hidden glass-refract glass-edge-light hover:border-chart-2/40 transition-all duration-500 hover:shadow-lg">
              <motion.div className="p-3 rounded-xl bg-chart-2/10 w-fit mb-4" whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
                <Zap className="w-6 h-6 text-chart-2" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-chart-2 transition-colors">Instant Updates</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Status changes detected in real-time. Know when you move forward.</p>
              <motion.div className="mt-4 p-3 rounded-xl glass" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.5 }} viewport={{ once: true }}>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-chart-2 animate-pulse" /><span className="text-xs font-medium">Stripe moved to Interview</span></div>
              </motion.div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── Privacy Section ───────────────────────────────────── */}
      <section className="relative z-10 px-6 py-16 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true, margin: "-100px" }}>
          <Card className="p-8 md:p-10 glass-liquid relative glass-edge-light overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col md:flex-row items-start gap-8">
              <motion.div className="p-4 rounded-2xl bg-gradient-to-br from-chart-1/20 to-chart-2/20" whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: "spring", stiffness: 300 }}>
                <Shield className="w-10 h-10 text-chart-1" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-2xl md:text-3xl font-bold mb-2">Privacy-first by design</h3>
                <p className="text-muted-foreground mb-6 max-w-2xl">We only read job-related emails. Your personal conversations stay private. Always.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    "Read-only access\u2014we never send emails on your behalf",
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

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 max-w-7xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, type: "spring", stiffness: 100 }} viewport={{ once: true, margin: "-100px" }} className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-chart-1/15 via-chart-4/10 to-chart-2/15 rounded-3xl blur-2xl" />
          <motion.div className="relative glass-liquid rounded-3xl p-12 md:p-16 overflow-hidden" whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}>
            <motion.h2 className="text-4xl md:text-5xl font-bold mb-4" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} viewport={{ once: true }}>
              Your next offer is waiting
            </motion.h2>
            <motion.p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.3 }} viewport={{ once: true }}>
              Simplify your job search and never miss a deadline again
            </motion.p>
            <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} viewport={{ once: true }}>
              <motion.div whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" onClick={() => router.push('/wrapped')} className="text-lg px-10 py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 shadow-xl shadow-chart-1/30 group relative overflow-hidden shine">
                  <Smartphone className="w-5 h-5 mr-2" />
                  Get Basafy Free
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </motion.div>
            <motion.p className="text-sm text-muted-foreground mt-6" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.5 }} viewport={{ once: true }}>
              Free forever for basic features. No credit card required.
            </motion.p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="relative z-10 px-6 py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="flex flex-col md:flex-row items-center justify-between gap-6 glass-refract rounded-2xl px-6 py-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2 p-[2px] shadow-lg shadow-chart-1/30">
                <img src="/basafy-icon.png" alt="Basafy" className="h-full w-full rounded-[6px]" />
              </div>
              <div>
                <span className="font-semibold">Basafy</span>
                <p className="text-xs text-muted-foreground">Your job search, simplified.</p>
              </div>
            </motion.div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="/support" className="hover:text-foreground transition-colors">Support</a>
              <span>&copy; 2026 Basafy</span>
            </div>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}

/* ── iPhone Mockup Components ──────────────────────────────────── */

function FeaturePhoneCard({
  phone
}: {
  phone: {
    src: string;
    alt: string;
    label: string;
    desc: string;
  };
}) {
  return (
    <div className="relative flex aspect-[300/540] w-[min(300px,82vw)] items-center justify-center">
      <div className="absolute inset-x-8 bottom-5 h-16 rounded-full bg-black/45 blur-3xl" />
      <img
        src={phone.src}
        alt={phone.alt}
        loading="lazy"
        className="relative z-10 h-full w-auto max-w-full object-contain drop-shadow-[0_32px_44px_rgba(0,0,0,0.42)]"
      />
    </div>
  );
}

/* ── Shared Components ─────────────────────────────────────────── */

function TrustPoint({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.div className="flex items-start gap-3 group" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay }} viewport={{ once: true }}>
      <motion.div whileHover={{ scale: 1.2, rotate: 360 }} transition={{ duration: 0.3 }}>
        <CheckCircle2 className="w-5 h-5 text-chart-1 mt-0.5 flex-shrink-0" />
      </motion.div>
      <span className="text-sm group-hover:text-foreground transition-colors">{text}</span>
    </motion.div>
  );
}
