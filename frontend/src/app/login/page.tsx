"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "../../lib/api";
import { setToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      </div>
    </main>
  );
}
