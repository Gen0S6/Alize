"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, getOAuthProviders, getGoogleOAuthUrl, type OAuthProviders } from "../../lib/api";
import { setToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviders | null>(null);

  useEffect(() => {
    // Check for OAuth error in URL
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "Connexion annulée",
        invalid_state: "Session expirée, veuillez réessayer",
        oauth_failed: "La connexion a échoué, veuillez réessayer",
      };
      setError(errorMessages[errorParam] || "Une erreur est survenue");
    }

    // Load available OAuth providers
    getOAuthProviders()
      .then(setOauthProviders)
      .catch(() => setOauthProviders({ google: false }));
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  const containerClass = isDark
    ? "min-h-screen flex items-center justify-center p-6 bg-[#0b0c10]"
    : "min-h-screen flex items-center justify-center p-6 bg-gray-50";

  const cardClass = isDark
    ? "w-full max-w-md rounded-2xl border border-gray-700 bg-[#0f1116] p-8 shadow-xl"
    : "w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl";

  const inputClass = isDark
    ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
    : "mt-1 w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none";

  const buttonClass = isDark
    ? "w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    : "w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";

  const secondaryButtonClass = isDark
    ? "w-full rounded-xl border border-gray-700 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800"
    : "w-full rounded-xl border px-4 py-3 text-sm text-gray-700 hover:bg-gray-50";

  const textClass = isDark ? "text-gray-100" : "text-gray-900";
  const mutedClass = isDark ? "text-gray-400" : "text-gray-600";

  const errorClass = isDark
    ? "rounded-xl border border-red-700 bg-red-900/30 p-3 text-sm text-red-200"
    : "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700";

  return (
    <main className={containerClass}>
      <div className={cardClass}>
        <h1 className={`text-2xl font-bold ${textClass}`}>Connexion</h1>
        <p className={`text-sm ${mutedClass} mt-1`}>
          Accède à ton tableau de bord et tes opportunités.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className={`text-sm font-medium ${textClass}`}>Email</label>
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={`text-sm font-medium ${textClass}`}>Mot de passe</label>
              <Link
                href="/reset-password"
                className="text-sm text-blue-500 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              required
            />
          </div>

          {error && (
            <div className={errorClass}>
              {error}
            </div>
          )}

          <button
            className={buttonClass}
            disabled={loading}
            type="submit"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/register")}
            className={secondaryButtonClass}
          >
            Pas encore de compte ? S'inscrire
          </button>
        </form>

        {/* Social Login Buttons */}
        {oauthProviders?.google && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDark ? "border-gray-700" : "border-gray-300"}`} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-2 ${isDark ? "bg-[#0f1116] text-gray-400" : "bg-white text-gray-500"}`}>
                  ou continuer avec
                </span>
              </div>
            </div>

            <a
              href={getGoogleOAuthUrl()}
              className={`w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 font-medium ${
                isDark
                  ? "bg-white text-gray-900 hover:bg-gray-100"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuer avec Google
            </a>
          </>
        )}
      </div>
    </main>
  );
}
