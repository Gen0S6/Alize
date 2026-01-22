"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { getToken } from "../lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faBriefcase,
  faChartLine,
  faBell,
  faShieldHalved,
  faArrowRight,
  faCheckCircle,
  faRocket,
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

  const containerClass = isDark
    ? "min-h-screen text-slate-100"
    : "min-h-screen text-slate-900";

  return (
    <main className={containerClass}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className={`absolute inset-0 ${
          isDark
            ? "bg-gradient-to-br from-blue-900/30 via-transparent to-purple-900/30"
            : "bg-gradient-to-br from-blue-100 via-transparent to-purple-100"
        }`} />

        {/* Decorative elements */}
        <div className={`absolute top-16 left-10 w-80 h-80 rounded-full blur-3xl ${
          isDark ? "bg-blue-500/20" : "bg-blue-300/40"
        }`} />
        <div className={`absolute bottom-12 right-10 w-[28rem] h-[28rem] rounded-full blur-3xl ${
          isDark ? "bg-purple-500/15" : "bg-purple-300/30"
        }`} />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
              isDark
                ? "bg-white/5 text-blue-200 border border-white/10"
                : "bg-white/70 text-blue-700 border border-blue-200/60"
            }`}>
              <FontAwesomeIcon icon={faRocket} className="text-xs" />
              Plateforme pilotée par l'IA
            </span>
          </div>

          {/* Main heading */}
          <h1 className={`text-center text-4xl md:text-6xl font-semibold tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}>
            Trouve les meilleures offres
            <br />
            <span className={`bg-gradient-to-r bg-clip-text text-transparent ${
              isDark
                ? "from-blue-300 via-purple-300 to-blue-300"
                : "from-blue-600 via-purple-600 to-blue-600"
            }`}>
              en quelques clics
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`mx-auto mt-6 max-w-2xl text-center text-lg md:text-xl ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}>
            Alizé analyse ton CV, comprend tes préférences et recherche automatiquement
            les offres d'emploi qui te correspondent sur France Travail, Adzuna et LinkedIn.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isAuthed ? (
              <>
                <Link
                  href="/register"
                  className={`
                    inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold
                    transition-all duration-200 transform hover:-translate-y-0.5
                    ${isDark
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                    }
                  `}
                >
                  Commencer gratuitement
                  <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
                </Link>
                <Link
                  href="/login"
                  className={`
                    inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold
                    transition-all duration-200 border backdrop-blur
                    ${isDark
                      ? "border-white/10 text-slate-200 hover:bg-white/10"
                      : "border-slate-200 text-slate-700 hover:bg-white"
                    }
                  `}
                >
                  Se connecter
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className={`
                  inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold
                  transition-all duration-200 transform hover:-translate-y-0.5
                  ${isDark
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                  }
                `}
              >
                Accéder au tableau de bord
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            )}
          </div>

          {/* Trust indicators */}
          <div className={`mt-12 flex flex-wrap items-center justify-center gap-6 text-sm ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
              100% gratuit
            </span>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
              Données sécurisées
            </span>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
              Sources légales uniquement
            </span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-20 ${isDark ? "bg-[#0a0c14]" : "bg-white/60"}`}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl md:text-4xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              Tout ce dont tu as besoin
            </h2>
            <p className={`mt-4 text-lg ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Une suite complète d'outils pour optimiser ta recherche d'emploi
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 ${
              isDark
                ? "glass-panel shadow-lg shadow-black/20"
                : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-purple-500/20" : "bg-purple-100"
              }`}>
                <FontAwesomeIcon icon={faWandMagicSparkles} className={`text-xl ${
                  isDark ? "text-purple-300" : "text-purple-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                Analyse IA du CV
              </h3>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Notre IA extrait automatiquement tes compétences, expériences et génère des requêtes de recherche ciblées.
              </p>
            </div>

            {/* Feature 2 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 ${
              isDark
                ? "glass-panel shadow-lg shadow-black/20"
                : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-blue-500/20" : "bg-blue-100"
              }`}>
                <FontAwesomeIcon icon={faBriefcase} className={`text-xl ${
                  isDark ? "text-blue-300" : "text-blue-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                Multi-sources
              </h3>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Offres consolidées depuis France Travail, Adzuna et LinkedIn, sans doublons ni redondances.
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 ${
              isDark
                ? "glass-panel shadow-lg shadow-black/20"
                : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-emerald-500/20" : "bg-emerald-100"
              }`}>
                <FontAwesomeIcon icon={faChartLine} className={`text-xl ${
                  isDark ? "text-emerald-300" : "text-emerald-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                Scoring intelligent
              </h3>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Chaque offre reçoit un score de 0 à 10 basé sur ton profil, tes compétences et tes préférences.
              </p>
            </div>

            {/* Feature 4 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 ${
              isDark
                ? "glass-panel shadow-lg shadow-black/20"
                : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-amber-500/20" : "bg-amber-100"
              }`}>
                <FontAwesomeIcon icon={faBell} className={`text-xl ${
                  isDark ? "text-amber-300" : "text-amber-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                Notifications
              </h3>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Reçois un digest email avec les meilleures nouvelles offres correspondant à ton profil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sample match preview */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Aperçu d'un match
            </h2>
            <p className={`mt-4 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Un exemple concret de ce que tu verras dans ton dashboard.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Data Analyst",
                company: "NovaTech",
                location: "Paris · Hybride",
                score: "9/10",
                reasons: ["Rôle: Data Analyst", "Mot-clé: SQL", "CV: Python"],
              },
              {
                title: "Product Manager",
                company: "Studio Horizon",
                location: "Lyon · Remote",
                score: "8/10",
                reasons: ["Rôle proche: Product", "Localisation: Remote", "CV: Agile"],
              },
            ].map((match) => (
              <div
                key={match.title}
                className={`rounded-2xl border p-6 ${
                  isDark
                    ? "border-gray-700 bg-[#0f1116]"
                    : "border-gray-200 bg-white shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                      {match.title}
                    </h3>
                    <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {match.company} • {match.location}
                    </p>
                  </div>
                  <span className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
                    isDark ? "bg-emerald-900/40 text-emerald-200" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {match.score}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {match.reasons.map((reason) => (
                    <span
                      key={reason}
                      className={`rounded-lg px-3 py-1 text-xs ${
                        isDark
                          ? "bg-[#111621] text-gray-200 border border-gray-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl md:text-4xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              Comment ça fonctionne ?
            </h2>
            <p className={`mt-4 text-lg ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Trois étapes simples pour trouver ton prochain emploi
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className={`rounded-2xl p-6 text-center ${
              isDark ? "glass-panel shadow-lg shadow-black/20" : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 text-xl font-bold ${
                isDark
                  ? "bg-blue-500/20 text-blue-200"
                  : "bg-blue-100 text-blue-600"
              }`}>
                1
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                Télécharge ton CV
              </h3>
              <p className={`${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Notre IA analyse automatiquement ton CV pour extraire tes compétences et expériences clés.
              </p>
            </div>

            {/* Step 2 */}
            <div className={`rounded-2xl p-6 text-center ${
              isDark ? "glass-panel shadow-lg shadow-black/20" : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 text-xl font-bold ${
                isDark
                  ? "bg-purple-500/20 text-purple-200"
                  : "bg-purple-100 text-purple-600"
              }`}>
                2
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                Configure tes préférences
              </h3>
              <p className={`${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Indique ta localisation souhaitée, le type de contrat, les mots-clés importants et ceux à éviter.
              </p>
            </div>

            {/* Step 3 */}
            <div className={`rounded-2xl p-6 text-center ${
              isDark ? "glass-panel shadow-lg shadow-black/20" : "bg-white border border-slate-200 shadow-sm"
            }`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 text-xl font-bold ${
                isDark
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-emerald-100 text-emerald-600"
              }`}>
                3
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
                Reçois les meilleures offres
              </h3>
              <p className={`${isDark ? "text-slate-400" : "text-slate-600"}`}>
                L'IA recherche et score les offres. Tu reçois uniquement celles qui correspondent vraiment à ton profil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${isDark ? "bg-[#0a0c14]" : "bg-white/60"}`}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className={`rounded-3xl p-10 md:p-16 ${
            isDark
              ? "bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-white/10"
              : "bg-white border border-slate-200 shadow-sm"
          }`}>
            <FontAwesomeIcon icon={faShieldHalved} className={`text-4xl mb-6 ${
              isDark ? "text-blue-300" : "text-blue-600"
            }`} />
            <h2 className={`text-3xl md:text-4xl font-semibold mb-4 ${isDark ? "text-white" : "text-slate-900"}`}>
              Prêt à simplifier ta recherche ?
            </h2>
            <p className={`text-lg mb-8 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Rejoins Alizé gratuitement et laisse notre IA trouver les meilleures opportunités pour toi.
            </p>
            {!isAuthed ? (
              <Link
                href="/register"
                className={`
                  inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold
                  transition-all duration-200 transform hover:-translate-y-0.5
                  ${isDark
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                  }
                `}
              >
                Créer mon compte
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className={`
                  inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold
                  transition-all duration-200 transform hover:-translate-y-0.5
                  ${isDark
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                  }
                `}
              >
                Voir mes offres
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className={`py-8 text-center border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Alizé utilise uniquement des sources légales : France Travail et Adzuna. Tes données restent privées et sécurisées.
        </p>
      </div>
    </main>
  );
}
