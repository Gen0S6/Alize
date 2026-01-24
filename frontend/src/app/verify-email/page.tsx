"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { confirmEmailVerification } from "../../lib/api";
import { useTheme } from "../ThemeProvider";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setError("Lien de vérification invalide. Aucun token fourni.");
      return;
    }

    async function verify() {
      try {
        await confirmEmailVerification(token!);
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 3000);
      } catch (err: any) {
        setError(err?.message ?? "Impossible de vérifier l'email");
      } finally {
        setVerifying(false);
      }
    }

    verify();
  }, [token, router]);

  const containerClass = isDark
    ? "min-h-screen flex items-center justify-center p-6 bg-[#0b0c10]"
    : "min-h-screen flex items-center justify-center p-6 bg-gray-50";

  const cardClass = isDark
    ? "w-full max-w-md rounded-2xl border border-gray-700 bg-[#0f1116] p-8 shadow-xl text-center"
    : "w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl text-center";

  const textClass = isDark ? "text-gray-100" : "text-gray-900";
  const mutedClass = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <main className={containerClass}>
      <div className={cardClass}>
        {verifying ? (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
            <h1 className={`mt-4 text-xl font-bold ${textClass}`}>
              Vérification en cours...
            </h1>
            <p className={`mt-2 text-sm ${mutedClass}`}>
              Veuillez patienter pendant que nous vérifions votre adresse email.
            </p>
          </>
        ) : success ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg
                className="h-8 w-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className={`mt-4 text-xl font-bold ${textClass}`}>
              Email vérifié !
            </h1>
            <p className={`mt-2 text-sm ${mutedClass}`}>
              Votre adresse email a été vérifiée avec succès.
              Redirection vers le tableau de bord...
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className={`mt-4 text-xl font-bold ${textClass}`}>
              Erreur de vérification
            </h1>
            <p className={`mt-2 text-sm text-red-400`}>
              {error}
            </p>
            <p className={`mt-4 text-sm ${mutedClass}`}>
              Le lien a peut-être expiré ou a déjà été utilisé.
            </p>
          </>
        )}

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="text-sky-500 hover:underline text-sm"
          >
            Aller au tableau de bord →
          </Link>
        </div>
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
