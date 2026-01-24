"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, requestPasswordReset } from "../../lib/api";
import { useTheme } from "../ThemeProvider";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Request form state
  const [email, setEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Reset form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Handle password reset request
  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setRequestLoading(true);

    try {
      await requestPasswordReset(email);
      setRequestSent(true);
    } catch (err: any) {
      setRequestError(err?.message ?? "Une erreur est survenue");
    } finally {
      setRequestLoading(false);
    }
  }

  // Handle password reset confirmation
  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 8) {
      setResetError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Les mots de passe ne correspondent pas");
      return;
    }

    setResetLoading(true);

    try {
      await confirmPasswordReset(token!, newPassword);
      setResetSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setResetError(err?.message ?? "Une erreur est survenue");
    } finally {
      setResetLoading(false);
    }
  }

  const containerClass = isDark
    ? "min-h-screen flex items-center justify-center p-6 bg-[#0b0c10]"
    : "min-h-screen flex items-center justify-center p-6 bg-gray-50";

  const cardClass = isDark
    ? "w-full max-w-md rounded-2xl border border-gray-700 bg-[#0f1116] p-8 shadow-xl"
    : "w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl";

  const inputClass = isDark
    ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
    : "mt-1 w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-sky-500 focus:outline-none";

  const buttonClass = isDark
    ? "w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
    : "w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed";

  const textClass = isDark ? "text-gray-100" : "text-gray-900";
  const mutedClass = isDark ? "text-gray-400" : "text-gray-600";

  // If token is present, show reset form
  if (token) {
    return (
      <main className={containerClass}>
        <div className={cardClass}>
          <h1 className={`text-2xl font-bold ${textClass}`}>
            Nouveau mot de passe
          </h1>
          <p className={`mt-2 text-sm ${mutedClass}`}>
            Entrez votre nouveau mot de passe ci-dessous.
          </p>

          {resetSuccess ? (
            <div className="mt-6 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
              <p className="text-green-400 text-sm">
                Mot de passe réinitialisé avec succès ! Redirection vers la connexion...
              </p>
            </div>
          ) : (
            <form onSubmit={handleConfirmReset} className="mt-6 space-y-4">
              {resetError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                  <p className="text-red-400 text-sm">{resetError}</p>
                </div>
              )}

              <div>
                <label className={`text-sm font-medium ${textClass}`}>
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className={`text-sm font-medium ${textClass}`}>
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                className={buttonClass}
                disabled={resetLoading}
              >
                {resetLoading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
              </button>
            </form>
          )}

          <p className={`mt-6 text-center text-sm ${mutedClass}`}>
            <Link href="/login" className="text-sky-500 hover:underline">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // No token - show request form
  return (
    <main className={containerClass}>
      <div className={cardClass}>
        <h1 className={`text-2xl font-bold ${textClass}`}>
          Mot de passe oublié ?
        </h1>
        <p className={`mt-2 text-sm ${mutedClass}`}>
          Entrez votre email pour recevoir un lien de réinitialisation.
        </p>

        {requestSent ? (
          <div className="mt-6 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
            <p className="text-green-400 text-sm">
              Si cette adresse existe dans notre système, vous recevrez un email avec les instructions de réinitialisation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
            {requestError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-red-400 text-sm">{requestError}</p>
              </div>
            )}

            <div>
              <label className={`text-sm font-medium ${textClass}`}>
                Adresse email
              </label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </div>

            <button
              type="submit"
              className={buttonClass}
              disabled={requestLoading}
            >
              {requestLoading ? "Envoi..." : "Envoyer le lien de réinitialisation"}
            </button>
          </form>
        )}

        <p className={`mt-6 text-center text-sm ${mutedClass}`}>
          <Link href="/login" className="text-sky-500 hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Chargement...</p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
