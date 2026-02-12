import type { Metadata } from 'next';
import { Fraunces, Sora } from 'next/font/google';
import './globals.css';

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap'
});

const bodyFont = Sora({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Basafy',
  description: 'Basafy Wrapped - job search clarity from your Gmail.',
  icons: {
    icon: '/basafy-icon.png',
    apple: '/basafy-icon.png'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen bg-background text-foreground`}>
        <div className="w-full border-b border-border/60 bg-background/95">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-2 text-xs sm:text-sm">
            <a
              href="https://basafy.com/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="https://basafy.com/terms"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
        {children}
        <footer style={{ padding: 16 }}>
          <a href="https://basafy.com/privacy">Privacy Policy</a>
          {' | '}
          <a href="https://basafy.com/terms">Terms of Service</a>
        </footer>
      </body>
    </html>
  );
}
