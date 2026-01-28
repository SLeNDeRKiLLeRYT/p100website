"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

export default function FloatingSubmitButton() {
  const [isVisible, setIsVisible] = useState(true);
  const pathname = usePathname();
  
  // Don't show on admin pages
  if (!isVisible || pathname === '/admin' || pathname.startsWith('/admin-panel-')) return null;
  
  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col items-end gap-1">
      
      {/* Floating submit button - only show when NOT on submission page */}
      {pathname !== '/submission' && (
        <Link
          href="/submission"
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-2 border-red-400 hover:border-red-300 text-white px-4 py-3 min-h-[44px] text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm rounded-lg animate-pulse hover:animate-none"
          style={{
            boxShadow: '0 0 20px rgba(220, 38, 38, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          SUBMIT P100
        </Link>
      )}
      
      {/* Looking for someone link - only show when not on search page */}
      {pathname !== '/search' && (
        <Link
          href="/search"
          className="hidden sm:inline text-sm text-red-300 hover:text-red-200 transition-colors underline mt-1 font-medium"
        >
          Looking for someone?
        </Link>
      )}
    </div>
  );
}
