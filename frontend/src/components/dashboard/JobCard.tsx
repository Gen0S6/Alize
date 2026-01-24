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
    if (score >= 8) return isDark ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200";
    if (score >= 6) return isDark ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-amber-50 text-amber-600 ring-1 ring-amber-200";
    return isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500";
  };

  return (
    <div
      className={`group relative rounded-xl border p-5 transition-all duration-200 hover:shadow-lg ${
        isDark
          ? "border-gray-800 bg-[#0d1117] hover:border-gray-700 hover:bg-[#0f1419]"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-gray-100"
      }`}
    >
      {/* New badge - floating top right */}
      {isNew && (
        <div className="absolute -top-2.5 -right-2.5 z-10">
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25">
            Nouveau
          </span>
        </div>
      )}

      {/* Header: Title + Score */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold leading-snug line-clamp-2 group-hover:text-sky-500 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>
            {match.title}
          </h3>

          {/* Company & Location */}
          <div className={`mt-3 space-y-1.5 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {match.company && (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faBuilding} className="text-xs w-4 opacity-60" />
                <span className="truncate">{match.company}</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              {match.location && (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faLocationDot} className="text-xs w-4 opacity-60" />
                  <span className="truncate">{match.location}</span>
                </div>
              )}
              {match.source && (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faGlobe} className="text-xs w-4 opacity-60" />
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                  }`}>
                    {match.source}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score badge */}
        <div className={`flex-shrink-0 rounded-xl px-3 py-2 text-center min-w-[52px] ${getScoreStyle(match.score)}`}>
          <div className="text-xl font-bold leading-none">{match.score ?? "-"}</div>
          <div className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">/10</div>
        </div>
      </div>

      {/* Match reasons */}
      {match.match_reasons && match.match_reasons.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {match.match_reasons.slice(0, 4).map((reason) => (
            <span
              key={reason}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                isDark
                  ? "bg-sky-500/10 text-sky-400"
                  : "bg-sky-50 text-sky-700"
              }`}
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={`mt-4 pt-4 flex items-center justify-between border-t ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <a
          href={match.url}
          target="_blank"
          rel="noreferrer"
          onClick={onVisit}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-sky-600 hover:shadow-md hover:shadow-sky-500/25"
        >
          <FontAwesomeIcon icon={faExternalLink} className="text-xs" />
          Voir l'offre
        </a>

        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 ${
              isSaved
                ? isDark
                  ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
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
            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 ${
              isDark
                ? "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
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
    <div className={`rounded-xl border p-5 ${isDark ? "border-gray-800 bg-[#0d1117]" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className={`h-5 w-3/4 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`mt-4 h-4 w-1/2 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`mt-2 h-4 w-2/3 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
        <div className={`h-14 w-14 rounded-xl animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
      </div>
      <div className={`mt-4 pt-4 border-t flex items-center justify-between ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <div className={`h-10 w-28 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="flex gap-1">
          <div className={`h-10 w-10 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-10 w-10 rounded-lg animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />
        </div>
      </div>
    </div>
  );
}
