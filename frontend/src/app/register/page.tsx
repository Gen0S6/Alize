"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, getOAuthProviders, getGoogleOAuthUrl, type OAuthProviders } from "../../lib/api";
import { setToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faLock, faArrowRight, faCheck } from "@fortawesome/free-solid-svg-icons";

export default function RegisterPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviders | null>(null);

  useEffect(() => {
    getOAuthProviders()
      .then(setOauthProviders)
      .catch(() => setOauthProviders({ google: false }));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register(email, password);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  const passwordValid = password.length >= 8;

  return (
    <main className={`min-h-screen flex items-center justify-center p-6 relative overflow-hidden ${
      isDark ? "bg-[#0a0b0f]" : "bg-gray-50"
    }`}>
      {/* Background gradient */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-30 ${
        isDark ? "bg-sky-500/20" : "bg-sky-400/30"
      }`} />

      <div className={`relative w-full max-w-md rounded-2xl border p-8 shadow-2xl ${
        isDark
          ? "border-gray-800 bg-[#0d1117]"
          : "border-gray-200 bg-white"
      }`}>
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
            isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600"
          }`}>
            <span className="text-xl font-bold">A</span>
          </Link>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Créer un compte
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Inscris-toi pour recevoir des offres personnalisées.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}>
              Email
            </label>
            <div className="relative">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <FontAwesomeIcon icon={faEnvelope} className="text-sm" />
              </div>
              <input
                className={`w-full rounded-xl border pl-11 pr-4 py-3.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                  isDark
                    ? "border-gray-700 bg-gray-800/50 text-gray-100 placeholder-gray-500 focus:border-sky-500 focus:ring-sky-500/20"
                    : "border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500/20"
                }`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}>
              Mot de passe
            </label>
            <div className="relative">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <FontAwesomeIcon icon={faLock} className="text-sm" />
              </div>
              <input
                className={`w-full rounded-xl border pl-11 pr-4 py-3.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                  isDark
                    ? "border-gray-700 bg-gray-800/50 text-gray-100 placeholder-gray-500 focus:border-sky-500 focus:ring-sky-500/20"
                    : "border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500/20"
                }`}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
                minLength={8}
              />
            </div>
            {/* Password strength indicator */}
            <div className={`flex items-center gap-2 mt-2 text-xs ${
              password.length === 0
                ? isDark ? "text-gray-500" : "text-gray-400"
                : passwordValid
                  ? isDark ? "text-emerald-400" : "text-emerald-600"
                  : isDark ? "text-amber-400" : "text-amber-600"
            }`}>
              <FontAwesomeIcon icon={faCheck} className={password.length > 0 && passwordValid ? "opacity-100" : "opacity-30"} />
              8 caractères minimum
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={`rounded-xl p-4 text-sm ${
              isDark
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "bg-red-50 text-red-600 border border-red-100"
            }`}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="w-full rounded-xl bg-sky-500 px-4 py-3.5 font-medium text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600 hover:shadow-sky-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Création...
              </>
            ) : (
              <>
                S'inscrire
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </>
            )}
          </button>

          {/* Login link */}
          <div className="text-center">
            <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Déjà un compte ?{" "}
            </span>
            <Link href="/login" className="text-sm font-medium text-sky-500 hover:text-sky-400 transition-colors">
              Se connecter
            </Link>
          </div>
        </form>

        {/* Social Login */}
        {oauthProviders?.google && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDark ? "border-gray-800" : "border-gray-200"}`} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 ${isDark ? "bg-[#0d1117] text-gray-500" : "bg-white text-gray-500"}`}>
                  ou s'inscrire avec
                </span>
              </div>
            </div>

            <a
              href={getGoogleOAuthUrl()}
              className={`w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3.5 font-medium transition-all ${
                isDark
                  ? "bg-white text-gray-900 hover:bg-gray-100"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              S'inscrire avec Google
            </a>
          </>
        )}
      </div>
    </main>
  );
}
