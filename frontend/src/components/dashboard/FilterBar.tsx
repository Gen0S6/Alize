"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faTableCells,
  faList,
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
  const inputClass = `w-full rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-1 ${
    isDark
      ? "border-gray-700 bg-[#0a0b0f] text-gray-100 focus:border-sky-500 focus:ring-sky-500"
      : "border-gray-300 bg-white text-gray-900 focus:border-sky-500 focus:ring-sky-500"
  }`;

  const selectClass = `rounded-md border py-2 px-3 text-sm focus:outline-none focus:ring-1 ${
    isDark
      ? "border-gray-700 bg-[#0a0b0f] text-gray-100 focus:border-sky-500 focus:ring-sky-500"
      : "border-gray-300 bg-white text-gray-900 focus:border-sky-500 focus:ring-sky-500"
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
            className={`${inputClass} pl-9`}
            placeholder="Rechercher..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        {/* Score min */}
        <div className="w-24">
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
        <div className={`flex rounded-md border ${isDark ? "border-gray-700" : "border-gray-300"}`}>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 ${
              viewMode === "grid"
                ? "bg-sky-600 text-white"
                : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <FontAwesomeIcon icon={faTableCells} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-2 ${
              viewMode === "table"
                ? "bg-sky-600 text-white"
                : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <FontAwesomeIcon icon={faList} />
          </button>
        </div>
      </div>

      {/* Second row: Toggles and count */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Saved only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={savedOnly}
              onChange={(e) => setSavedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Sauvegardées {savedCount > 0 && `(${savedCount})`}
            </span>
          </label>

          {/* New only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newOnly}
              onChange={(e) => setNewOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Nouveautés uniquement {newCount > 0 && `(${newCount})`}
            </span>
          </label>
        </div>

        {/* Results count */}
        <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          {isLoading && (
            <svg className="h-4 w-4 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {currentCount} sur {totalMatches}
        </div>
      </div>
    </div>
  );
}
