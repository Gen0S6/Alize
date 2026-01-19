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
    ? "min-h-screen bg-[#0b0c10] text-gray-100 theme-hover"
    : "min-h-screen bg-white text-gray-900 theme-hover";

  return (
    <main className={containerClass}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className={`absolute inset-0 ${
          isDark
            ? "bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20"
            : "bg-gradient-to-br from-blue-50 via-transparent to-purple-50"
        }`} />

        {/* Decorative elements */}
        <div className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl ${
          isDark ? "bg-blue-600/10" : "bg-blue-200/40"
        }`} />
        <div className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl ${
          isDark ? "bg-purple-600/10" : "bg-purple-200/30"
        }`} />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-32">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
              isDark
                ? "bg-blue-900/40 text-blue-300 border border-blue-700/50"
                : "bg-blue-100 text-blue-700 border border-blue-200"
            }`}>
              <FontAwesomeIcon icon={faRocket} className="text-xs" />
              Plateforme en développement actif
            </span>
          </div>

          {/* Main heading */}
          <h1 className={`text-center text-4xl md:text-6xl font-bold tracking-tight ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Trouve les meilleures offres
            <br />
            <span className={`bg-gradient-to-r bg-clip-text text-transparent ${
              isDark
                ? "from-blue-400 via-purple-400 to-blue-400"
                : "from-blue-600 via-purple-600 to-blue-600"
            }`}>
              en quelques clics
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`mx-auto mt-6 max-w-2xl text-center text-lg md:text-xl ${
            isDark ? "text-gray-300" : "text-gray-600"
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
                    transition-all duration-200 transform hover:scale-105
                    ${isDark
                      ? "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/10"
                      : "bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20"
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
                    transition-all duration-200 border
                    ${isDark
                      ? "border-gray-700 text-gray-200 hover:bg-gray-800/50"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
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
                  transition-all duration-200 transform hover:scale-105
                  ${isDark
                    ? "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/10"
                    : "bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20"
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
            isDark ? "text-gray-500" : "text-gray-400"
          }`}>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className={isDark ? "text-green-500" : "text-green-600"} />
              100% gratuit
            </span>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className={isDark ? "text-green-500" : "text-green-600"} />
              Données sécurisées
            </span>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className={isDark ? "text-green-500" : "text-green-600"} />
              Sources légales uniquement
            </span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-20 ${isDark ? "bg-[#0d1016]" : "bg-gray-50"}`}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Tout ce dont tu as besoin
            </h2>
            <p className={`mt-4 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Une suite complète d'outils pour optimiser ta recherche d'emploi
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:scale-105 ${
              isDark
                ? "bg-[#0f1116] border border-gray-800 hover:border-gray-700"
                : "bg-white border border-gray-200 hover:shadow-lg"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-purple-900/40" : "bg-purple-100"
              }`}>
                <FontAwesomeIcon icon={faWandMagicSparkles} className={`text-xl ${
                  isDark ? "text-purple-400" : "text-purple-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Analyse IA du CV
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Notre IA extrait automatiquement tes compétences, expériences et génère des requêtes de recherche ciblées.
              </p>
            </div>

            {/* Feature 2 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:scale-105 ${
              isDark
                ? "bg-[#0f1116] border border-gray-800 hover:border-gray-700"
                : "bg-white border border-gray-200 hover:shadow-lg"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-blue-900/40" : "bg-blue-100"
              }`}>
                <FontAwesomeIcon icon={faBriefcase} className={`text-xl ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Multi-sources
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Offres consolidées depuis France Travail, Adzuna et LinkedIn, sans doublons ni redondances.
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:scale-105 ${
              isDark
                ? "bg-[#0f1116] border border-gray-800 hover:border-gray-700"
                : "bg-white border border-gray-200 hover:shadow-lg"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-emerald-900/40" : "bg-emerald-100"
              }`}>
                <FontAwesomeIcon icon={faChartLine} className={`text-xl ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Scoring intelligent
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Chaque offre reçoit un score de 0 à 10 basé sur ton profil, tes compétences et tes préférences.
              </p>
            </div>

            {/* Feature 4 */}
            <div className={`rounded-2xl p-6 transition-all duration-200 hover:scale-105 ${
              isDark
                ? "bg-[#0f1116] border border-gray-800 hover:border-gray-700"
                : "bg-white border border-gray-200 hover:shadow-lg"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isDark ? "bg-amber-900/40" : "bg-amber-100"
              }`}>
                <FontAwesomeIcon icon={faBell} className={`text-xl ${
                  isDark ? "text-amber-400" : "text-amber-600"
                }`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Notifications
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Reçois un digest email avec les meilleures nouvelles offres correspondant à ton profil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Comment ça fonctionne ?
            </h2>
            <p className={`mt-4 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Trois étapes simples pour trouver ton prochain emploi
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold ${
                isDark
                  ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                  : "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
              }`}>
                1
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Télécharge ton CV
              </h3>
              <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Notre IA analyse automatiquement ton CV pour extraire tes compétences et expériences clés.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold ${
                isDark
                  ? "bg-gradient-to-br from-purple-600 to-purple-700 text-white"
                  : "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
              }`}>
                2
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Configure tes préférences
              </h3>
              <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Indique ta localisation souhaitée, le type de contrat, les mots-clés importants et ceux à éviter.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold ${
                isDark
                  ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white"
                  : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
              }`}>
                3
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Reçois les meilleures offres
              </h3>
              <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
                L'IA recherche et score les offres. Tu reçois uniquement celles qui correspondent vraiment à ton profil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${isDark ? "bg-[#0d1016]" : "bg-gray-50"}`}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className={`rounded-3xl p-10 md:p-16 ${
            isDark
              ? "bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-gray-800"
              : "bg-gradient-to-br from-blue-50 to-purple-50 border border-gray-200"
          }`}>
            <FontAwesomeIcon icon={faShieldHalved} className={`text-4xl mb-6 ${
              isDark ? "text-blue-400" : "text-blue-600"
            }`} />
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Prêt à simplifier ta recherche ?
            </h2>
            <p className={`text-lg mb-8 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Rejoins Alizé gratuitement et laisse notre IA trouver les meilleures opportunités pour toi.
            </p>
            {!isAuthed ? (
              <Link
                href="/register"
                className={`
                  inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold
                  transition-all duration-200 transform hover:scale-105
                  ${isDark
                    ? "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/10"
                    : "bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20"
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
                  transition-all duration-200 transform hover:scale-105
                  ${isDark
                    ? "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/10"
                    : "bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20"
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
      <div className={`py-8 text-center border-t ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Alizé utilise uniquement des sources légales : France Travail et Adzuna. Tes données restent privées et sécurisées.
        </p>
      </div>
    </main>
  );
}
