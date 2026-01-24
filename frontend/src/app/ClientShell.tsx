"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import ThemeProvider, { useTheme } from "./ThemeProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { ToastProvider } from "../components/Toast";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, clearTokenAndRedirectHome } from "../lib/auth";
import { getProfile, type Profile } from "../lib/api";

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register") || pathname?.startsWith("/reset-password") || pathname?.startsWith("/verify-email");
  const isHomePage = pathname === "/";

  // Listen for client-side navigation events (avoids full page reloads)
  useEffect(() => {
    const handleNavigate = (e: CustomEvent<{ path: string }>) => {
      router.push(e.detail.path);
    };
    window.addEventListener("app_navigate", handleNavigate as EventListener);
    return () => {
      window.removeEventListener("app_navigate", handleNavigate as EventListener);
    };
  }, [router]);

  useEffect(() => {
    const update = () => {
      const authed = !!getToken();
      setIsAuthed(authed);
      if (!authed) {
        setUserProfile(null);
      }
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("token_changed", update as EventListener);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("token_changed", update as EventListener);
    };
  }, []);

  // Fetch user profile when authenticated
  useEffect(() => {
    if (isAuthed) {
      getProfile()
        .then(setUserProfile)
        .catch(() => setUserProfile(null));
    }
  }, [isAuthed]);

  // Listen for profile updates from the profile page
  useEffect(() => {
    const handleProfileUpdate = (e: CustomEvent<Profile>) => {
      if (e.detail) {
        setUserProfile(e.detail);
      }
    };
    window.addEventListener("profile_updated", handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener("profile_updated", handleProfileUpdate as EventListener);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Permettre d'annuler la saisie par Échap : blur sur le champ actif
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
          active.blur();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close mobile menu and dropdown on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    setUserDropdownOpen(false);
    clearTokenAndRedirectHome();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const headerClass = isDark
    ? "sticky top-0 z-50 border-b border-white/5 bg-[#0a0c14]/80 backdrop-blur-xl shadow-lg shadow-black/20"
    : "sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm";
  const linkClass = isDark ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900";
  const navClass = isDark ? "flex items-center gap-5 text-sm text-slate-200" : "flex items-center gap-5 text-sm text-slate-600";
  const containerClass = isDark
    ? "min-h-screen bg-[#06070f] text-slate-100 flex flex-col relative overflow-hidden"
    : "min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col relative overflow-hidden";
  const badgeClass = isDark
    ? "fixed bottom-6 right-6 group cursor-pointer"
    : "fixed bottom-6 right-6 group cursor-pointer";

  return (
    <div className={containerClass}>
      <div aria-hidden className="pointer-events-none absolute inset-0 app-grid opacity-50" />
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl ${
          isDark ? "bg-sky-500/10" : "bg-sky-400/20"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute top-[45%] right-[-6rem] h-[22rem] w-[22rem] rounded-full blur-[140px] ${
          isDark ? "bg-purple-500/10" : "bg-purple-400/20"
        }`}
      />
      {!isAuthPage && (
        <header className={headerClass}>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className={`flex items-center gap-3 text-lg font-semibold ${linkClass}`}>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                isDark ? "bg-sky-500/15 text-sky-300" : "bg-sky-100 text-sky-700"
              }`}>
                A
              </span>
              <span>Alizè</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className={`hidden md:flex ${navClass}`}>
              {(!isHomePage || isAuthed) && (
                <>
                  <Link href="/dashboard" className={`${linkClass} transition-colors duration-200`}>
                    Tableau de bord
                  </Link>
                  <Link href="/preferences" className={`${linkClass} transition-colors duration-200`}>
                    Préférences
                  </Link>
                  <Link href="/cv" className={`${linkClass} transition-colors duration-200`}>
                    CV
                  </Link>
                </>
              )}

              {/* User Avatar Dropdown */}
              {isAuthed ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className={`flex items-center gap-2 ml-2 p-1.5 rounded-full transition-all duration-200 ${
                      isDark
                        ? "hover:bg-white/10"
                        : "hover:bg-slate-100"
                    }`}
                    aria-label="Menu utilisateur"
                    aria-expanded={userDropdownOpen}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-transform duration-200 ${
                      userDropdownOpen ? "scale-95" : ""
                    } ${
                      isDark
                        ? "bg-sky-500/80 text-white"
                        : "bg-sky-600 text-white"
                    }`}>
                      {getUserInitials()}
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className={`absolute right-0 mt-3 w-56 rounded-2xl border py-1 animate-dropdown-in ${
                      isDark
                        ? "bg-[#141621] border-white/10 shadow-xl shadow-black/30"
                        : "bg-white border-slate-200 shadow-lg"
                    }`}>
                      {/* User Info */}
                      <div className={`px-4 py-3 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                        <p className={`text-sm font-medium truncate ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                          {userProfile?.email || "Utilisateur"}
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          Connecté
                        </p>
                      </div>

                      {/* Menu Items */}
                      <Link
                        href="/profile"
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
                          isDark
                            ? "text-gray-200 hover:bg-gray-800"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <FontAwesomeIcon icon={faUser} className="w-4 h-4 opacity-70" />
                        Profil
                      </Link>

                      <div className={`border-t my-1 ${isDark ? "border-gray-700" : "border-gray-100"}`} />

                      <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors duration-150 ${
                          isDark
                            ? "text-red-400 hover:bg-gray-800"
                            : "text-red-600 hover:bg-red-50"
                        }`}
                      >
                        <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4 opacity-70" />
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/login" className={`${linkClass} transition-colors duration-200`}>
                  Connexion
                </Link>
              )}
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
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
              mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className={`border-t ${isDark ? "border-gray-800 bg-[#0f1116]" : "border-gray-200 bg-white"}`}>
              <nav className="flex flex-col px-6 py-4 space-y-1">
                {/* User info on mobile */}
                {isAuthed && userProfile && (
                  <div className={`flex items-center gap-3 py-3 mb-2 border-b ${isDark ? "border-gray-800" : "border-gray-100"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      isDark ? "bg-sky-600 text-white" : "bg-sky-500 text-white"
                    }`}>
                      {getUserInitials()}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                        {userProfile.email}
                      </p>
                      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Connecté
                      </p>
                    </div>
                  </div>
                )}

                {(!isHomePage || isAuthed) && (
                  <>
                    <Link
                      href="/dashboard"
                      className={`${linkClass} py-3 px-2 rounded-lg transition-colors duration-200 ${
                        isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                      }`}
                      style={{ animationDelay: "50ms" }}
                    >
                      Tableau de bord
                    </Link>
                    <Link
                      href="/preferences"
                      className={`${linkClass} py-3 px-2 rounded-lg transition-colors duration-200 ${
                        isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                      }`}
                      style={{ animationDelay: "100ms" }}
                    >
                      Préférences
                    </Link>
                    <Link
                      href="/cv"
                      className={`${linkClass} py-3 px-2 rounded-lg transition-colors duration-200 ${
                        isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                      }`}
                      style={{ animationDelay: "150ms" }}
                    >
                      CV
                    </Link>
                  </>
                )}
                <Link
                  href="/profile"
                  className={`${linkClass} py-3 px-2 rounded-lg transition-colors duration-200 ${
                    isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                  }`}
                  style={{ animationDelay: "200ms" }}
                >
                  Profil
                </Link>

                {/* Logout button for mobile */}
                {isAuthed && (
                  <>
                    <div className={`border-t my-2 ${isDark ? "border-gray-800" : "border-gray-100"}`} />
                    <button
                      onClick={handleLogout}
                      className={`flex items-center gap-3 py-3 px-2 rounded-lg text-left transition-colors duration-200 ${
                        isDark
                          ? "text-red-400 hover:bg-gray-800"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                      style={{ animationDelay: "250ms" }}
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </>
                )}

                {/* Login link for non-authenticated users on mobile */}
                {!isAuthed && (
                  <Link
                    href="/login"
                    className={`${linkClass} py-3 px-2 rounded-lg transition-colors duration-200 ${
                      isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                    }`}
                  >
                    Connexion
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
      <Link href="/about" className={badgeClass}>
        <div className={`
          flex items-center gap-3 px-4 py-3 rounded-lg
          transition-all duration-200
          ${isDark
            ? "bg-transparent hover:bg-white/5"
            : "bg-transparent hover:bg-black/5"
          }
        `}>
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black
            bg-gradient-to-br from-sky-500 to-sky-600 text-white
          `}>
            G7
          </div>
          <div className="flex flex-col items-center">
            <span className={`text-[9px] font-medium uppercase tracking-widest leading-tight ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Built by a
            </span>
            <span className={`text-base font-black tracking-tight leading-none ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              Gen0S7
            </span>
            <span className={`text-[9px] font-medium uppercase tracking-widest leading-tight ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Member
            </span>
          </div>
        </div>
      </Link>
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
