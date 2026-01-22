"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar as faStarSolid,
  faTrash,
  faExternalLink,
  faBuilding,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import { Match } from "../../lib/api";

interface JobCardProps {
  match: Match;
  isDark: boolean;
  isNew: boolean;
  isSaved: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: () => void;
  onDelete: () => void;
  onVisit: () => void;
}

export function JobCard({
  match,
  isDark,
  isNew,
  isSaved,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onVisit,
}: JobCardProps) {
  const getScoreColor = (score: number | null) => {
    if (score === null) return isDark ? "text-gray-500" : "text-gray-400";
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-amber-600";
    return "text-gray-500";
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        isDark ? "border-gray-800 bg-[#0a0b0f]" : "border-gray-200 bg-white"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              {match.title}
            </h3>
            {isNew && (
              <span className="flex-shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                Nouveau
              </span>
            )}
          </div>
          <div className={`mt-1 flex items-center gap-3 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {match.company && (
              <span className="flex items-center gap-1">
                <FontAwesomeIcon icon={faBuilding} className="text-xs" />
                {match.company}
              </span>
            )}
            {match.location && (
              <span className="flex items-center gap-1">
                <FontAwesomeIcon icon={faLocationDot} className="text-xs" />
                {match.location}
              </span>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 text-lg font-semibold ${getScoreColor(match.score)}`}>
          {match.score ?? "-"}/10
        </div>
      </div>

      {/* Match reasons */}
      {match.match_reasons && match.match_reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {match.match_reasons.slice(0, 3).map((reason) => (
            <span
              key={reason}
              className={`rounded px-2 py-0.5 text-xs ${
                isDark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
              }`}
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between">
        <a
          href={match.url}
          target="_blank"
          rel="noreferrer"
          onClick={onVisit}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <FontAwesomeIcon icon={faExternalLink} className="text-xs" />
          Voir l'offre
        </a>

        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`p-2 rounded-md transition-colors disabled:opacity-50 ${
              isSaved
                ? "text-amber-500 hover:bg-amber-50"
                : isDark
                  ? "text-gray-500 hover:text-amber-500 hover:bg-gray-800"
                  : "text-gray-400 hover:text-amber-500 hover:bg-gray-100"
            }`}
            title={isSaved ? "Retirer des favoris" : "Sauvegarder"}
          >
            <FontAwesomeIcon icon={(isSaved ? faStarSolid : faStarRegular) as any} />
          </button>

          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={`p-2 rounded-md transition-colors disabled:opacity-50 ${
              isDark
                ? "text-gray-500 hover:text-red-500 hover:bg-gray-800"
                : "text-gray-400 hover:text-red-500 hover:bg-gray-100"
            }`}
            title="Supprimer"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function JobCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${isDark ? "border-gray-800 bg-[#0a0b0f]" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className={`h-5 w-3/4 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`mt-2 h-4 w-1/2 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
        <div className={`h-6 w-12 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className={`h-8 w-24 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="flex gap-1">
          <div className={`h-8 w-8 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-8 w-8 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
      </div>
    </div>
  );
}
