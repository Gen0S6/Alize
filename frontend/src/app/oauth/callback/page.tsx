"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "../../../lib/auth";
import { useTheme } from "../../ThemeProvider";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "Connexion annulée",
        invalid_state: "Session expirée, veuillez réessayer",
        no_code: "Erreur d'authentification",
        oauth_failed: "La connexion a échoué, veuillez réessayer",
      };
      setError(errorMessages[errorParam] || "Une erreur est survenue");
      setTimeout(() => router.push("/login"), 3000);
      return;
    }

    if (token) {
      setToken(token);
      router.push("/dashboard");
    } else {
      setError("Token manquant");
      setTimeout(() => router.push("/login"), 3000);
    }
  }, [searchParams, router]);

  const containerClass = isDark
    ? "min-h-screen flex items-center justify-center p-6 bg-[#0b0c10]"
    : "min-h-screen flex items-center justify-center p-6 bg-gray-50";

  const cardClass = isDark
    ? "w-full max-w-md rounded-2xl border border-gray-700 bg-[#0f1116] p-8 shadow-xl text-center"
    : "w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl text-center";

  const textClass = isDark ? "text-gray-100" : "text-gray-900";
  const mutedClass = isDark ? "text-gray-400" : "text-gray-600";

  if (error) {
    return (
      <main className={containerClass}>
        <div className={cardClass}>
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h1 className={`text-xl font-bold ${textClass}`}>Erreur de connexion</h1>
          <p className={`text-sm ${mutedClass} mt-2`}>{error}</p>
          <p className={`text-xs ${mutedClass} mt-4`}>Redirection vers la page de connexion...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={containerClass}>
      <div className={cardClass}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <h1 className={`text-xl font-bold ${textClass} mt-4`}>Connexion en cours...</h1>
        <p className={`text-sm ${mutedClass} mt-2`}>Veuillez patienter</p>
      </div>
    </main>
  );
}
