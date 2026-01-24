"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { getToken } from "../lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileAlt,
  faBriefcase,
  faChartSimple,
  faArrowRight,
  faCheck,
  faRocket,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";

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

  return (
    <main className={isDark ? "min-h-screen bg-[#0a0b0f] text-gray-100" : "min-h-screen bg-white text-gray-900"}>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        {/* Background gradient */}
        <div className={`absolute inset-0 ${isDark ? "bg-gradient-to-b from-sky-500/5 via-transparent to-transparent" : "bg-gradient-to-b from-sky-50 via-transparent to-transparent"}`} />
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-3xl opacity-30 ${isDark ? "bg-sky-500/20" : "bg-sky-400/30"}`} />

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 mb-8 text-sm font-medium ${
            isDark ? "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20" : "bg-sky-50 text-sky-600 ring-1 ring-sky-100"
          }`}>
            <FontAwesomeIcon icon={faRocket} className="text-xs" />
            Plateforme en développement actif
          </div>

          <h1 className={`text-4xl md:text-6xl font-bold tracking-tight leading-tight ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Trouve ton prochain emploi,
            <br />
            <span className="bg-gradient-to-r from-sky-500 to-sky-600 bg-clip-text text-transparent">sans effort.</span>
          </h1>

          <p className={`mx-auto mt-6 max-w-2xl text-lg md:text-xl ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}>
            Alizè analyse ton CV et recherche automatiquement les offres qui te correspondent
            sur France Travail, Adzuna et LinkedIn.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isAuthed ? (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600 hover:shadow-sky-500/40 transition-all"
                >
                  Commencer gratuitement
                  <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
                </Link>
                <Link
                  href="/login"
                  className={`inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-medium transition-all ${
                    isDark
                      ? "text-gray-300 hover:text-white hover:bg-white/5"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  Se connecter
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600 hover:shadow-sky-500/40 transition-all"
              >
                Accéder au tableau de bord
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            )}
          </div>

          {/* Trust badges */}
          <div className={`mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faShieldHalved} />
              <span>Données sécurisées</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faRocket} />
              <span>100% gratuit</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheck} />
              <span>Sans engagement</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-24 ${isDark ? "bg-[#0d1117]" : "bg-gray-50"}`}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              Comment ça marche
            </h2>
            <p className={`text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Trois étapes simples pour trouver les meilleures offres
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: faFileAlt, title: "1. Télécharge ton CV", desc: "Notre IA analyse ton CV pour extraire tes compétences et expériences.", color: "sky" },
              { icon: faBriefcase, title: "2. Configure tes préférences", desc: "Localisation, type de contrat, mots-clés à rechercher ou éviter.", color: "emerald" },
              { icon: faChartSimple, title: "3. Reçois les offres", desc: "L'IA score chaque offre de 0 à 10 selon ton profil.", color: "amber" },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`relative rounded-2xl border p-8 text-center transition-all hover:shadow-lg ${
                  isDark
                    ? "border-gray-800 bg-[#0a0b0f] hover:border-gray-700"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-gray-100"
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                  item.color === "sky"
                    ? isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600"
                    : item.color === "emerald"
                      ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                      : isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
                }`}>
                  <FontAwesomeIcon icon={item.icon} className="text-xl" />
                </div>
                <h3 className={`text-lg font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                  {item.title}
                </h3>
                <p className={`text-sm leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className={`text-3xl md:text-4xl font-bold mb-8 ${
                isDark ? "text-white" : "text-gray-900"
              }`}>
                Tout ce dont tu as besoin
              </h2>

              <div className="space-y-6">
                {[
                  { title: "Multi-sources", desc: "France Travail, Adzuna et LinkedIn réunis", color: "sky" },
                  { title: "Scoring intelligent", desc: "Chaque offre notée selon ton profil", color: "emerald" },
                  { title: "Notifications email", desc: "Digest des nouvelles offres", color: "amber" },
                  { title: "100% gratuit", desc: "Pas de frais cachés, jamais", color: "purple" },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.color === "sky"
                        ? isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600"
                        : item.color === "emerald"
                          ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                          : item.color === "amber"
                            ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
                            : isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
                    }`}>
                      <FontAwesomeIcon icon={faCheck} className="text-sm" />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                        {item.title}
                      </h4>
                      <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample card */}
            <div className={`rounded-2xl border p-6 ${
              isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200 shadow-xl shadow-gray-100"
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Nouveau
                    </span>
                  </div>
                  <h3 className={`font-semibold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                    Data Analyst
                  </h3>
                  <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    NovaTech · Paris · Hybride
                  </p>
                </div>
                <div className={`rounded-xl px-3 py-2 text-center ${
                  isDark ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                }`}>
                  <div className="text-xl font-bold leading-none">9</div>
                  <div className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">/10</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {["SQL", "Python", "Data Analysis", "Tableau"].map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className={`mt-4 pt-4 border-t ${isDark ? "border-gray-800" : "border-gray-100"}`}>
                <button className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600 transition-colors">
                  Voir l'offre
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-24 ${isDark ? "bg-[#0d1117]" : "bg-gray-50"}`}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className={`rounded-3xl border p-12 ${
            isDark ? "border-gray-800 bg-gradient-to-b from-sky-500/5 to-transparent" : "border-gray-200 bg-white shadow-xl shadow-gray-100"
          }`}>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              Prêt à commencer ?
            </h2>
            <p className={`mb-8 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Crée ton compte gratuitement et trouve les offres qui te correspondent.
            </p>
            {!isAuthed ? (
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600 hover:shadow-sky-500/40 transition-all"
              >
                Créer mon compte
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-600 hover:shadow-sky-500/40 transition-all"
              >
                Voir mes offres
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 border-t ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <div className="mx-auto max-w-5xl px-6">
          <p className={`text-center text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
            Alizè utilise uniquement des sources legales. Tes donnees restent privees et securisees.
          </p>
        </div>
      </footer>
    </main>
  );
}
