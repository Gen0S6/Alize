"use client";

import Link from "next/link";
import { useTheme } from "../ThemeProvider";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faRocket,
  faCode,
  faHeart,
  faLightbulb,
  faArrowLeft,
  faGithub,
} from "@fortawesome/free-solid-svg-icons";
import { faGithub as faGithubBrand } from "@fortawesome/free-brands-svg-icons";

export default function AboutPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const containerClass = isDark
    ? "min-h-screen bg-[#0b0c10] text-gray-100"
    : "min-h-screen bg-white text-gray-900";

  const cardClass = isDark
    ? "rounded-2xl border border-gray-700 bg-[#0f1116] p-6"
    : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm";

  const featureCardClass = isDark
    ? "rounded-xl border border-gray-700/50 bg-[#0d1016]/50 p-5 hover:border-gray-600 transition-all"
    : "rounded-xl border border-gray-200 bg-gray-50 p-5 hover:border-gray-300 transition-all";

  return (
    <main className={containerClass}>
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Back button */}
        <Link
          href="/"
          className={`inline-flex items-center gap-2 text-sm mb-8 transition-colors ${
            isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
          Retour à l'accueil
        </Link>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 ${
            isDark ? "bg-gradient-to-br from-blue-600 to-purple-600" : "bg-gradient-to-br from-blue-500 to-purple-500"
          }`}>
            <span className="text-3xl font-bold text-white">G7</span>
          </div>
          <h1 className={`text-4xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
            Gen0S7
          </h1>
          <p className={`text-xl ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Une équipe passionnée par l'innovation
          </p>
        </div>

        {/* Mission Section */}
        <div className={cardClass + " mb-8"}>
          <div className="flex items-start gap-4">
            <div className={`rounded-xl p-3 ${isDark ? "bg-blue-900/30" : "bg-blue-100"}`}>
              <FontAwesomeIcon icon={faRocket} className={`text-xl ${isDark ? "text-blue-400" : "text-blue-600"}`} />
            </div>
            <div>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                Notre Mission
              </h2>
              <p className={`leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Chez <strong>Gen0S7</strong>, nous croyons que la recherche d'emploi ne devrait pas être
                une source de stress. C'est pourquoi nous avons créé <strong>Alizé</strong>, une plateforme
                intelligente qui simplifie et automatise la recherche d'offres d'emploi en France.
              </p>
              <p className={`mt-3 leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Notre objectif est de connecter les talents avec les opportunités qui leur correspondent
                vraiment, grâce à l'intelligence artificielle et une approche centrée sur l'utilisateur.
              </p>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
          Nos Valeurs
        </h2>
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <div className={featureCardClass}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${isDark ? "bg-purple-900/30" : "bg-purple-100"}`}>
                <FontAwesomeIcon icon={faLightbulb} className={`${isDark ? "text-purple-400" : "text-purple-600"}`} />
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  Innovation
                </h3>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Nous repoussons les limites de la technologie pour créer des solutions uniques.
                </p>
              </div>
            </div>
          </div>

          <div className={featureCardClass}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${isDark ? "bg-green-900/30" : "bg-green-100"}`}>
                <FontAwesomeIcon icon={faUsers} className={`${isDark ? "text-green-400" : "text-green-600"}`} />
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  Collaboration
                </h3>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Le travail d'équipe est au cœur de tout ce que nous créons.
                </p>
              </div>
            </div>
          </div>

          <div className={featureCardClass}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${isDark ? "bg-amber-900/30" : "bg-amber-100"}`}>
                <FontAwesomeIcon icon={faCode} className={`${isDark ? "text-amber-400" : "text-amber-600"}`} />
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  Qualité
                </h3>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Nous visons l'excellence dans chaque ligne de code que nous écrivons.
                </p>
              </div>
            </div>
          </div>

          <div className={featureCardClass}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${isDark ? "bg-red-900/30" : "bg-red-100"}`}>
                <FontAwesomeIcon icon={faHeart} className={`${isDark ? "text-red-400" : "text-red-600"}`} />
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  Passion
                </h3>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Chaque projet est porté par notre passion pour la technologie.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* About Alizé */}
        <div className={cardClass + " mb-8"}>
          <h2 className={`text-xl font-semibold mb-4 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
            À propos d'Alizé
          </h2>
          <p className={`leading-relaxed mb-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            <strong>Alizé</strong> est notre projet phare : une plateforme de matching d'emploi
            alimentée par l'IA. Elle analyse votre CV, comprend vos préférences et recherche
            automatiquement les meilleures offres sur France Travail, Adzuna et LinkedIn.
          </p>
          <ul className={`space-y-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            <li className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-blue-400" : "bg-blue-500"}`} />
              Analyse intelligente de CV avec extraction de compétences
            </li>
            <li className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-blue-400" : "bg-blue-500"}`} />
              Scoring personnalisé des offres (0-10)
            </li>
            <li className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-blue-400" : "bg-blue-500"}`} />
              Agrégation multi-sources sans doublons
            </li>
            <li className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-blue-400" : "bg-blue-500"}`} />
              Notifications email personnalisées
            </li>
          </ul>
        </div>

        {/* Contact Section */}
        <div className={`text-center py-8 border-t ${isDark ? "border-gray-800" : "border-gray-200"}`}>
          <p className={`mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Envie de nous rejoindre ou de collaborer ?
          </p>
          <a
            href="https://github.com/Gen0S7"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-all ${
              isDark
                ? "bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            <FontAwesomeIcon icon={faGithubBrand} />
            Suivre Gen0S7 sur GitHub
          </a>
        </div>

        {/* Footer */}
        <div className={`text-center mt-8 pt-8 border-t ${isDark ? "border-gray-800" : "border-gray-200"}`}>
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            © 2024-2025 Gen0S7. Tous droits réservés.
          </p>
        </div>
      </div>
    </main>
  );
}
