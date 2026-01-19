"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHistory,
  faRotate,
  faPlus,
  faCalendarAlt,
  faSearch,
  faDatabase,
} from "@fortawesome/free-solid-svg-icons";
import { JobRun } from "../../lib/api";

interface SearchHistoryProps {
  isDark: boolean;
  runs: JobRun[];
  runsLoading: boolean;
  runsError?: string | null;
  onRefresh: () => void;
}

function formatDate(dateVal: string | Date) {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (Number.isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SearchHistory({
  isDark,
  runs,
  runsLoading,
  runsError,
  onRefresh,
}: SearchHistoryProps) {
  return (
    <div
      className={`
        rounded-2xl border p-5
        ${isDark ? "border-gray-700 bg-[#0f1116]" : "border-gray-200 bg-white"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
            <FontAwesomeIcon icon={faHistory} className={`text-lg ${isDark ? "text-gray-400" : "text-gray-500"}`} />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
              Historique des recherches
            </h2>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Derniers lancements et resultats
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={runsLoading}
          className={`
            inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all
            disabled:opacity-50
            ${isDark
              ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
              : "border border-gray-300 text-gray-700 hover:bg-gray-100"
            }
          `}
        >
          <FontAwesomeIcon icon={faRotate} className={runsLoading ? "animate-spin" : ""} />
          Rafraichir
        </button>
      </div>

      {/* Content */}
      <div className="mt-4 min-h-[150px]">
        {runsError ? (
          <div className={`
            flex flex-col items-center justify-center py-8 text-center rounded-xl
            ${isDark ? "bg-red-900/20 border border-red-800/50" : "bg-red-50 border border-red-200"}
          `}>
            <p className={`text-sm ${isDark ? "text-red-300" : "text-red-600"}`}>{runsError}</p>
            <button
              onClick={onRefresh}
              className={`
                mt-3 text-sm px-4 py-2 rounded-lg transition-all
                ${isDark ? "bg-red-800/50 hover:bg-red-800 text-red-200" : "bg-red-100 hover:bg-red-200 text-red-700"}
              `}
            >
              Réessayer
            </button>
          </div>
        ) : runsLoading && runs.length === 0 ? (
          <SearchHistorySkeleton isDark={isDark} />
        ) : runs.length === 0 ? (
          <div className={`
            flex flex-col items-center justify-center py-8 text-center
            ${isDark ? "text-gray-500" : "text-gray-400"}
          `}>
            <FontAwesomeIcon icon={faHistory} className="text-4xl mb-3" />
            <p className="text-sm">Pas encore d'historique</p>
            <p className="text-xs mt-1">Lancez une recherche IA pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div
                key={run.id}
                className={`
                  rounded-xl border p-4 transition-all hover:scale-[1.01]
                  ${isDark
                    ? "border-gray-800 bg-[#0d1016] hover:border-gray-700"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Date */}
                    <div className={`flex items-center gap-2 text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                      <FontAwesomeIcon icon={faCalendarAlt} className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                      {formatDate(run.created_at)}
                    </div>

                    {/* Queries */}
                    <div className={`mt-2 flex items-start gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <FontAwesomeIcon icon={faSearch} className={`mt-0.5 text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`} />
                      <div className="flex-1">
                        {run.tried_queries && run.tried_queries.length > 0
                          ? run.tried_queries.map((q, i) => (
                              <span key={q}>
                                <span className={isDark ? "text-gray-300" : "text-gray-700"}>{q}</span>
                                {i < run.tried_queries.length - 1 && (
                                  <span className={isDark ? "text-gray-600" : "text-gray-400"}> • </span>
                                )}
                              </span>
                            ))
                          : <span className="italic">Aucune requete</span>
                        }
                      </div>
                    </div>

                    {/* Sources */}
                    {run.sources && Object.keys(run.sources).length > 0 && (
                      <div className={`mt-2 flex items-start gap-2 text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                        <FontAwesomeIcon icon={faDatabase} className={`mt-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(run.sources).map(([source, count]) => (
                            <span
                              key={source}
                              className={`
                                rounded-full px-2 py-0.5
                                ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-600"}
                              `}
                            >
                              {source}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inserted count badge */}
                  <div
                    className={`
                      flex-shrink-0 rounded-xl px-3 py-2 text-center
                      ${run.inserted > 0
                        ? isDark
                          ? "bg-emerald-900/30 border border-emerald-800"
                          : "bg-emerald-50 border border-emerald-200"
                        : isDark
                          ? "bg-gray-800 border border-gray-700"
                          : "bg-gray-100 border border-gray-200"
                      }
                    `}
                  >
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon
                        icon={faPlus}
                        className={`text-xs ${run.inserted > 0
                          ? isDark ? "text-emerald-400" : "text-emerald-600"
                          : isDark ? "text-gray-500" : "text-gray-400"
                        }`}
                      />
                      <span
                        className={`text-lg font-bold ${run.inserted > 0
                          ? isDark ? "text-emerald-400" : "text-emerald-600"
                          : isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {run.inserted}
                      </span>
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      offres
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchHistorySkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={`
            rounded-xl border p-4
            ${isDark ? "border-gray-800 bg-[#0d1016]" : "border-gray-100 bg-gray-50"}
          `}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-32 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
              <div className={`h-3 w-48 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
              <div className={`h-3 w-40 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
            </div>
            <div className={`h-14 w-16 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
