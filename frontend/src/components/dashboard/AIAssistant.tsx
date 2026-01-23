"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRotate,
  faSearch,
  faGraduationCap,
  faLaptopCode,
  faHandshake,
  faGlobe,
  faCheckCircle,
  faExclamationCircle,
  faBriefcase,
} from "@fortawesome/free-solid-svg-icons";
import { Analysis } from "../../lib/api";

interface AIAssistantProps {
  isDark: boolean;
  analysis: Analysis | null;
  analysisLoading: boolean;
  analysisError: string | null;
  searching: boolean;
  onReloadAnalysis: () => void;
  onLaunchSearch: () => void;
}

export function AIAssistant({
  isDark,
  analysis,
  analysisLoading,
  analysisError,
  searching,
  onReloadAnalysis,
  onLaunchSearch,
}: AIAssistantProps) {
  return (
    <div className={`rounded-lg border p-4 ${isDark ? "border-gray-800 bg-[#0a0b0f]" : "border-gray-200 bg-white"}`}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
            Assistant IA
          </h2>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Analyse ton CV et tes preferences pour des recherches ciblees
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReloadAnalysis}
            disabled={analysisLoading}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              isDark
                ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FontAwesomeIcon icon={faRotate} className={analysisLoading ? "animate-spin" : ""} />
            Relancer
          </button>
          <button
            onClick={onLaunchSearch}
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faSearch} className={searching ? "animate-pulse" : ""} />
            {searching ? "Recherche..." : "Lancer"}
          </button>
        </div>
      </div>

      {/* Error */}
      {analysisError && (
        <div className={`mt-3 rounded-md p-2 text-sm ${isDark ? "bg-red-900/30 text-red-300" : "bg-red-50 text-red-700"}`}>
          {analysisError}
        </div>
      )}

      {/* Loading */}
      {analysisLoading && !analysis && <AIAssistantSkeleton isDark={isDark} />}

      {/* Content */}
      {analysis && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Left column: Profile */}
          <div className={`rounded-md border p-4 ${isDark ? "border-gray-800 bg-[#0d1016]" : "border-gray-200 bg-gray-50"}`}>
            <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              {analysis.summary}
            </p>

            {/* Badges */}
            {(analysis.niveau_experience || analysis.titre_poste_cible) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.niveau_experience && (
                  <span className={`rounded px-2 py-1 text-xs font-medium ${
                    isDark ? "bg-gray-800 text-gray-300" : "bg-gray-200 text-gray-700"
                  }`}>
                    {analysis.niveau_experience === "senior" ? "Senior" :
                     analysis.niveau_experience === "confirme" ? "Confirme" : "Junior"}
                  </span>
                )}
                {analysis.titre_poste_cible && (
                  <span className={`rounded px-2 py-1 text-xs font-medium ${
                    isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700"
                  }`}>
                    {analysis.titre_poste_cible}
                  </span>
                )}
              </div>
            )}

            {/* Formation */}
            {analysis.formation && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <FontAwesomeIcon icon={faGraduationCap} className="text-xs" />
                {analysis.formation}
              </div>
            )}

            {/* CV Quality */}
            {analysis.cv_quality_score && (
              <div className={`mt-4 rounded-md p-3 ${isDark ? "bg-gray-800/50" : "bg-white border border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Qualite du CV
                  </span>
                  <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    {analysis.cv_quality_score.grade} - {analysis.cv_quality_score.total_score}/100
                  </span>
                </div>
                <p className={`mt-2 text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {analysis.cv_quality_score.assessment}
                </p>
                {analysis.cv_quality_score.strengths && analysis.cv_quality_score.strengths.length > 0 && (
                  <div className="mt-2">
                    <p className={`text-xs font-medium ${isDark ? "text-green-400" : "text-green-600"}`}>Points forts</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {analysis.cv_quality_score.strengths.slice(0, 3).map((s) => (
                        <span key={s} className={`rounded px-2 py-0.5 text-xs ${
                          isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-700"
                        }`}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.cv_quality_score.suggestions && analysis.cv_quality_score.suggestions.length > 0 && (
                  <div className="mt-2">
                    <p className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}>A ameliorer</p>
                    <ul className={`mt-1 space-y-1 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {analysis.cv_quality_score.suggestions.slice(0, 2).map((s) => (
                        <li key={s}>- {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Suggested queries */}
            <div className="mt-4">
              <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Requetes IA
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.suggested_queries.length === 0 && (
                  <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Ajoute un CV ou des preferences.
                  </span>
                )}
                {analysis.suggested_queries.map((q) => (
                  <span key={q} className={`rounded px-2 py-0.5 text-xs ${
                    isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
                  }`}>{q}</span>
                ))}
              </div>
            </div>

            {/* Sectors */}
            {analysis.secteurs_cibles && analysis.secteurs_cibles.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faBriefcase} className="mr-1" />
                  Secteurs cibles
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.secteurs_cibles.map((s: string) => (
                    <span key={s} className={`rounded px-2 py-0.5 text-xs ${
                      isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
                    }`}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Skills */}
          <div className={`rounded-md border p-4 ${isDark ? "border-gray-800 bg-[#0d1016]" : "border-gray-200 bg-gray-50"}`}>
            {/* Key skills */}
            <div>
              <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Competences cles
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.top_keywords.slice(0, 10).map((kw) => (
                  <span key={kw} className={`rounded px-2 py-0.5 text-xs font-medium ${
                    isDark ? "bg-gray-800 text-gray-200" : "bg-gray-200 text-gray-800"
                  }`}>{kw}</span>
                ))}
                {analysis.top_keywords.length === 0 && (
                  <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Aucune competence detectee.
                  </span>
                )}
              </div>
            </div>

            {/* Technical skills */}
            {analysis.competences_techniques && analysis.competences_techniques.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faLaptopCode} className="mr-1" />
                  Techniques
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.competences_techniques.map((skill: string) => (
                    <span key={skill} className={`rounded px-2 py-0.5 text-xs ${
                      isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700"
                    }`}>{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Soft skills */}
            {analysis.competences_transversales && analysis.competences_transversales.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faHandshake} className="mr-1" />
                  Soft skills
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.competences_transversales.map((skill: string) => (
                    <span key={skill} className={`rounded px-2 py-0.5 text-xs ${
                      isDark ? "bg-amber-900/30 text-amber-300" : "bg-amber-100 text-amber-700"
                    }`}>{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {analysis.langues && analysis.langues.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faGlobe} className="mr-1" />
                  Langues
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.langues.map((lang: string) => (
                    <span key={lang} className={`rounded px-2 py-0.5 text-xs ${
                      isDark ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-700"
                    }`}>{lang}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Must hits / missing */}
            {(analysis.must_hits.length > 0 || analysis.missing_must.length > 0) && (
              <div className="mt-4 grid gap-3 grid-cols-2">
                <div>
                  <p className={`text-xs font-medium ${isDark ? "text-green-400" : "text-green-600"}`}>
                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                    Mots-cles trouves
                  </p>
                  <ul className={`mt-1 space-y-0.5 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {analysis.must_hits.length === 0 && <li>-</li>}
                    {analysis.must_hits.map((kw) => (
                      <li key={kw}>- {kw}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className={`text-xs font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}>
                    <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                    A completer
                  </p>
                  <ul className={`mt-1 space-y-0.5 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {analysis.missing_must.length === 0 && <li>-</li>}
                    {analysis.missing_must.map((kw) => (
                      <li key={kw}>- {kw}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AIAssistantSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className={`rounded-md border p-4 ${isDark ? "border-gray-800 bg-[#0d1016]" : "border-gray-200 bg-gray-50"}`}>
        <div className={`h-4 w-full rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className={`h-4 w-3/4 rounded animate-pulse mt-2 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-6 w-16 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      <div className={`rounded-md border p-4 ${isDark ? "border-gray-800 bg-[#0d1016]" : "border-gray-200 bg-gray-50"}`}>
        <div className={`h-3 w-24 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`h-6 w-14 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
