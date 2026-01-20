"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faTableCells,
  faList,
  faBolt,
  faStar,
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
}: FilterBarProps) {
  return (
    <div className="space-y-4">
      {/* Search and main filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {/* Search input */}
        <div className="md:col-span-5">
          <label className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Recherche
          </label>
          <div className="relative mt-1">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
            />
            <input
              className={`
                w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm transition-all
                focus:outline-none focus:ring-2
                ${isDark
                  ? "border-gray-700 bg-[#0d1016] text-gray-100 placeholder-gray-500 focus:border-blue-600 focus:ring-blue-600/20"
                  : "border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                }
              `}
              placeholder="Titre, entreprise, localisation..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>

        {/* Score min */}
        <div className="md:col-span-2">
          <label className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Score min
          </label>
          <input
            className={`
              mt-1 w-full rounded-xl border py-2.5 px-3 text-sm transition-all
              focus:outline-none focus:ring-2
              ${isDark
                ? "border-gray-700 bg-[#0d1016] text-gray-100 focus:border-blue-600 focus:ring-blue-600/20"
                : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500/20"
              }
            `}
            type="number"
            min={0}
            max={10}
            value={minScore}
            onChange={(e) => {
              const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
              setMinScore(val);
            }}
          />
        </div>

        {/* Source filter */}
        <div className="md:col-span-3">
          <label className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Source
          </label>
          <div className="relative mt-1">
            <FontAwesomeIcon
              icon={faFilter}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
            />
            <select
              className={`
                w-full appearance-none rounded-xl border py-2.5 pl-10 pr-8 text-sm transition-all
                focus:outline-none focus:ring-2
                ${isDark
                  ? "border-gray-700 bg-[#0d1016] text-gray-100 focus:border-blue-600 focus:ring-blue-600/20"
                  : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500/20"
                }
              `}
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">Toutes les sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="md:col-span-2">
          <label className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Affichage
          </label>
          <div className={`mt-1 flex rounded-xl border p-1 ${isDark ? "border-gray-700 bg-[#0d1016]" : "border-gray-200 bg-white"}`}>
            <button
              onClick={() => setViewMode("grid")}
              className={`
                flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition-all
                ${viewMode === "grid"
                  ? isDark
                    ? "bg-blue-600 text-white"
                    : "bg-blue-600 text-white"
                  : isDark
                    ? "text-gray-400 hover:text-gray-200"
                    : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              <FontAwesomeIcon icon={faTableCells} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`
                flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition-all
                ${viewMode === "table"
                  ? isDark
                    ? "bg-blue-600 text-white"
                    : "bg-blue-600 text-white"
                  : isDark
                    ? "text-gray-400 hover:text-gray-200"
                    : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              <FontAwesomeIcon icon={faList} />
            </button>
          </div>
        </div>
      </div>

      {/* Second row: Sort and new only toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <label className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Trier par
            </label>
            <select
              className={`
                rounded-xl border py-2 px-3 text-sm transition-all
                focus:outline-none focus:ring-2
                ${isDark
                  ? "border-gray-700 bg-[#0d1016] text-gray-100 focus:border-blue-600 focus:ring-blue-600/20"
                  : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500/20"
                }
              `}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="new_first">Nouveautes d'abord</option>
              <option value="newest">Plus recentes</option>
              <option value="score">Meilleur score</option>
            </select>
          </div>

          {/* Saved only toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <div className="relative">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(e) => setSavedOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`
                h-6 w-11 rounded-full transition-all peer-focus:ring-2
                ${isDark
                  ? "bg-gray-700 peer-checked:bg-amber-500 peer-focus:ring-amber-500/20"
                  : "bg-gray-200 peer-checked:bg-amber-400 peer-focus:ring-amber-400/20"
                }
              `} />
              <div className={`
                absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform
                peer-checked:translate-x-5
              `} />
            </div>
            <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Sauvegardées
            </span>
            {savedCount > 0 && (
              <span className={`
                inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold
                ${isDark
                  ? "bg-amber-900/40 text-amber-300 border border-amber-700/60"
                  : "bg-amber-100 text-amber-700"
                }
              `}>
                <FontAwesomeIcon icon={faStar} className="text-[10px]" />
                {savedCount}
              </span>
            )}
          </label>

          {/* New only toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <div className="relative">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => setNewOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`
                h-6 w-11 rounded-full transition-all peer-focus:ring-2
                ${isDark
                  ? "bg-gray-700 peer-checked:bg-emerald-600 peer-focus:ring-emerald-600/20"
                  : "bg-gray-200 peer-checked:bg-emerald-500 peer-focus:ring-emerald-500/20"
                }
              `} />
              <div className={`
                absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform
                peer-checked:translate-x-5
              `} />
            </div>
            <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Nouveautes uniquement
            </span>
            {newCount > 0 && (
              <span className={`
                inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold
                ${isDark
                  ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/60"
                  : "bg-emerald-100 text-emerald-700"
                }
              `}>
                <FontAwesomeIcon icon={faBolt} className="text-[10px]" />
                {newCount}
              </span>
            )}
          </label>
        </div>

        {/* Results count */}
        <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          <span className="font-medium">{currentCount}</span> resultats sur{" "}
          <span className="font-medium">{totalMatches}</span> (page {page})
        </div>
      </div>
    </div>
  );
}
