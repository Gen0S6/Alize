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
  const scoreColor = (score: number | null) => {
    if (score === null) return isDark ? "text-gray-500" : "text-gray-400";
    if (score >= 8) return "text-emerald-500";
    if (score >= 6) return "text-amber-500";
    return "text-red-500";
  };

  const scoreBgColor = (score: number | null) => {
    if (score === null) return isDark ? "bg-gray-800" : "bg-gray-100";
    if (score >= 8) return isDark ? "bg-emerald-900/30" : "bg-emerald-50";
    if (score >= 6) return isDark ? "bg-amber-900/30" : "bg-amber-50";
    return isDark ? "bg-red-900/30" : "bg-red-50";
  };

  return (
    <div
      className={`
        group relative rounded-2xl border p-4 transition-all duration-300
        hover:shadow-lg hover:scale-[1.01]
        ${isDark
          ? "border-gray-700 bg-[#0f1116] hover:border-gray-600 hover:shadow-black/30"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-gray-200"
        }
      `}
    >
      {/* New badge */}
      {isNew && (
        <div className="absolute -right-2 -top-2 z-10">
          <span className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
            Nouveau
          </span>
        </div>
      )}

      {/* Header with title and score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${isDark ? "text-gray-100" : "text-gray-900"}`}>
            {match.title}
          </h3>
        </div>
        <div
          className={`
            flex-shrink-0 rounded-xl px-3 py-1.5 text-center
            ${scoreBgColor(match.score)}
          `}
        >
          <span className={`text-lg font-bold ${scoreColor(match.score)}`}>
            {match.score ?? "-"}
          </span>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>/10</span>
        </div>
      </div>

      {/* Company and location */}
      <div className="mt-3 space-y-2">
        {match.company && (
          <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            <FontAwesomeIcon icon={faBuilding} className="w-4 text-gray-500" />
            <span className="truncate">{match.company}</span>
          </div>
        )}
        {match.location && (
          <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            <FontAwesomeIcon icon={faLocationDot} className="w-4 text-gray-500" />
            <span className="truncate">{match.location}</span>
          </div>
        )}
        {match.source && (
          <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            <FontAwesomeIcon icon={faGlobe} className="w-4 text-gray-500" />
            <span className="truncate">{match.source}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between">
        <a
          href={match.url}
          target="_blank"
          rel="noreferrer"
          onClick={onVisit}
          className={`
            inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all
            ${isDark
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "bg-blue-600 text-white hover:bg-blue-700"
            }
          `}
        >
          <FontAwesomeIcon icon={faExternalLink} className="text-xs" />
          Voir l'offre
        </a>

        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`
              inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all
              disabled:opacity-50
              ${isSaved
                ? isDark
                  ? "bg-amber-900/40 text-amber-400 hover:bg-amber-900/60"
                  : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                : isDark
                  ? "text-gray-500 hover:bg-gray-800 hover:text-amber-400"
                  : "text-gray-400 hover:bg-gray-100 hover:text-amber-500"
              }
            `}
            title={isSaved ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <FontAwesomeIcon icon={(isSaved ? faStarSolid : faStarRegular) as any} />
          </button>

          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={`
              inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all
              disabled:opacity-50
              ${isDark
                ? "text-gray-500 hover:bg-red-900/40 hover:text-red-400"
                : "text-gray-400 hover:bg-red-100 hover:text-red-500"
              }
            `}
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
    <div
      className={`
        rounded-2xl border p-4
        ${isDark ? "border-gray-700 bg-[#0f1116]" : "border-gray-200 bg-white"}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`h-5 w-3/4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className={`h-10 w-14 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      </div>
      <div className="mt-3 space-y-2">
        <div className={`h-4 w-1/2 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className={`h-4 w-1/3 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className={`h-10 w-28 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <div className="flex gap-1">
          <div className={`h-10 w-10 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <div className={`h-10 w-10 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
      </div>
    </div>
  );
}
