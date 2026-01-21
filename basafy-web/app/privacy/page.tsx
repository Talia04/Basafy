import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Home
        </Link>
        <div>
          <h1 className="text-4xl font-semibold md:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Placeholder for the full Basafy Web Lite privacy policy.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card/60 p-8 text-muted-foreground">
          We will port the full copy from the Web Lite reference next.
        </div>
      </div>
    </main>
  );
}
