// app/not-found.tsx

import Link from 'next/link';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import Navigation from '@/components/ui/Navigation';

// This is crucial for Cloudflare Pages
export const runtime = 'edge';

export default function NotFound() {
  return (
    <BackgroundWrapper>
      <main className="container mx-auto px-4 py-8">
        <Navigation />
        <div className="text-center py-20">
          <h1 className="text-6xl font-mono text-red-500 mb-4">404</h1>
          <h2 className="text-3xl font-mono mb-8">Page Not Found</h2>
          <p className="text-gray-300 mb-8">
            Sorry, the page you are looking for does not exist.
          </p>
          <Link
            href="/"
            className="px-6 py-3 font-mono text-lg rounded bg-black border border-red-600 text-white hover:bg-red-900 hover:border-red-400 transition-all"
          >
            Return to Home
          </Link>
        </div>
      </main>
    </BackgroundWrapper>
  );
}