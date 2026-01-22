"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHistory, faRotate } from "@fortawesome/free-solid-svg-icons";
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
        <h2 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
          Historique
        </h2>
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
      <div className="mt-3">
        {runsError ? (
          <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>{runsError}</p>
        ) : runsLoading && runs.length === 0 ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className={`h-12 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-100"}`} />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className={`text-center py-6 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <FontAwesomeIcon icon={faHistory} className="text-2xl mb-2" />
            <p className="text-sm">Pas encore d'historique</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className={`flex items-center justify-between p-2 rounded-md ${
                  isDark ? "bg-gray-800/50" : "bg-gray-50"
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-sm truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {run.tried_queries?.join(", ") || "Recherche"}
                  </p>
                  <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    {formatDate(run.created_at)}
                  </p>
                </div>
                <span className={`flex-shrink-0 ml-2 text-sm font-medium ${
                  run.inserted > 0
                    ? "text-green-600"
                    : isDark ? "text-gray-500" : "text-gray-400"
                }`}>
                  +{run.inserted}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
