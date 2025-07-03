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
    <nav className="flex gap-4 mb-8">
      {!hideHome && (
        <Link href="/" className={`nav-button ${pathname === "/" ? "active" : ""}`}>
          HOME
        </Link>
      )}
      
      {!hideKillers && (
        <Link href="/killers" className={`nav-button ${pathname === "/killers" ? "active" : ""}`}>
          KILLERS
        </Link>
      )}
      
      {!hideSurvivors && (
        <Link href="/survivors" className={`nav-button ${pathname === "/survivors" ? "active" : ""}`}>
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