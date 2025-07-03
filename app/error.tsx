'use client'; // Error components must be Client components

import { useEffect } from 'react';
import BackgroundWrapper from "@/components/BackgroundWrapper";
import Navigation from "@/components/ui/Navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <BackgroundWrapper>
      <main className="container mx-auto px-4 py-8">
        <Navigation />
        
        <h1 className="text-xl font-mono mb-6 underline">Something went wrong!</h1>
        
        <div className="mb-8 space-y-2 max-w-3xl font-mono text-sm">
          <p>An error occurred while loading the page.</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 font-mono text-sm rounded bg-black border border-red-600 text-white hover:bg-red-900 hover:border-red-400 transition-all mt-4"
          >
            Try again
          </button>
        </div>
      </main>
    </BackgroundWrapper>
  );
}
