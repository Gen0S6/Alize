"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHistory, faRotate, faSearch, faDatabase, faPlus } from "@fortawesome/free-solid-svg-icons";
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
    <div className={`rounded-lg border p-4 ${isDark ? "border-gray-800 bg-[#0a0b0f]" : "border-gray-200 bg-white"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faHistory} className={isDark ? "text-gray-400" : "text-gray-500"} />
          <h2 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
            Historique des recherches
          </h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={runsLoading}
          className={`p-2 rounded-md transition-colors disabled:opacity-50 ${
            isDark ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <FontAwesomeIcon icon={faRotate} className={runsLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {runsError ? (
          <div className={`rounded-md p-3 ${isDark ? "bg-red-900/20 text-red-300" : "bg-red-50 text-red-600"}`}>
            <p className="text-sm">{runsError}</p>
            <button
              onClick={onRefresh}
              className={`mt-2 text-xs px-3 py-1 rounded ${
                isDark ? "bg-red-900/50 hover:bg-red-900 text-red-200" : "bg-red-100 hover:bg-red-200 text-red-700"
              }`}
            >
              Réessayer
            </button>
          </div>
        ) : runsLoading && runs.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-16 rounded-md animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-100"}`} />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <FontAwesomeIcon icon={faHistory} className="text-3xl mb-2" />
            <p className="text-sm">Pas encore d'historique</p>
            <p className="text-xs mt-1">Lancez une recherche IA pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div
                key={run.id}
                className={`rounded-md border p-3 ${
                  isDark ? "border-gray-800 bg-[#0d1016]" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Date */}
                    <p className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                      {formatDate(run.created_at)}
                    </p>

                    {/* Queries */}
                    <div className={`mt-1 flex items-start gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <FontAwesomeIcon icon={faSearch} className="mt-0.5 text-xs" />
                      <span className="truncate">
                        {run.tried_queries && run.tried_queries.length > 0
                          ? run.tried_queries.join(" • ")
                          : "Aucune requête"}
                      </span>
                    </div>

                    {/* Sources */}
                    {run.sources && Object.keys(run.sources).length > 0 && (
                      <div className={`mt-2 flex items-center gap-2 text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                        <FontAwesomeIcon icon={faDatabase} />
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(run.sources).map(([source, count]) => (
                            <span
                              key={source}
                              className={`rounded px-1.5 py-0.5 ${
                                isDark ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-600"
                              }`}
                            >
                              {source}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inserted count */}
                  <div
                    className={`flex-shrink-0 rounded-md px-3 py-2 text-center ${
                      run.inserted > 0
                        ? isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                        : isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <FontAwesomeIcon icon={faPlus} className="text-xs" />
                      <span className="text-lg font-semibold">{run.inserted}</span>
                    </div>
                    <div className="text-[10px]">offres</div>
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
