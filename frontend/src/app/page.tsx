"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { getToken } from "../lib/auth";

export default function HomePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isAuthed, setIsAuthed] = useState(false);

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

  const containerClass = isDark
    ? "min-h-screen bg-[#0b0c10] text-gray-100 theme-hover"
    : "min-h-screen bg-gray-50 text-gray-900 theme-hover";

  const cardClass = isDark
    ? "mt-8 rounded-2xl border border-gray-700 bg-[#0f1116] p-6"
    : "mt-8 rounded-2xl border border-gray-200 bg-white p-6";

  const buttonPrimary = isDark
    ? "rounded-xl border border-gray-600 bg-white text-gray-900 px-4 py-2 font-semibold hover:bg-black hover:text-white"
    : "rounded-xl border border-gray-900 bg-black text-white px-4 py-2 font-semibold hover:bg-white hover:text-black";

  const buttonGhost = isDark
    ? "rounded-xl border border-gray-700 px-4 py-2 font-semibold hover:bg-gray-800"
    : "rounded-xl border px-4 py-2 font-semibold hover:bg-gray-100";

  const statClass = isDark
    ? "rounded-xl border border-gray-700 bg-[#0d1016] px-4 py-3 text-sm text-gray-200"
    : "rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800";
  const warningWrapperClass = "mt-7 flex justify-center";
  const warningInnerClass = isDark
    ? "inline-flex items-center gap-4 rounded-2xl border border-yellow-700 bg-yellow-900/40 px-8 py-5 text-lg text-yellow-100"
    : "inline-flex items-center gap-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-8 py-5 text-lg text-yellow-700";

  return (
    <main className={containerClass}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <p className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Alizè</p>
          <h1 className="mt-2 text-3xl font-bold">
            Trouve les bonnes offres en quelques clics.
          </h1>
          <p className={isDark ? "mt-3 text-lg text-gray-300" : "mt-3 text-lg text-gray-700"}>
            CV, préférences et IA : on suggère, tu appliques. Reste légal avec France Travail et Adzuna, et reçois les nouveautés sans doublons.
          </p>
          <div className={warningWrapperClass}>
            <div className={warningInnerClass}>
              <span role="img" aria-label="construction">🚧</span>
              <span>Le site est encore en cours de construction. Des ajustements peuvent survenir.</span>
              <span role="img" aria-label="construction">🚧</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {!isAuthed && (
              <>
                <Link href="/register" className={buttonPrimary}>
                  Créer un compte
                </Link>
                <Link href="/login" className={buttonGhost}>
                  Se connecter
                </Link>
              </>
            )}
            {isAuthed && (
              <Link href="/dashboard" className={buttonGhost}>
                Voir le dashboard
              </Link>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold">Ce que tu obtiens</h2>
          <ul className={isDark ? "mt-3 space-y-2 text-gray-200" : "mt-3 space-y-2 text-gray-800"}>
            <li>• Analyse automatique du CV et préférences pour générer des requêtes ciblées.</li>
            <li>• Offres consolidées (FranceTravail, Adzuna, LinkedIn) sans doublons.</li>
            <li>• Historique des recherches, pagination côté serveur, filtres persistants.</li>
            <li>• Notifications email activables par défaut et digest clair.</li>
          </ul>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className={statClass}>Historique : 5 derniers runs conservés.</div>
            <div className={statClass}>Mode sombre activable depuis le profil.</div>
            <div className={statClass}>Filtres & pagination côté serveur.</div>
          </div>
        </div>
      </div>
    </main>
  );
}
