"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar as faStarSolid,
  faTrash,
  faExternalLink,
  faBuilding,
  faLocationDot,
  faGlobe,
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
  const getScoreStyle = (score: number | null) => {
    if (score === null) return isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400";
    if (score >= 8) return isDark ? "bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-700" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200";
    if (score >= 6) return isDark ? "bg-amber-900/50 text-amber-400 ring-1 ring-amber-700" : "bg-amber-50 text-amber-600 ring-1 ring-amber-200";
    return isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500";
  };

  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all hover:shadow-md ${
        isDark
          ? "border-gray-800 bg-[#0d1117] hover:border-gray-700"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* New badge - positioned top right */}
      {isNew && (
        <div className="absolute -top-2 -right-2">
          <span className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            Nouveau
          </span>
        </div>
      )}

      {/* Score - top right corner inside card */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`font-semibold leading-tight line-clamp-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            {match.title}
          </h3>

          {/* Company & Location */}
          <div className={`mt-2 space-y-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {match.company && (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faBuilding} className="text-xs w-3" />
                <span className="truncate">{match.company}</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              {match.location && (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faLocationDot} className="text-xs w-3" />
                  <span className="truncate">{match.location}</span>
                </div>
              )}
              {match.source && (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faGlobe} className="text-xs w-3" />
                  <span>{match.source}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score badge */}
        <div className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center ${getScoreStyle(match.score)}`}>
          <div className="text-lg font-bold leading-none">{match.score ?? "-"}</div>
          <div className="text-[10px] uppercase tracking-wide opacity-80">/10</div>
        </div>
      </div>

      {/* Match reasons */}
      {match.match_reasons && match.match_reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {match.match_reasons.slice(0, 4).map((reason) => (
            <span
              key={reason}
              className={`rounded-md px-2 py-0.5 text-xs ${
                isDark
                  ? "bg-blue-900/30 text-blue-300 ring-1 ring-blue-800"
                  : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
              }`}
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={`mt-4 pt-3 flex items-center justify-between border-t ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <a
          href={match.url}
          target="_blank"
          rel="noreferrer"
          onClick={onVisit}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <FontAwesomeIcon icon={faExternalLink} className="text-xs" />
          Voir l'offre
        </a>

        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 ${
              isSaved
                ? isDark
                  ? "bg-amber-900/40 text-amber-400"
                  : "bg-amber-100 text-amber-600"
                : isDark
                  ? "text-gray-500 hover:text-amber-400 hover:bg-gray-800"
                  : "text-gray-400 hover:text-amber-500 hover:bg-gray-100"
            }`}
            title={isSaved ? "Retirer des favoris" : "Sauvegarder"}
          >
            <FontAwesomeIcon icon={(isSaved ? faStarSolid : faStarRegular) as any} />
          </button>

          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 ${
              isDark
                ? "text-gray-500 hover:text-red-400 hover:bg-gray-800"
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
    <div className={`rounded-xl border p-4 ${isDark ? "border-gray-800 bg-[#0d1117]" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className={`h-5 w-3/4 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`mt-3 h-4 w-1/2 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`mt-2 h-4 w-2/3 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
        <div className={`h-12 w-12 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
      </div>
      <div className={`mt-4 pt-3 border-t flex items-center justify-between ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <div className={`h-9 w-28 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="flex gap-1">
          <div className={`h-9 w-9 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-9 w-9 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
      </div>
    </div>
  );
}
