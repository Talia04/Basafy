'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useScroll, useTransform, useSpring } from 'motion/react';
import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Mail,
  BarChart3,
  TrendingUp,
  Shield,
  CheckCircle2,
  Calendar,
  BellRing,
  Zap,
  Target,
  Clock,
  ArrowRight,
  ChevronRight,
  Smartphone,
  X,
  QrCode,
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

const setupSteps = [
  {
    number: "01",
    icon: Mail,
    title: "Connect Gmail",
    description: "Secure read-only access scans job-search emails without touching the rest of your inbox.",
    detail: "OAuth in one tap",
    color: "chart-1",
  },
  {
    number: "02",
    icon: Zap,
    title: "Auto-Sync",
    description: "Basafy detects Greenhouse, Lever, Workday, Ashby, and recruiter updates automatically.",
    detail: "No manual entry",
    color: "chart-2",
  },
  {
    number: "03",
    icon: BellRing,
    title: "Stay on Track",
    description: "Tasks, interview reminders, and follow-ups appear before anything slips.",
    detail: "Smart next steps",
    color: "chart-4",
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const [showGuide, setShowGuide] = useState(false);
  const [activeNav, setActiveNav] = useState('Product');
  const [showAppStoreModal, setShowAppStoreModal] = useState(false);
  const appStoreUrl = 'https://apps.apple.com/us/app/basafy/id6757215169';

  // Parallax transforms
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -100]);

  const navItems = [
    { label: 'Product', href: '#product' },
    { label: 'Setup', href: '#setup' },
    { label: 'Features', href: '#features' },
    { label: 'Privacy', href: '/privacy' },
  ];

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

      <AnimatePresence>
        {showAppStoreModal && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-background/78 backdrop-blur-xl"
              onClick={() => setShowAppStoreModal(false)}
              aria-label="Close App Store modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="app-store-modal-title"
              className="relative w-full max-w-[900px] overflow-hidden rounded-[36px] border border-white/12 bg-[#070a15]/92 shadow-[0_40px_140px_rgba(0,0,0,0.58),inset_0_1px_1px_rgba(255,255,255,0.14)] backdrop-blur-3xl"
              initial={{ opacity: 0, y: 34, scale: 0.94, filter: 'blur(14px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(10px)' }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(79,124,255,0.22),transparent_32%),radial-gradient(circle_at_88%_68%,rgba(34,211,167,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.09),transparent_36%)]" />
              <motion.div
                className="pointer-events-none absolute left-[-30%] top-[-60%] h-[220%] w-[42%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent)]"
                animate={{ left: ['-35%', '120%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ rotate: 18 }}
              />
              <button
                type="button"
                onClick={() => setShowAppStoreModal(false)}
                className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.07] text-muted-foreground backdrop-blur-xl transition hover:bg-white/[0.12] hover:text-white"
                aria-label="Close App Store modal"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative z-10 grid gap-8 p-5 md:grid-cols-[0.95fr_1.05fr] md:p-8">
                <div className="flex flex-col justify-between gap-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                  <div>
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-chart-1/28 to-chart-2/18 shadow-[0_0_34px_rgba(79,124,255,0.25)]">
                      <QrCode className="h-7 w-7 text-chart-1" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Basafy for iPhone
                    </p>
                    <h2 id="app-store-modal-title" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                      Scan to open Basafy on the App Store.
                    </h2>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground md:text-base">
                      Point your phone camera at the code, then download Basafy directly from the App Store.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <a
                      href={appStoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(124,58,237,0.9),rgba(34,211,238,0.78))] px-5 py-4 font-semibold text-white shadow-[0_0_32px_rgba(124,58,237,0.35),inset_0_1px_1px_rgba(255,255,255,0.3)] transition hover:opacity-95"
                    >
                      Open App Store
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Link opens Apple&apos;s App Store listing in a new tab.
                    </p>
                  </div>
                </div>

                <div className="relative flex min-h-[420px] items-center justify-center rounded-[30px] border border-white/10 bg-black/24 p-6">
                  <div className="absolute inset-8 rounded-full bg-chart-1/14 blur-3xl" />
                  <motion.div
                    className="relative rounded-[34px] border border-white/16 bg-white p-5 shadow-[0_30px_100px_rgba(0,0,0,0.44)]"
                    initial={{ rotateX: 8, rotateY: -10 }}
                    animate={{ rotateX: [8, 4, 8], rotateY: [-10, -4, -10], y: [0, -8, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <QRCodeSVG
                      value={appStoreUrl}
                      size={292}
                      level="H"
                      marginSize={4}
                      bgColor="#ffffff"
                      fgColor="#020617"
                      title="Basafy App Store QR code"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-[34px] border border-black/8" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
      <motion.nav
        className="fixed left-0 right-0 top-4 z-40 mx-auto max-w-7xl px-4 md:px-6"
      >
        <motion.div
          className="relative mx-auto flex items-center justify-between overflow-hidden rounded-full border border-white/18 bg-white/[0.08] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_0_30px_rgba(99,102,241,0.22),0_20px_60px_rgba(0,0,0,0.35)] md:px-5"
          style={{
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          <motion.div
            className="pointer-events-none absolute top-[-60%] h-[220%] w-[42%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.34),transparent)]"
            animate={{ left: ['-55%', '112%', '112%'], opacity: [0, 1, 0] }}
            transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.55, 1] }}
            style={{ rotate: 20 }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-75 blur-xl">
            <motion.div
              className="absolute left-[16%] top-[34%] h-9 w-20 rounded-full bg-violet-500/28"
              animate={{ x: [0, 18, 0], y: [0, -6, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[18%] top-[42%] h-10 w-24 rounded-full bg-cyan-400/20"
              animate={{ x: [0, -16, 0], y: [0, 7, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[8%] top-[22%] h-7 w-12 rounded-full bg-amber-300/16"
              animate={{ opacity: [0.35, 0.72, 0.35] }}
              transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <motion.a
            href="#"
            className="relative z-10 flex items-center gap-2 pr-3"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 via-violet-400 to-chart-2 p-[2px] shadow-lg shadow-chart-1/30"
              animate={{ filter: ['drop-shadow(0 0 0 rgba(124,58,237,0))', 'drop-shadow(0 0 12px rgba(124,58,237,0.45))', 'drop-shadow(0 0 0 rgba(124,58,237,0))'] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src="/basafy-icon.png" alt="Basafy" className="h-full w-full rounded-[10px]" />
            </motion.div>
            <span className="hidden text-lg font-bold tracking-tight sm:inline">Basafy</span>
          </motion.a>

          <div className="relative z-10 hidden items-center gap-1 rounded-full border border-white/8 bg-black/10 p-1 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onMouseEnter={() => setActiveNav(item.label)}
                onFocus={() => setActiveNav(item.label)}
                onClick={() => setActiveNav(item.label)}
                className="relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition duration-300 hover:-translate-y-px hover:text-white hover:[text-shadow:0_0_14px_rgba(255,255,255,0.45)]"
              >
                {activeNav === item.label && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,58,237,0.38),rgba(34,211,238,0.22),rgba(34,211,167,0.16))] shadow-[inset_0_1px_1px_rgba(255,255,255,0.24),0_0_24px_rgba(99,102,241,0.22)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </a>
            ))}
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="hidden h-[18px] w-px bg-gradient-to-b from-transparent via-white/25 to-transparent md:block" />
            <motion.div whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={() => router.push('/wrapped')}
                className="relative overflow-hidden rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,58,237,0.92),rgba(34,211,238,0.82))] px-5 shadow-[0_0_24px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.35)] hover:opacity-95"
              >
                <motion.span
                  className="absolute inset-y-0 left-[-45%] w-[42%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.45),transparent)]"
                  animate={{ left: ['-45%', '115%'] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden="true"
                />
                <span className="relative z-10">Get Started</span>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.nav>
      <div className="h-20" aria-hidden="true" />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative z-10 overflow-hidden px-4 pb-20 pt-10 md:px-6 md:pb-24">
        <motion.div
          style={{ y: heroY }}
          className="relative mx-auto min-h-[860px] max-w-7xl overflow-hidden rounded-[40px] border border-white/10 bg-[#050711] shadow-[0_60px_180px_rgba(0,0,0,0.46)] md:min-h-[780px]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_40%,rgba(71,117,255,0.2),transparent_34%),radial-gradient(circle_at_90%_78%,rgba(34,211,167,0.14),transparent_28%),linear-gradient(135deg,#080b18_0%,#03040b_58%,#070914_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.024)_1px,transparent_1px)] bg-[size:88px_88px] opacity-18 [mask-image:radial-gradient(circle_at_68%_46%,black,transparent_76%)]" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-background/75 via-[#050711]/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/55 to-transparent" />

          {[0, 1, 2, 3, 4].map((particle) => (
            <motion.span
              key={particle}
              className="absolute h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.75)]"
              style={{
                left: `${46 + particle * 8}%`,
                top: `${22 + (particle % 3) * 18}%`,
              }}
              animate={{
                y: [0, 14, 0],
                opacity: [0.12, 0.65, 0.12],
                scale: [0.7, 1.15, 0.7],
              }}
              transition={{
                duration: 4 + particle * 0.35,
                repeat: Infinity,
                delay: particle * 0.4,
                ease: "easeInOut",
              }}
              aria-hidden="true"
            />
          ))}

          <div className="relative z-20 grid min-h-[780px] gap-10 px-5 py-10 md:grid-cols-[0.9fr_1.35fr] md:px-10 md:py-14 lg:px-14">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl self-center"
            >
              <h1 className="text-5xl font-bold leading-[0.96] tracking-tight md:text-7xl">
                Basafy turns job-search noise into control.
              </h1>
              <p className="mt-6 text-base leading-7 text-muted-foreground md:text-lg">
                Connect Gmail and Basafy organizes applications, tasks, reminders, and progress into one live dashboard.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    onClick={() => router.push('/wrapped')}
                    className="group relative w-full overflow-hidden bg-gradient-to-r from-chart-1 to-chart-2 px-8 py-6 text-lg shadow-xl shadow-chart-1/30 hover:opacity-90 sm:w-auto"
                  >
                    <Smartphone className="mr-2 h-5 w-5" />
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setShowGuide(true)}
                    className="w-full border-white/10 bg-white/[0.055] px-8 py-6 text-lg backdrop-blur-2xl hover:bg-white/[0.09] sm:w-auto"
                  >
                    Try Web Demo
                  </Button>
                </motion.div>
              </div>

              <motion.button
                type="button"
                onClick={() => setShowAppStoreModal(true)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3, scale: 1.015 }}
                whileTap={{ scale: 0.99 }}
                className="group mt-6 block w-full max-w-md rounded-[28px] border border-white/12 bg-white/[0.065] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_1px_rgba(255,255,255,0.14)] backdrop-blur-3xl transition hover:border-chart-1/35"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-br from-white/16 to-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]">
                    <Smartphone className="h-6 w-6 text-chart-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">iOS App</p>
                    <p className="mt-1 text-lg font-semibold">
                      Download on the App Store
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-chart-1 to-chart-2 text-white shadow-[0_0_24px_rgba(124,58,237,0.35)] transition group-hover:translate-x-1">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </motion.button>

              <div className="mt-6 flex max-w-md flex-col gap-2 text-xs text-muted-foreground/90">
                <span>Read-only Gmail access for job-related messages.</span>
                <span>
                  <a href="/privacy" className="text-chart-1 hover:underline">Privacy Policy</a>
                  {' '}and{' '}
                  <a href="/terms" className="text-chart-1 hover:underline">Terms of Service</a>
                </span>
              </div>
            </motion.div>

            <div className="relative min-h-[620px] md:min-h-[680px]">
              <motion.div
                initial={{ opacity: 0, y: 42, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-1/2 top-[44px] z-20 w-[286px] -translate-x-1/2 md:w-[330px]"
              >
                <div className="absolute -inset-12 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="relative rounded-[46px] border border-white/20 bg-gradient-to-b from-zinc-700 to-black p-2 shadow-[0_42px_120px_rgba(0,0,0,0.62)]">
                  <div className="absolute left-1/2 top-3 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />
                  <div className="overflow-hidden rounded-[38px] border border-white/8 bg-[#070b13] px-4 pb-5 pt-12">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">This week</p>
                        <h2 className="text-2xl font-semibold">Dashboard</h2>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06]">
                        <BarChart3 className="h-5 w-5 text-chart-1" />
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                        ['Apps', '128', 'text-blue-300'],
                        ['Tasks', '27', 'text-violet-300'],
                        ['Offers', '3', 'text-amber-200'],
                      ].map(([label, value, color]) => (
                        <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.055] p-3">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.045] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Application progress</p>
                        <p className="text-[11px] text-muted-foreground">May</p>
                      </div>
                      <div className="flex h-20 items-end gap-1.5">
                        {[18, 28, 34, 46, 52, 62, 58, 70, 76, 74, 86, 92].map((height, index) => (
                          <div
                            key={index}
                            className="flex-1 rounded-t bg-gradient-to-t from-chart-2/45 to-chart-1"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {[
                        ['Portfolio Review', 'Today 10:00 AM', 'G'],
                        ['Phone Screen', 'Tomorrow', 'S'],
                      ].map(([title, time, icon]) => (
                        <div key={title} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-chart-1/18 text-sm font-semibold text-chart-1">{icon}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{title}</p>
                            <p className="text-xs text-muted-foreground">{time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -34, y: 18, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.75, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-0 top-[92px] z-10 w-[260px] rounded-[28px] border border-white/12 bg-white/[0.065] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-3xl md:left-[2%]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Detected email</p>
                  <Mail className="h-4 w-4 text-blue-300" />
                </div>
                <p className="text-xs text-muted-foreground">Greenhouse</p>
                <p className="mt-1 text-sm font-medium">Interview request for Product Designer</p>
                <div className="mt-3 rounded-2xl bg-blue-500/12 px-3 py-2 text-xs text-blue-200">Auto-created application</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 34, y: 28, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.75, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-[210px] z-30 w-[260px] rounded-[28px] border border-white/12 bg-white/[0.07] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-3xl md:right-[1%]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Application status</p>
                  <span className="rounded-full bg-amber-400/14 px-2.5 py-1 text-[11px] font-semibold text-amber-200">Screening</span>
                </div>
                <p className="text-lg font-semibold">Stripe</p>
                <p className="text-xs text-muted-foreground">Product Designer</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl bg-white/[0.045] p-3">
                    <p className="text-muted-foreground">Applied</p>
                    <p className="mt-1 font-medium">Jun 24</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.045] p-3">
                    <p className="text-muted-foreground">Next</p>
                    <p className="mt-1 font-medium">Follow-up</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 34, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.75, delay: 0.46, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-[36px] left-1/2 z-10 w-[min(420px,90vw)] -translate-x-1/2 rounded-[30px] border border-white/12 bg-white/[0.065] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-3xl"
              >
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="text-sm font-semibold">Upcoming reminders</p>
                    <p className="mt-1 text-xs text-muted-foreground">2 tasks generated from email updates</p>
                  </div>
                  <Calendar className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs text-emerald-200">Portfolio review</span>
                  <span className="rounded-full bg-violet-400/12 px-3 py-1 text-xs text-violet-200">Phone screen</span>
                </div>
              </motion.div>
            </div>
          </div>
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

/* ── Setup Pathway Card ─────────────────────────────────────────── */

function SetupCard({
  stepNumber,
  stepLabel,
  title,
  accentColor,
  icon,
  glowIntensity = 'normal',
  children,
}: {
  stepNumber: string;
  stepLabel: string;
  title: string;
  accentColor: string;
  icon: React.ReactNode;
  glowIntensity?: 'normal' | 'strong';
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full">
      {/* Glow backdrop */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] ${glowIntensity === 'strong' ? 'h-80 w-80 opacity-30' : 'h-64 w-64 opacity-20'}`}
        style={{ backgroundColor: `var(--${accentColor})` }}
      />
      <Card className={`relative overflow-hidden rounded-[28px] border-white/10 bg-[#0a0e1a]/85 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.5)] backdrop-blur-3xl ${glowIntensity === 'strong' ? 'border-emerald-400/12' : ''}`}>
        {/* Glass highlight */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.1),rgba(255,255,255,0.015)_50%,rgba(255,255,255,0.05))]" />
        {/* Top refraction */}
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]"
                style={{ color: `var(--${accentColor})` }}
              >
                {icon}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">{stepLabel}</p>
                <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
              </div>
            </div>
            <span className="rounded-full border border-white/6 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-bold text-white/25">{stepNumber}</span>
          </div>

          {children}
        </div>
      </Card>
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
