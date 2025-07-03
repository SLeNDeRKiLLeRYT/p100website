import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import Footer from "@/components/ui/Footer";
import FloatingSubmitButton from "@/components/FloatingSubmitButton";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider";
import GlobalRealtimeRefresher from "@/components/GlobalRealTimeRefresher";

const inter = Inter({ subsets: ["latin"] });
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge'; 
export const metadata: Metadata = {
  title: "The Ultimate P100 List Library",
  description: "A comprehensive collection of P100 killers and survivors in Dead by Daylight",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="//ddejzyoxrbccpickqakz.supabase.co" />
        <link rel="dns-prefetch" href="//images.unsplash.com" />
        <link rel="dns-prefetch" href="//images.pexels.com" />
        
        {/* Preconnect to critical resources */}
        <link rel="preconnect" href="https://ddejzyoxrbccpickqakz.supabase.co" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        {/* Preload critical static assets */}
        <link rel="preload" href="/homepage.png" as="image" />
        <link rel="preload" href="/favicon.ico" as="image" />
      </head>
       <body className={`${inter.className} bg-black text-white min-h-screen flex flex-col`}>
        <ServiceWorkerProvider>
          <RealtimeProvider>
            <GlobalRealtimeRefresher />
            <FloatingSubmitButton />
            <div className="flex-1">
              {children}
            </div>
            <Footer />
            <Toaster />
          </RealtimeProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}