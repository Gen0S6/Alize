"use client";

import { useState } from "react";
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
  faChevronDown,
  faWandMagicSparkles,
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-xl border transition-all ${
      isDark
        ? "border-gray-800 bg-[#0d1117]"
        : "border-gray-200 bg-white"
    }`}>
      {/* Subtle gradient accent */}
      <div className={`absolute top-0 right-0 w-64 h-64 -mr-32 -mt-32 rounded-full opacity-30 blur-3xl ${
        isDark ? "bg-sky-500/20" : "bg-sky-400/20"
      }`} />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600"
            }`}>
              <FontAwesomeIcon icon={faWandMagicSparkles} />
            </div>
            <div>
              <h2 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Assistant IA
              </h2>
              <p className={`text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Analyse ton CV et tes preferences pour des recherches ciblees
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReloadAnalysis}
              disabled={analysisLoading}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                isDark
                  ? "border border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <FontAwesomeIcon icon={faRotate} className={analysisLoading ? "animate-spin" : ""} />
              Relancer
            </button>
            <button
              onClick={onLaunchSearch}
              disabled={searching}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-sky-600 hover:shadow-md hover:shadow-sky-500/25 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faSearch} className={searching ? "animate-pulse" : ""} />
              {searching ? "Recherche..." : "Lancer"}
            </button>
          </div>
        </div>

        {/* Error */}
        {analysisError && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-700 border border-red-100"
          }`}>
            {analysisError}
          </div>
        )}

        {/* Loading */}
        {analysisLoading && !analysis && <AIAssistantSkeleton isDark={isDark} />}

        {/* Content */}
        {analysis && (
          <div className="mt-5">
            {/* Summary - Always visible */}
            <div className={`rounded-xl border p-4 ${
              isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50"
            }`}>
              <p className={`text-sm leading-relaxed ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                {analysis.summary}
              </p>

              {/* Badges */}
              {(analysis.niveau_experience || analysis.titre_poste_cible) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.niveau_experience && (
                    <span className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      isDark ? "bg-gray-800 text-gray-300" : "bg-gray-200 text-gray-700"
                    }`}>
                      {analysis.niveau_experience === "senior" ? "Senior" :
                       analysis.niveau_experience === "confirme" ? "Confirme" : "Junior"}
                    </span>
                  )}
                  {analysis.titre_poste_cible && (
                    <span className={`rounded-lg px-3 py-1 text-xs font-medium ${
                      isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-700"
                    }`}>
                      {analysis.titre_poste_cible}
                    </span>
                  )}
                </div>
              )}

              {/* CV Quality Score - compact */}
              {analysis.cv_quality_score && (
                <div className={`mt-4 flex items-center gap-3 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  <span>Qualite CV:</span>
                  <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {analysis.cv_quality_score.grade}
                  </span>
                  <div className={`h-2 flex-1 max-w-32 rounded-full overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400"
                      style={{ width: `${analysis.cv_quality_score.total_score}%` }}
                    />
                  </div>
                  <span className="text-xs">{analysis.cv_quality_score.total_score}/100</span>
                </div>
              )}

              {/* Suggested queries */}
              <div className="mt-4">
                <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Requetes IA
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.suggested_queries.length === 0 && (
                    <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Ajoute un CV ou des preferences.
                    </span>
                  )}
                  {analysis.suggested_queries.map((q) => (
                    <span key={q} className={`rounded-lg px-2.5 py-1 text-xs ${
                      isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
                    }`}>{q}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Toggle button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isDark
                  ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{expanded ? "Masquer les details" : "Voir les details"}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              />
            </button>

            {/* Collapsible detailed content */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {/* Left column: Profile details */}
                <div className={`rounded-xl border p-4 ${isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50"}`}>
                  {/* Formation */}
                  {analysis.formation && (
                    <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <FontAwesomeIcon icon={faGraduationCap} className="text-xs" />
                      {analysis.formation}
                    </div>
                  )}

                  {/* CV Quality details */}
                  {analysis.cv_quality_score && (
                    <div className={`mt-4 rounded-lg p-3 ${isDark ? "bg-gray-800/50" : "bg-white border border-gray-200"}`}>
                      <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        {analysis.cv_quality_score.assessment}
                      </p>
                      {analysis.cv_quality_score.strengths && analysis.cv_quality_score.strengths.length > 0 && (
                        <div className="mt-3">
                          <p className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Points forts</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {analysis.cv_quality_score.strengths.slice(0, 3).map((s) => (
                              <span key={s} className={`rounded-lg px-2 py-0.5 text-xs ${
                                isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                              }`}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.cv_quality_score.suggestions && analysis.cv_quality_score.suggestions.length > 0 && (
                        <div className="mt-3">
                          <p className={`text-xs font-medium ${isDark ? "text-amber-400" : "text-amber-600"}`}>A ameliorer</p>
                          <ul className={`mt-1.5 space-y-1 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            {analysis.cv_quality_score.suggestions.slice(0, 2).map((s) => (
                              <li key={s}>- {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sectors */}
                  {analysis.secteurs_cibles && analysis.secteurs_cibles.length > 0 && (
                    <div className="mt-4">
                      <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        <FontAwesomeIcon icon={faBriefcase} className="mr-1.5" />
                        Secteurs cibles
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {analysis.secteurs_cibles.map((s: string) => (
                          <span key={s} className={`rounded-lg px-2.5 py-1 text-xs ${
                            isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
                          }`}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column: Skills */}
                <div className={`rounded-xl border p-4 ${isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50"}`}>
                  {/* Key skills */}
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Competences cles
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {analysis.top_keywords.slice(0, 10).map((kw) => (
                        <span key={kw} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
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
                      <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        <FontAwesomeIcon icon={faLaptopCode} className="mr-1.5" />
                        Techniques
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {analysis.competences_techniques.map((skill: string) => (
                          <span key={skill} className={`rounded-lg px-2.5 py-1 text-xs ${
                            isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-100 text-sky-700"
                          }`}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Soft skills */}
                  {analysis.competences_transversales && analysis.competences_transversales.length > 0 && (
                    <div className="mt-4">
                      <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        <FontAwesomeIcon icon={faHandshake} className="mr-1.5" />
                        Soft skills
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {analysis.competences_transversales.map((skill: string) => (
                          <span key={skill} className={`rounded-lg px-2.5 py-1 text-xs ${
                            isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-100 text-amber-700"
                          }`}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {analysis.langues && analysis.langues.length > 0 && (
                    <div className="mt-4">
                      <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        <FontAwesomeIcon icon={faGlobe} className="mr-1.5" />
                        Langues
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {analysis.langues.map((lang: string) => (
                          <span key={lang} className={`rounded-lg px-2.5 py-1 text-xs ${
                            isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                          }`}>{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Must hits / missing */}
                  {(analysis.must_hits.length > 0 || analysis.missing_must.length > 0) && (
                    <div className="mt-4 grid gap-3 grid-cols-2">
                      <div>
                        <p className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                          <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                          Mots-cles trouves
                        </p>
                        <ul className={`mt-1.5 space-y-0.5 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                          {analysis.must_hits.length === 0 && <li>-</li>}
                          {analysis.must_hits.map((kw) => (
                            <li key={kw}>- {kw}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                          A completer
                        </p>
                        <ul className={`mt-1.5 space-y-0.5 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AIAssistantSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="mt-5">
      <div className={`rounded-xl border p-4 ${isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-gray-50"}`}>
        <div className={`h-4 w-full rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className={`h-4 w-3/4 rounded-lg animate-pulse mt-2 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-7 w-20 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
