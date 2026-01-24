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
  faBell,
  faArrowRight,
  faCheck,
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
    <main className={isDark ? "min-h-screen bg-[#0f1117] text-gray-100" : "min-h-screen bg-white text-gray-900"}>
      {/* Hero Section */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className={`text-4xl md:text-5xl font-semibold tracking-tight leading-tight ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Trouve ton prochain emploi,
            <br />
            <span className="text-sky-600">sans effort.</span>
          </h1>

          <p className={`mx-auto mt-6 max-w-2xl text-lg ${
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
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-medium text-white hover:bg-sky-700 transition-colors"
                >
                  Commencer gratuitement
                  <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
                </Link>
                <Link
                  href="/login"
                  className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-medium transition-colors ${
                    isDark
                      ? "text-gray-300 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Se connecter
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-medium text-white hover:bg-sky-700 transition-colors"
              >
                Accéder au tableau de bord
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-20 ${isDark ? "bg-[#0a0b0f]" : "bg-gray-50"}`}>
        <div className="mx-auto max-w-5xl px-6">
          <h2 className={`text-center text-2xl md:text-3xl font-semibold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Comment ça marche
          </h2>
          <p className={`text-center mb-12 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Trois étapes simples pour trouver les meilleures offres
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? "bg-sky-900/50 text-sky-400" : "bg-sky-100 text-sky-600"
              }`}>
                <FontAwesomeIcon icon={faFileAlt} />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                1. Télécharge ton CV
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Notre IA analyse ton CV pour extraire tes compétences et expériences.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? "bg-sky-900/50 text-sky-400" : "bg-sky-100 text-sky-600"
              }`}>
                <FontAwesomeIcon icon={faBriefcase} />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                2. Configure tes préférences
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Localisation, type de contrat, mots-clés à rechercher ou éviter.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? "bg-sky-900/50 text-sky-400" : "bg-sky-100 text-sky-600"
              }`}>
                <FontAwesomeIcon icon={faChartSimple} />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                3. Reçois les offres
              </h3>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                L'IA score chaque offre de 0 à 10 selon ton profil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className={`text-2xl md:text-3xl font-semibold mb-6 ${
                isDark ? "text-white" : "text-gray-900"
              }`}>
                Tout ce dont tu as besoin
              </h2>

              <div className="space-y-4">
                {[
                  { title: "Multi-sources", desc: "France Travail, Adzuna et LinkedIn réunis" },
                  { title: "Scoring intelligent", desc: "Chaque offre notée selon ton profil" },
                  { title: "Notifications email", desc: "Digest des nouvelles offres" },
                  { title: "100% gratuit", desc: "Pas de frais cachés, jamais" },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isDark ? "bg-green-900/50 text-green-400" : "bg-green-100 text-green-600"
                    }`}>
                      <FontAwesomeIcon icon={faCheck} className="text-xs" />
                    </div>
                    <div>
                      <h4 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                        {item.title}
                      </h4>
                      <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample card */}
            <div className={`rounded-xl border p-6 ${
              isDark ? "bg-[#0a0b0f] border-gray-800" : "bg-white border-gray-200 shadow-sm"
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    Data Analyst
                  </h3>
                  <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    NovaTech · Paris · Hybride
                  </p>
                </div>
                <span className={`rounded-md px-2 py-1 text-sm font-medium ${
                  isDark ? "bg-green-900/50 text-green-400" : "bg-green-100 text-green-700"
                }`}>
                  9/10
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["SQL", "Python", "Data Analysis"].map((tag) => (
                  <span
                    key={tag}
                    className={`rounded px-2 py-1 text-xs ${
                      isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${isDark ? "bg-[#0a0b0f]" : "bg-gray-50"}`}>
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className={`text-2xl md:text-3xl font-semibold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Prêt à commencer ?
          </h2>
          <p className={`mb-8 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Crée ton compte gratuitement et trouve les offres qui te correspondent.
          </p>
          {!isAuthed ? (
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-medium text-white hover:bg-sky-700 transition-colors"
            >
              Créer mon compte
              <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-medium text-white hover:bg-sky-700 transition-colors"
            >
              Voir mes offres
              <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
            </Link>
          )}
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
