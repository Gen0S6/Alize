"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faA } from "@fortawesome/free-solid-svg-icons";
import ThemeProvider, { useTheme } from "./ThemeProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { ToastProvider } from "../components/Toast";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getToken } from "../lib/auth";

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register") || pathname?.startsWith("/reset-password") || pathname?.startsWith("/verify-email");
  const isHomePage = pathname === "/";

  useEffect(() => {
    const update = () => setIsAuthed(!!getToken());
    update();
    window.addEventListener("storage", update);
    window.addEventListener("token_changed", update as EventListener);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("token_changed", update as EventListener);
    };
  }, []);

  // Permettre d'annuler la saisie par Échap : blur sur le champ actif
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
          active.blur();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const headerClass = isDark
    ? "border-b border-gray-800 bg-[#0f1116]"
    : "border-b border-gray-200 bg-white";
  const linkClass = isDark ? "text-gray-100 hover:text-white" : "text-gray-800 hover:text-black";
  const navClass = isDark ? "flex items-center gap-4 text-sm text-gray-200" : "flex items-center gap-4 text-sm text-gray-700";
  const containerClass = isDark
    ? "min-h-screen bg-[#0b0c10] text-gray-100 flex flex-col"
    : "min-h-screen bg-white text-gray-900 flex flex-col";
  const badgeClass = isDark
    ? "fixed bottom-6 right-10 flex items-center justify-center px-3.5 py-2 rounded-md border border-gray-700/50 bg-gray-900/70 backdrop-blur-sm shadow-sm"
    : "fixed bottom-6 right-10 flex items-center justify-center px-3.5 py-2 rounded-md border border-gray-200/70 bg-white/80 backdrop-blur-sm shadow-sm";
  const badgeText = isDark
    ? "text-center text-[11px] leading-snug text-gray-300"
    : "text-center text-[11px] leading-snug text-gray-600";
  const badgeStrong = isDark
    ? "text-sm font-semibold text-gray-100"
    : "text-sm font-semibold text-gray-800";

  return (
    <div className={containerClass}>
      {!isAuthPage && (
        <header className={headerClass}>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className={`flex items-center gap-2 text-lg font-semibold ${linkClass}`}>
              <span>Alizè</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className={`hidden md:flex ${navClass}`}>
              {(!isHomePage || isAuthed) && (
                <>
                  <Link href="/dashboard" className={linkClass}>
                    Tableau de bord
                  </Link>
                  <Link href="/preferences" className={linkClass}>
                    Préférences
                  </Link>
                  <Link href="/cv" className={linkClass}>
                    CV
                  </Link>
                </>
              )}
              <Link href="/profile" className={linkClass}>
                Profil
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className={`md:hidden p-2 rounded-lg ${linkClass}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className={`md:hidden border-t ${isDark ? "border-gray-800 bg-[#0f1116]" : "border-gray-200 bg-white"}`}>
              <nav className="flex flex-col px-6 py-4 space-y-3">
                {(!isHomePage || isAuthed) && (
                  <>
                    <Link href="/dashboard" className={`${linkClass} py-2`}>
                      Tableau de bord
                    </Link>
                    <Link href="/preferences" className={`${linkClass} py-2`}>
                      Préférences
                    </Link>
                    <Link href="/cv" className={`${linkClass} py-2`}>
                      CV
                    </Link>
                  </>
                )}
                <Link href="/profile" className={`${linkClass} py-2`}>
                  Profil
                </Link>
              </nav>
            </div>
          )}
        </header>
      )}
      <main className="flex-1">{children}</main>
      <div className={badgeClass}>
        <span className={badgeText}>
          Built by<br />
          <span className={badgeStrong}>Gen0S7</span>'s<br />
          members
        </span>
      </div>
    </div>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <ToastProvider>
          <ShellFrame>{children}</ShellFrame>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
