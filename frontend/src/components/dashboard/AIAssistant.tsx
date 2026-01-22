"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRotate,
  faSearch,
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
            Recherche IA
          </h2>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Basée sur ton CV et tes préférences
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
            Actualiser
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
      {analysisLoading && !analysis && (
        <div className="mt-4 space-y-2">
          <div className={`h-4 w-full rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-4 w-3/4 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
      )}

      {/* Content */}
      {analysis && (
        <div className="mt-4 space-y-4">
          {/* Summary */}
          <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            {analysis.summary}
          </p>

          {/* Keywords */}
          {analysis.top_keywords.length > 0 && (
            <div>
              <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Compétences détectées
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.top_keywords.slice(0, 8).map((kw) => (
                  <span
                    key={kw}
                    className={`rounded px-2 py-0.5 text-xs ${
                      isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested queries */}
          {analysis.suggested_queries.length > 0 && (
            <div>
              <p className={`text-xs font-medium uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Requêtes suggérées
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.suggested_queries.map((q) => (
                  <span
                    key={q}
                    className={`rounded px-2 py-0.5 text-xs ${
                      isDark ? "bg-blue-900/30 text-blue-300" : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CV Quality */}
          {analysis.cv_quality_score && (
            <div className={`rounded-md p-3 ${isDark ? "bg-gray-800/50" : "bg-gray-50"}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Qualité CV
                </span>
                <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                  {analysis.cv_quality_score.grade} ({analysis.cv_quality_score.total_score}/100)
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
