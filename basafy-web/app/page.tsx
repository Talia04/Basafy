'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BellRing,
  Calendar,
  CheckCircle2,
  Mail,
  Shield,
  Sparkles,
  Smartphone
} from 'lucide-react';
import QuickStartGuide from '../components/QuickStartGuide';
import { BASAFY_APP_STORE_URL } from '../lib/appLinks';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Trust', href: '#trust' },
  { label: 'Support', href: '/support' },
  { label: 'Contact', href: '#contact' }
];

const stackItems = [
  'Gmail',
  'Greenhouse',
  'Lever',
  'Workday',
  'Ashby',
  'Interview reminders',
  'Basafy Wrapped'
];

const featureCards = [
  {
    title: 'Inbox to pipeline',
    description:
      'Basafy reads job-related Gmail messages and turns them into a clean application tracker without manual entry.',
    tags: ['Read-only Gmail', 'Auto-detect'],
    accent: 'violet',
    icon: Mail
  },
  {
    title: 'Smart reminders',
    description:
      'Assessments, interviews, and follow-ups become visible before they slip through the cracks.',
    tags: ['Deadlines', 'Calendar'],
    accent: 'mint',
    icon: Calendar
  },
  {
    title: 'Search analytics',
    description:
      'See response patterns, funnel performance, and momentum so your search feels measurable instead of chaotic.',
    tags: ['Insights', 'Wrapped'],
    accent: 'gold',
    icon: BarChart3
  },
  {
    title: 'Privacy-first sync',
    description:
      'Only job-related email activity is processed. Disconnect whenever you want, with no spreadsheet cleanup afterward.',
    tags: ['Disconnect anytime', 'Privacy'],
    accent: 'rose',
    icon: Shield
  }
] as const;

const trustPoints = [
  'Read-only Gmail access',
  'Only job-related emails are processed',
  'Disconnect in a tap whenever you want'
];

const showcaseTheme = {
  '--showcase-background': '#0f0b16',
  '--showcase-foreground': '#f1ecff',
  '--showcase-muted': '#181321',
  '--showcase-muted-foreground': '#a89aca',
  '--showcase-border': 'rgba(255,255,255,0.08)',
  '--showcase-card': 'rgba(20,16,24,0.68)',
  '--showcase-primary': '#8b5cf6',
  '--showcase-secondary': '#6ee7b7',
  '--showcase-accent': '#f5b94c',
  '--showcase-danger': '#fb7185',
  '--showcase-success': '#22c55e'
} as CSSProperties;

export default function HomePage() {
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);

  const openAppStore = () => {
    window.open(BASAFY_APP_STORE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
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

      <div className="showcase-page" style={showcaseTheme}>
        <div className="showcase-noise-overlay" />
        <div className="showcase-orb showcase-orb-1" />
        <div className="showcase-orb showcase-orb-2" />
        <div className="showcase-orb showcase-orb-3" />

        <header className="showcase-nav-shell">
          <div className="showcase-nav-brand">
            <div className="showcase-brand-mark">
              <Image src="/basafy-icon.png" alt="Basafy" width={36} height={36} />
            </div>
            <span>Basafy</span>
          </div>

          <nav className="showcase-nav-pill" aria-label="Primary">
            {navLinks.map((link) => (
              <a key={link.label} className="showcase-nav-link" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <button type="button" className="showcase-nav-status" onClick={openAppStore}>
            <span>Live on App Store</span>
            <span className="showcase-status-dot" />
          </button>
        </header>

        <main>
          <section className="showcase-hero">
            <motion.div
              className="showcase-hero-copy"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="showcase-eyebrow">
                <Sparkles size={16} />
                <span>Gmail-powered job search clarity</span>
              </div>

              <h1 className="showcase-title">
                Basafy
                <br />
                <span>Wrapped</span>
              </h1>

              <p className="showcase-subtitle">
                Turn job-related emails into a living pipeline, reminders, and
                insights that actually help you move faster.
              </p>

              <div className="showcase-actions">
                <button type="button" className="showcase-primary-btn" onClick={openAppStore}>
                  Download on the App Store
                  <ArrowDownRight size={18} />
                </button>
                <button type="button" className="showcase-secondary-btn" onClick={() => setShowGuide(true)}>
                  Try Web Demo
                </button>
              </div>

              <div className="showcase-trust-bar">
                <p>
                  Basafy requests read-only Gmail access to identify job emails and
                  build your application pipeline automatically.
                </p>
                <div className="showcase-inline-links">
                  <a href="https://basafy.com/privacy">Privacy Policy</a>
                  <span>•</span>
                  <a href="https://basafy.com/terms">Terms of Service</a>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="showcase-hero-visual"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
            >
              <div className="showcase-liquid-frame">
                <div className="showcase-device">
                  <div className="showcase-device-top">
                    <div>
                      <p className="showcase-device-label">Today</p>
                      <h2>Search in motion</h2>
                    </div>
                    <div className="showcase-device-avatar">
                      <Image src="/basafy-icon.png" alt="Basafy icon" width={28} height={28} />
                    </div>
                  </div>

                  <div className="showcase-device-stats">
                    <div>
                      <span>Applications</span>
                      <strong>47</strong>
                    </div>
                    <div>
                      <span>Interviews</span>
                      <strong>12</strong>
                    </div>
                  </div>

                  <div className="showcase-device-panel">
                    <div className="showcase-device-panel-title">
                      <BellRing size={15} />
                      <span>Upcoming tasks</span>
                    </div>
                    <div className="showcase-task-item">
                      <span className="showcase-task-dot showcase-task-dot-danger" />
                      <div>
                        <strong>Stripe OA</strong>
                        <small>Due tomorrow</small>
                      </div>
                    </div>
                    <div className="showcase-task-item">
                      <span className="showcase-task-dot showcase-task-dot-primary" />
                      <div>
                        <strong>Google interview</strong>
                        <small>Friday, 2:00 PM</small>
                      </div>
                    </div>
                  </div>

                  <div className="showcase-device-feed">
                    <div className="showcase-feed-row">
                      <CheckCircle2 size={14} />
                      <span>Meta moved to interview</span>
                    </div>
                    <div className="showcase-feed-row">
                      <Mail size={14} />
                      <span>Amazon application detected</span>
                    </div>
                  </div>
                </div>
              </div>

              <motion.div
                className="showcase-floating-badge showcase-glass"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="showcase-floating-icon">
                  <Smartphone size={20} />
                </div>
                <div>
                  <div className="showcase-floating-title">iOS app</div>
                  <div className="showcase-floating-subtitle">Track continuously</div>
                </div>
              </motion.div>

              <motion.div
                className="showcase-floating-note showcase-glass"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              >
                <div className="showcase-note-title">Read-only Gmail sync</div>
                <div className="showcase-note-subtitle">Job-related email detection only</div>
              </motion.div>
            </motion.div>
          </section>

          <section className="showcase-marquee" aria-label="Supported workflows">
            <div className="showcase-marquee-track">
              {[...stackItems, ...stackItems].map((item, index) => (
                <span key={`${item}-${index}`} className="showcase-marquee-item">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="showcase-work-section" id="features">
            <div className="showcase-section-header">
              <h2>What Basafy handles</h2>
              <p>
                The homepage now follows your supplied glassy, liquid layout, but
                the content is grounded in the actual Basafy product.
              </p>
            </div>

            <div className="showcase-projects-grid">
              {featureCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.article
                    key={card.title}
                    className="showcase-project-card"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.55, delay: index * 0.08 }}
                  >
                    <div className={`showcase-project-media showcase-accent-${card.accent}`}>
                      <div className="showcase-project-gridlines" />
                      <div className="showcase-project-icon">
                        <Icon size={28} />
                      </div>
                      <div className="showcase-project-tags">
                        {card.tags.map((tag) => (
                          <span key={tag} className="showcase-glass-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="showcase-project-info">
                      <h3>{card.title}</h3>
                      <p>{card.description}</p>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="showcase-trust-section" id="trust">
            <div className="showcase-trust-card">
              <div className="showcase-section-header showcase-section-header-tight">
                <h2>Built for trust</h2>
                <p>
                  Gmail access is the critical UX trust moment for Basafy, so the
                  page now gives it a dedicated section instead of burying it in
                  generic marketing copy.
                </p>
              </div>

              <div className="showcase-trust-grid">
                {trustPoints.map((point, index) => (
                  <motion.div
                    key={point}
                    className="showcase-trust-point"
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                  >
                    <CheckCircle2 size={18} />
                    <span>{point}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section className="showcase-contact-section" id="contact">
            <div className="showcase-contact-shell">
              <div className="showcase-contact-content">
                <h2>
                  Ready to make your
                  <br />
                  search feel organized?
                </h2>

                <div className="showcase-contact-actions">
                  <button type="button" className="showcase-primary-btn" onClick={openAppStore}>
                    Get Basafy on iPhone
                    <ArrowRight size={18} />
                  </button>
                  <a className="showcase-contact-link" href="mailto:support@basafy.com">
                    support@basafy.com
                    <span className="showcase-contact-link-icon">
                      <ArrowRight size={16} />
                    </span>
                  </a>
                </div>

                <div className="showcase-footer-links">
                  <a href="/support">Support</a>
                  <a href="https://basafy.com/privacy">Privacy</a>
                  <a href="https://basafy.com/terms">Terms</a>
                  <button type="button" onClick={() => setShowGuide(true)}>
                    Web Demo
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <style jsx global>{`
        .showcase-page {
          position: relative;
          overflow: hidden;
          background: var(--showcase-background);
          color: var(--showcase-foreground);
          min-height: 100vh;
        }

        .showcase-page * {
          box-sizing: border-box;
        }

        .showcase-noise-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.05;
          z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .showcase-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(140px);
          pointer-events: none;
          opacity: 0.35;
          z-index: 0;
        }

        .showcase-orb-1 {
          top: -140px;
          left: -110px;
          width: 440px;
          height: 440px;
          background: var(--showcase-primary);
        }

        .showcase-orb-2 {
          top: 24%;
          right: -180px;
          width: 520px;
          height: 520px;
          background: var(--showcase-secondary);
        }

        .showcase-orb-3 {
          bottom: 6%;
          left: 18%;
          width: 380px;
          height: 380px;
          background: var(--showcase-accent);
        }

        .showcase-nav-shell,
        .showcase-hero,
        .showcase-work-section,
        .showcase-trust-section,
        .showcase-contact-section {
          position: relative;
          z-index: 2;
          width: min(1440px, calc(100% - 48px));
          margin: 0 auto;
        }

        .showcase-nav-shell {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 0;
        }

        .showcase-nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.04em;
        }

        .showcase-brand-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 16px;
          border: 1px solid var(--showcase-border);
          background: linear-gradient(145deg, rgba(139, 92, 246, 0.32), rgba(110, 231, 183, 0.16));
          box-shadow: 0 24px 40px rgba(0, 0, 0, 0.22);
        }

        .showcase-nav-pill,
        .showcase-nav-status,
        .showcase-glass {
          border: 1px solid var(--showcase-border);
          background: var(--showcase-card);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .showcase-nav-pill {
          display: flex;
          align-items: center;
          gap: 26px;
          padding: 14px 24px;
          border-radius: 999px;
        }

        .showcase-nav-link {
          color: var(--showcase-muted-foreground);
          font-size: 0.92rem;
          text-decoration: none;
          transition: color 180ms ease;
        }

        .showcase-nav-link:hover {
          color: var(--showcase-foreground);
        }

        .showcase-nav-status {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 999px;
          color: var(--showcase-foreground);
          cursor: pointer;
          font: inherit;
        }

        .showcase-status-dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: var(--showcase-success);
          box-shadow: 0 0 14px rgba(34, 197, 94, 0.65);
        }

        .showcase-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
          gap: 52px;
          align-items: center;
          padding: 52px 0 110px;
        }

        .showcase-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(139, 92, 246, 0.28);
          background: rgba(139, 92, 246, 0.12);
          color: var(--showcase-foreground);
          margin-bottom: 24px;
        }

        .showcase-title {
          font-family: var(--font-display);
          font-size: clamp(4.3rem, 9vw, 8.4rem);
          line-height: 0.9;
          letter-spacing: -0.06em;
          margin: 0 0 28px;
        }

        .showcase-title span {
          display: inline-block;
          margin-left: clamp(30px, 7vw, 84px);
          font-style: italic;
          font-weight: 400;
          color: var(--showcase-secondary);
        }

        .showcase-subtitle {
          max-width: 560px;
          font-size: clamp(1.1rem, 2vw, 1.45rem);
          line-height: 1.6;
          color: var(--showcase-muted-foreground);
          margin: 0 0 34px;
        }

        .showcase-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 26px;
        }

        .showcase-primary-btn,
        .showcase-secondary-btn,
        .showcase-contact-link,
        .showcase-footer-links button {
          font: inherit;
        }

        .showcase-primary-btn,
        .showcase-secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 58px;
          padding: 0 24px;
          border-radius: 999px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform 180ms ease, opacity 180ms ease, border-color 180ms ease;
        }

        .showcase-primary-btn {
          background: linear-gradient(135deg, var(--showcase-primary), #a78bfa);
          color: #0f0b16;
          font-weight: 700;
          box-shadow: 0 22px 40px rgba(139, 92, 246, 0.28);
        }

        .showcase-secondary-btn {
          background: transparent;
          color: var(--showcase-foreground);
          border-color: var(--showcase-border);
        }

        .showcase-primary-btn:hover,
        .showcase-secondary-btn:hover,
        .showcase-nav-status:hover,
        .showcase-contact-link:hover,
        .showcase-footer-links button:hover {
          transform: translateY(-2px);
        }

        .showcase-trust-bar {
          max-width: 620px;
          padding: 16px 18px;
          border: 1px solid var(--showcase-border);
          border-radius: 24px;
          background: rgba(24, 19, 33, 0.72);
          color: var(--showcase-muted-foreground);
          line-height: 1.6;
        }

        .showcase-inline-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
          color: var(--showcase-foreground);
        }

        .showcase-inline-links a {
          color: inherit;
          text-decoration: none;
        }

        .showcase-hero-visual {
          position: relative;
          min-height: 620px;
        }

        .showcase-liquid-frame {
          position: relative;
          width: min(100%, 500px);
          margin-left: auto;
          min-height: 620px;
          padding: 22px;
          border-radius: 42% 58% 63% 37% / 36% 43% 57% 64%;
          background: linear-gradient(145deg, rgba(139, 92, 246, 0.2), rgba(110, 231, 183, 0.08));
          border: 1px solid var(--showcase-border);
          box-shadow: 0 50px 90px rgba(0, 0, 0, 0.34);
        }

        .showcase-device {
          height: 100%;
          min-height: 576px;
          border-radius: 36px;
          background: linear-gradient(180deg, rgba(23, 18, 34, 0.96), rgba(14, 11, 20, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 26px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .showcase-device-top,
        .showcase-device-stats,
        .showcase-task-item,
        .showcase-feed-row,
        .showcase-floating-badge {
          display: flex;
          align-items: center;
        }

        .showcase-device-top {
          justify-content: space-between;
          gap: 16px;
        }

        .showcase-device-label {
          margin: 0 0 4px;
          font-size: 0.8rem;
          color: var(--showcase-muted-foreground);
        }

        .showcase-device-top h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.8rem;
          letter-spacing: -0.05em;
        }

        .showcase-device-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(139, 92, 246, 0.28), rgba(110, 231, 183, 0.18));
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .showcase-device-stats {
          gap: 14px;
        }

        .showcase-device-stats > div,
        .showcase-device-panel,
        .showcase-device-feed {
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.03);
        }

        .showcase-device-stats > div {
          flex: 1;
          border-radius: 22px;
          padding: 18px;
        }

        .showcase-device-stats span {
          display: block;
          color: var(--showcase-muted-foreground);
          font-size: 0.78rem;
          margin-bottom: 8px;
        }

        .showcase-device-stats strong {
          font-size: 2rem;
          font-weight: 700;
        }

        .showcase-device-panel {
          border-radius: 28px;
          padding: 18px;
        }

        .showcase-device-panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: var(--showcase-secondary);
          font-weight: 600;
        }

        .showcase-task-item {
          gap: 12px;
        }

        .showcase-task-item + .showcase-task-item {
          margin-top: 12px;
        }

        .showcase-task-item strong,
        .showcase-note-title {
          display: block;
          font-size: 0.96rem;
        }

        .showcase-task-item small,
        .showcase-note-subtitle,
        .showcase-floating-subtitle {
          color: var(--showcase-muted-foreground);
        }

        .showcase-task-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .showcase-task-dot-danger {
          background: var(--showcase-danger);
        }

        .showcase-task-dot-primary {
          background: var(--showcase-primary);
        }

        .showcase-device-feed {
          border-radius: 26px;
          padding: 16px;
          display: grid;
          gap: 10px;
          margin-top: auto;
        }

        .showcase-feed-row {
          gap: 10px;
          color: var(--showcase-foreground);
          font-size: 0.94rem;
        }

        .showcase-feed-row svg:first-child {
          color: var(--showcase-secondary);
        }

        .showcase-floating-badge,
        .showcase-floating-note {
          position: absolute;
          border-radius: 24px;
          padding: 16px 18px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
        }

        .showcase-floating-badge {
          left: 0;
          bottom: 72px;
          gap: 14px;
        }

        .showcase-floating-note {
          right: 16px;
          top: 44px;
          max-width: 250px;
        }

        .showcase-floating-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 16px;
          background: rgba(110, 231, 183, 0.12);
          color: var(--showcase-secondary);
        }

        .showcase-floating-title {
          font-weight: 700;
        }

        .showcase-marquee {
          position: relative;
          z-index: 2;
          border-top: 1px solid var(--showcase-border);
          border-bottom: 1px solid var(--showcase-border);
          overflow: hidden;
          background: rgba(20, 16, 24, 0.72);
          white-space: nowrap;
        }

        .showcase-marquee-track {
          display: inline-flex;
          align-items: center;
          gap: 28px;
          min-width: 100%;
          padding: 24px 0;
          animation: showcase-scroll 26s linear infinite;
        }

        .showcase-marquee-item {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 28px;
          font-family: var(--font-display);
          font-size: clamp(1.5rem, 4vw, 2.9rem);
          letter-spacing: -0.05em;
        }

        .showcase-marquee-item::after {
          content: '•';
          color: var(--showcase-primary);
          margin-left: 28px;
        }

        .showcase-work-section {
          padding: 132px 0;
        }

        .showcase-section-header {
          max-width: 720px;
          margin-bottom: 64px;
        }

        .showcase-section-header h2,
        .showcase-contact-content h2 {
          margin: 0 0 18px;
          font-family: var(--font-display);
          font-size: clamp(2.8rem, 5vw, 4.8rem);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }

        .showcase-section-header p,
        .showcase-contact-content p {
          margin: 0;
          color: var(--showcase-muted-foreground);
          font-size: 1.1rem;
          line-height: 1.7;
        }

        .showcase-section-header-tight {
          margin-bottom: 34px;
        }

        .showcase-projects-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 34px;
        }

        .showcase-project-card {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .showcase-project-card:nth-child(even) {
          margin-top: 84px;
        }

        .showcase-project-media {
          position: relative;
          min-height: 310px;
          border-radius: 30px;
          overflow: hidden;
          border: 1px solid var(--showcase-border);
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.22);
        }

        .showcase-project-gridlines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.4), transparent 85%);
        }

        .showcase-project-media::before {
          content: '';
          position: absolute;
          inset: auto auto 16% 12%;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          filter: blur(16px);
          opacity: 0.9;
        }

        .showcase-project-media::after {
          content: '';
          position: absolute;
          right: 10%;
          top: 14%;
          width: 170px;
          height: 170px;
          border-radius: 34px;
          transform: rotate(22deg);
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(18px);
        }

        .showcase-accent-violet::before {
          background: radial-gradient(circle, rgba(139, 92, 246, 0.9), rgba(139, 92, 246, 0.15));
        }

        .showcase-accent-mint::before {
          background: radial-gradient(circle, rgba(110, 231, 183, 0.92), rgba(110, 231, 183, 0.12));
        }

        .showcase-accent-gold::before {
          background: radial-gradient(circle, rgba(245, 185, 76, 0.88), rgba(245, 185, 76, 0.12));
        }

        .showcase-accent-rose::before {
          background: radial-gradient(circle, rgba(251, 113, 133, 0.88), rgba(251, 113, 133, 0.12));
        }

        .showcase-project-icon {
          position: absolute;
          left: 24px;
          top: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 62px;
          height: 62px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(18, 12, 28, 0.55);
        }

        .showcase-project-tags {
          position: absolute;
          left: 20px;
          bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .showcase-glass-tag {
          padding: 9px 14px;
          border-radius: 999px;
          background: rgba(18, 12, 28, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 0.82rem;
        }

        .showcase-project-info h3 {
          margin: 0 0 12px;
          font-family: var(--font-display);
          font-size: 2rem;
          letter-spacing: -0.04em;
        }

        .showcase-project-info p {
          margin: 0;
          max-width: 92%;
          color: var(--showcase-muted-foreground);
          line-height: 1.7;
        }

        .showcase-trust-section {
          padding-bottom: 132px;
        }

        .showcase-trust-card,
        .showcase-contact-shell {
          border: 1px solid var(--showcase-border);
          border-radius: 34px;
          background: rgba(20, 16, 24, 0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .showcase-trust-card {
          padding: 44px;
        }

        .showcase-trust-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .showcase-trust-point {
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 18px;
          padding: 16px 18px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--showcase-foreground);
        }

        .showcase-trust-point svg {
          color: var(--showcase-secondary);
          flex-shrink: 0;
        }

        .showcase-contact-section {
          padding: 0 0 84px;
        }

        .showcase-contact-shell {
          position: relative;
          overflow: hidden;
          padding: 88px 72px;
        }

        .showcase-contact-shell::before {
          content: '';
          position: absolute;
          top: -36%;
          left: 24%;
          width: 54%;
          height: 110%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.36), transparent 64%);
          filter: blur(30px);
          pointer-events: none;
        }

        .showcase-contact-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .showcase-contact-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: 12px;
          margin-bottom: 58px;
        }

        .showcase-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          color: var(--showcase-foreground);
          text-decoration: none;
          font-size: clamp(1rem, 2vw, 1.25rem);
          padding-bottom: 8px;
          border-bottom: 1px solid var(--showcase-border);
        }

        .showcase-contact-link-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: var(--showcase-foreground);
          color: var(--showcase-background);
        }

        .showcase-footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 28px;
          align-items: center;
          justify-content: center;
        }

        .showcase-footer-links a,
        .showcase-footer-links button {
          color: var(--showcase-muted-foreground);
          text-decoration: none;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
        }

        @keyframes showcase-scroll {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        @media (max-width: 1100px) {
          .showcase-nav-shell {
            flex-wrap: wrap;
            justify-content: center;
          }

          .showcase-hero {
            grid-template-columns: 1fr;
            gap: 42px;
            padding-top: 24px;
          }

          .showcase-hero-copy,
          .showcase-section-header,
          .showcase-trust-card {
            text-align: left;
          }

          .showcase-liquid-frame {
            margin: 0 auto;
          }

          .showcase-project-card:nth-child(even) {
            margin-top: 0;
          }

          .showcase-trust-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .showcase-nav-pill {
            order: 3;
            width: 100%;
            justify-content: center;
            flex-wrap: wrap;
          }

          .showcase-projects-grid {
            grid-template-columns: 1fr;
          }

          .showcase-contact-shell {
            padding: 64px 28px;
          }
        }

        @media (max-width: 640px) {
          .showcase-nav-shell,
          .showcase-hero,
          .showcase-work-section,
          .showcase-trust-section,
          .showcase-contact-section {
            width: min(100% - 28px, 1440px);
          }

          .showcase-nav-shell {
            padding-top: 20px;
          }

          .showcase-title span {
            margin-left: 16px;
          }

          .showcase-hero {
            padding-bottom: 88px;
          }

          .showcase-liquid-frame {
            min-height: auto;
            padding: 16px;
          }

          .showcase-device {
            min-height: 500px;
            padding: 18px;
          }

          .showcase-floating-badge,
          .showcase-floating-note {
            position: static;
            margin-top: 16px;
          }

          .showcase-work-section,
          .showcase-trust-section {
            padding: 96px 0;
          }

          .showcase-trust-card {
            padding: 28px 22px;
          }

          .showcase-contact-actions {
            flex-direction: column;
            width: 100%;
          }

          .showcase-primary-btn,
          .showcase-secondary-btn,
          .showcase-contact-link {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
