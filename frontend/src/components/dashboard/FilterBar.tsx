"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faTableCells,
  faList,
  faStar,
  faBolt,
} from "@fortawesome/free-solid-svg-icons";
import { SortOption } from "../../lib/api";

interface FilterBarProps {
  isDark: boolean;
  filterText: string;
  setFilterText: (v: string) => void;
  minScore: number;
  setMinScore: (v: number) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  newOnly: boolean;
  setNewOnly: (v: boolean) => void;
  savedOnly: boolean;
  setSavedOnly: (v: boolean) => void;
  sources: string[];
  newCount: number;
  savedCount: number;
  viewMode: "grid" | "table";
  setViewMode: (v: "grid" | "table") => void;
  totalMatches: number;
  currentCount: number;
  page: number;
  isLoading: boolean;
}

export function FilterBar({
  isDark,
  filterText,
  setFilterText,
  minScore,
  setMinScore,
  sourceFilter,
  setSourceFilter,
  sortBy,
  setSortBy,
  newOnly,
  setNewOnly,
  savedOnly,
  setSavedOnly,
  sources,
  newCount,
  savedCount,
  viewMode,
  setViewMode,
  totalMatches,
  currentCount,
  page,
  isLoading,
}: FilterBarProps) {
  const inputClass = `w-full rounded-lg border py-2.5 px-3 text-sm transition-all focus:outline-none focus:ring-2 ${
    isDark
      ? "border-gray-700 bg-gray-800/50 text-gray-100 placeholder-gray-500 focus:border-sky-500 focus:ring-sky-500/20"
      : "border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500/20"
  }`;

  const selectClass = `rounded-lg border py-2.5 px-3 text-sm transition-all focus:outline-none focus:ring-2 cursor-pointer ${
    isDark
      ? "border-gray-700 bg-gray-800/50 text-gray-100 focus:border-sky-500 focus:ring-sky-500/20"
      : "border-gray-200 bg-gray-50 text-gray-900 focus:border-sky-500 focus:ring-sky-500/20"
  }`;

  return (
    <div className="space-y-4">
      {/* First row: Search and filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <FontAwesomeIcon
            icon={faSearch}
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
              isDark ? "text-gray-500" : "text-gray-400"
            }`}
          />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Rechercher une offre..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        {/* Score min */}
        <div className="w-28">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={10}
            placeholder="Score min"
            value={minScore || ""}
            onChange={(e) => {
              const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
              setMinScore(val);
            }}
          />
        </div>

        {/* Source */}
        <select
          className={selectClass}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">Toutes sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          className={selectClass}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="new_first">Nouveautés d'abord</option>
          <option value="newest">Plus récentes</option>
          <option value="score">Meilleur score</option>
        </select>

        {/* View toggle */}
        <div className={`flex rounded-lg border overflow-hidden ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3.5 py-2.5 transition-all ${
              viewMode === "grid"
                ? "bg-sky-500 text-white"
                : isDark
                  ? "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700"
                  : "bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
            title="Vue grille"
          >
            <FontAwesomeIcon icon={faTableCells} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3.5 py-2.5 transition-all border-l ${
              isDark ? "border-gray-700" : "border-gray-200"
            } ${
              viewMode === "table"
                ? "bg-sky-500 text-white"
                : isDark
                  ? "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700"
                  : "bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
            title="Vue liste"
          >
            <FontAwesomeIcon icon={faList} />
          </button>
        </div>
      </div>

      {/* Second row: Toggles and count */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Saved only toggle */}
          <button
            onClick={() => setSavedOnly(!savedOnly)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              savedOnly
                ? "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30"
                : isDark
                  ? "text-gray-400 hover:text-amber-400 hover:bg-gray-800"
                  : "text-gray-500 hover:text-amber-600 hover:bg-gray-100"
            }`}
          >
            <FontAwesomeIcon icon={faStar} className="text-xs" />
            <span>Sauvegardées</span>
            {savedCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                savedOnly
                  ? "bg-amber-500/30"
                  : isDark ? "bg-gray-800" : "bg-gray-200"
              }`}>
                {savedCount}
              </span>
            )}
          </button>

          {/* New only toggle */}
          <button
            onClick={() => setNewOnly(!newOnly)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              newOnly
                ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/30"
                : isDark
                  ? "text-gray-400 hover:text-emerald-400 hover:bg-gray-800"
                  : "text-gray-500 hover:text-emerald-600 hover:bg-gray-100"
            }`}
          >
            <FontAwesomeIcon icon={faBolt} className="text-xs" />
            <span>Nouveautés</span>
            {newCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                newOnly
                  ? "bg-emerald-500/30"
                  : isDark ? "bg-gray-800" : "bg-gray-200"
              }`}>
                {newCount}
              </span>
            )}
          </button>
        </div>

        {/* Results count */}
        <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {isLoading && (
            <svg className="h-4 w-4 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{currentCount}</span>
          <span>sur</span>
          <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{totalMatches}</span>
          <span>offres</span>
        </div>
      </div>
    </div>
  );
}
