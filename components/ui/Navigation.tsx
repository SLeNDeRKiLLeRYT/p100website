// components/ui/Navigation.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationProps {
  hideHome?: boolean;
  hideKillers?: boolean;
  hideSurvivors?: boolean;
  hideCredits?: boolean;
  hideSearch?: boolean;
}

export default function Navigation({ hideHome, hideKillers, hideSurvivors, hideCredits, hideSearch }: NavigationProps) {
  const pathname = usePathname();
  
  return (
    // FIX: Removed mb-8 (margin-bottom) as spacing is now handled by the page layout.
    <nav className="flex gap-4">
      {!hideHome && (
        <Link href="/" className={`nav-button ${pathname === "/" ? "active" : ""}`}>
          HOME
        </Link>
      )}
      
      {!hideKillers && (
        <Link href="/killers" className={`nav-button ${pathname.startsWith("/killers") ? "active" : ""}`}>
          KILLERS
        </Link>
      )}
      
      {!hideSurvivors && (
        <Link href="/survivors" className={`nav-button ${pathname.startsWith("/survivors") ? "active" : ""}`}>
          SURVIVORS
        </Link>
      )}
      
      {!hideCredits && (
        <Link href="/credits" className={`nav-button ${pathname === "/credits" ? "active" : ""}`}>
          CREDITS
        </Link>
      )}
    </nav>
  );
}