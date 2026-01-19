"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faRotate,
  faSearch,
  faBriefcase,
  faGraduationCap,
  faLaptopCode,
  faHandshake,
  faGlobe,
  faCheckCircle,
  faExclamationCircle,
  faBullseye,
  faUser,
  faBolt,
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
    <div
      className={`
        rounded-2xl border p-5 transition-all
        ${isDark
          ? "border-gray-700 bg-gradient-to-br from-[#0f1116] to-[#131720]"
          : "border-gray-200 bg-gradient-to-br from-white to-gray-50"
        }
      `}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className={`
            rounded-xl p-3
            ${isDark ? "bg-purple-900/30" : "bg-purple-100"}
          `}>
            <FontAwesomeIcon icon={faWandMagicSparkles} className={`text-xl ${isDark ? "text-purple-400" : "text-purple-600"}`} />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
              Assistant IA
            </h2>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Analyse ton CV et tes préférences pour suggérer des recherches ciblées.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReloadAnalysis}
            disabled={analysisLoading}
            className={`
              inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
              disabled:opacity-50
              ${isDark
                ? "border border-gray-600 text-gray-300 hover:bg-gray-800"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }
            `}
          >
            <FontAwesomeIcon icon={faRotate} className={analysisLoading ? "animate-spin" : ""} />
            {analysisLoading ? "Analyse..." : "Relancer"}
          </button>
          <button
            onClick={onLaunchSearch}
            disabled={searching}
            className={`
              inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
              disabled:opacity-50
              ${isDark
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-blue-600 text-white hover:bg-blue-700"
              }
            `}
          >
            <FontAwesomeIcon icon={faSearch} className={searching ? "animate-pulse" : ""} />
            {searching ? "Recherche..." : "Recherche IA"}
          </button>
        </div>
      </div>

      {/* Error state */}
      {analysisError && (
        <div className={`
          mt-4 rounded-xl p-3 flex items-center gap-2
          ${isDark ? "bg-red-900/30 text-red-300" : "bg-red-50 text-red-700"}
        `}>
          <FontAwesomeIcon icon={faExclamationCircle} />
          <span className="text-sm">{analysisError}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {analysisLoading && !analysis && <AIAssistantSkeleton isDark={isDark} />}

      {/* Content */}
      {analysis && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Left column: Profile */}
          <div className={`rounded-xl border p-4 ${isDark ? "border-gray-700 bg-[#0d1016]/50" : "border-gray-200 bg-white"}`}>
            <p className={`text-sm leading-relaxed ${isDark ? "text-gray-200" : "text-gray-700"}`}>
              {analysis.summary}
            </p>

            {/* Badges */}
            {(analysis.niveau_experience || analysis.titre_poste_cible) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.niveau_experience && (
                  <span className={`
                    inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                    ${analysis.niveau_experience === "senior"
                      ? isDark ? "bg-purple-900/40 text-purple-300 border border-purple-700" : "bg-purple-100 text-purple-800"
                      : analysis.niveau_experience === "confirme"
                        ? isDark ? "bg-blue-900/40 text-blue-300 border border-blue-700" : "bg-blue-100 text-blue-800"
                        : isDark ? "bg-green-900/40 text-green-300 border border-green-700" : "bg-green-100 text-green-800"
                    }
                  `}>
                    <FontAwesomeIcon icon={faUser} className="text-[10px]" />
                    {analysis.niveau_experience === "senior" ? "Senior" :
                     analysis.niveau_experience === "confirme" ? "Confirmé" : "Junior"}
                  </span>
                )}
                {analysis.titre_poste_cible && (
                  <span className={`
                    inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                    ${isDark ? "bg-gray-800 text-gray-200 border border-gray-700" : "bg-gray-100 text-gray-800"}
                  `}>
                    <FontAwesomeIcon icon={faBullseye} className="text-[10px]" />
                    {analysis.titre_poste_cible}
                  </span>
                )}
              </div>
            )}

            {/* Formation */}
            {analysis.formation && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <FontAwesomeIcon icon={faGraduationCap} className="text-gray-500" />
                {analysis.formation}
              </div>
            )}

            {/* LLM badge */}
            {analysis.llm_used && (
              <div className={`
                mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium
                ${isDark ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-100 text-emerald-700"}
              `}>
                <FontAwesomeIcon icon={faBolt} className="text-[10px]" />
                Analyse enrichie par IA
              </div>
            )}

            {/* Suggested queries */}
            <div className="mt-4">
              <p className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Requêtes IA
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.suggested_queries.length === 0 && (
                  <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Ajoute un CV ou des préférences.
                  </span>
                )}
                {analysis.suggested_queries.map((q) => (
                  <span
                    key={q}
                    className={`
                      rounded-lg px-3 py-1.5 text-xs
                      ${isDark ? "bg-[#111621] text-gray-200 border border-gray-700" : "bg-gray-100 text-gray-700"}
                    `}
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>

            {/* Target sectors */}
            {analysis.secteurs_cibles && analysis.secteurs_cibles.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faBriefcase} className="mr-1" />
                  Secteurs cibles
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.secteurs_cibles.map((s: string) => (
                    <span
                      key={s}
                      className={`
                        rounded-lg px-3 py-1.5 text-xs
                        ${isDark ? "bg-gray-800/50 text-gray-300 border border-gray-700" : "bg-gray-50 text-gray-600 border border-gray-200"}
                      `}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Skills */}
          <div className={`rounded-xl border p-4 ${isDark ? "border-gray-700 bg-[#0d1016]/50" : "border-gray-200 bg-white"}`}>
            {/* Key skills */}
            <div>
              <p className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Compétences clés
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.top_keywords.slice(0, 10).map((kw) => (
                  <span
                    key={kw}
                    className={`
                      rounded-lg px-3 py-1.5 text-xs font-medium
                      ${isDark ? "bg-[#111621] text-gray-100 border border-gray-700" : "bg-gray-100 text-gray-800"}
                    `}
                  >
                    {kw}
                  </span>
                ))}
                {analysis.top_keywords.length === 0 && (
                  <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Aucune compétence détectée.
                  </span>
                )}
              </div>
            </div>

            {/* Technical skills */}
            {analysis.competences_techniques && analysis.competences_techniques.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faLaptopCode} className="mr-1" />
                  Compétences techniques
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.competences_techniques.map((skill: string) => (
                    <span
                      key={skill}
                      className={`
                        rounded-lg px-3 py-1.5 text-xs
                        ${isDark ? "bg-blue-900/30 text-blue-300 border border-blue-800" : "bg-blue-50 text-blue-700"}
                      `}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Soft skills */}
            {analysis.competences_transversales && analysis.competences_transversales.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faHandshake} className="mr-1" />
                  Soft skills
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.competences_transversales.map((skill: string) => (
                    <span
                      key={skill}
                      className={`
                        rounded-lg px-3 py-1.5 text-xs
                        ${isDark ? "bg-amber-900/30 text-amber-300 border border-amber-800" : "bg-amber-50 text-amber-700"}
                      `}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {analysis.langues && analysis.langues.length > 0 && (
              <div className="mt-4">
                <p className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <FontAwesomeIcon icon={faGlobe} className="mr-1" />
                  Langues
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.langues.map((lang: string) => (
                    <span
                      key={lang}
                      className={`
                        rounded-lg px-3 py-1.5 text-xs
                        ${isDark ? "bg-emerald-900/30 text-emerald-300 border border-emerald-800" : "bg-emerald-50 text-emerald-700"}
                      `}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Must hits / missing */}
            {(analysis.must_hits.length > 0 || analysis.missing_must.length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className={`text-xs font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                    Mots-clés trouvés
                  </p>
                  <ul className={`mt-1 space-y-1 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {analysis.must_hits.length === 0 && <li>-</li>}
                    {analysis.must_hits.map((kw) => (
                      <li key={kw} className="flex items-center gap-1">
                        <span className="text-emerald-500">•</span> {kw}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDark ? "text-orange-400" : "text-orange-600"}`}>
                    <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                    À compléter
                  </p>
                  <ul className={`mt-1 space-y-1 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {analysis.missing_must.length === 0 && <li>-</li>}
                    {analysis.missing_must.map((kw) => (
                      <li key={kw} className="flex items-center gap-1">
                        <span className="text-orange-500">•</span> {kw}
                      </li>
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
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div className={`rounded-xl border p-4 ${isDark ? "border-gray-700 bg-[#0d1016]/50" : "border-gray-200 bg-white"}`}>
        <div className={`h-4 w-full rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className={`h-4 w-3/4 rounded animate-pulse mt-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className="mt-4 flex flex-wrap gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-7 w-20 rounded-full animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          ))}
        </div>
        <div className={`h-3 w-16 rounded animate-pulse mt-4 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className="mt-2 flex flex-wrap gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-7 w-24 rounded-lg animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      <div className={`rounded-xl border p-4 ${isDark ? "border-gray-700 bg-[#0d1016]/50" : "border-gray-200 bg-white"}`}>
        <div className={`h-3 w-24 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className="mt-2 flex flex-wrap gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-7 w-16 rounded-lg animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          ))}
        </div>
        <div className={`h-3 w-32 rounded animate-pulse mt-4 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className="mt-2 flex flex-wrap gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-7 w-14 rounded-lg animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
