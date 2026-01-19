"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBriefcase,
  faEye,
  faStar,
  faBolt,
  faSliders,
  faFileLines,
  faUser,
  faChevronLeft,
  faChevronRight,
  faBuilding,
  faLocationDot,
  faGlobe,
  faExternalLink,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import { getToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";
import { useToast } from "../../components/Toast";
import {
  StatCard,
  StatCardSkeleton,
  JobCard,
  JobCardSkeleton,
  FilterBar,
  AIAssistant,
  SearchHistory,
} from "../../components/dashboard";
import {
  getAnalysis,
  getMatches,
  deleteMatch,
  runJobSearch,
  getJobRuns,
  markMatchVisited,
  saveMatch,
  unsaveMatch,
  getDashboardStats,
  type Analysis,
  type JobSearchResult,
  type Match,
  type MatchesPage,
  type JobRun,
  type SortOption,
  type DashboardStats,
} from "../../lib/api";

const VISITED_STORAGE_KEY = "visitedMatches";
const FILTERS_STORAGE_KEY = "dashboardFilters";
const VIEW_MODE_STORAGE_KEY = "dashboardViewMode";

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { addToast } = useToast();
  const [matchesPage, setMatchesPage] = useState<MatchesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<JobSearchResult | null>(null);
  const [filterText, setFilterText] = useState("");
  const [minScore, setMinScore] = useState<number>(0);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("new_first");
  const [newOnly, setNewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [visitedMatches, setVisitedMatches] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Match | null>(null);
  const autoSearched = useRef(false);
  const initialized = useRef(false);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [savedJobs, setSavedJobs] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  async function load(p = page, ft = filterText, ms = minScore, sf = sourceFilter, sb = sortBy, no = newOnly, retryCount = 0) {
    setError(null);
    setLoading(true);
    setPage(p);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const data = await getMatches(p, pageSize, ft, ms, sf, sb, no);
      setMatchesPage(data);
      setPage(data.page);
    } catch (err: any) {
      // Retry on network/fetch errors (up to 2 times)
      if (retryCount < 2 && (err?.message?.includes("fetch") || err?.message?.includes("network") || err?.message?.includes("Failed to fetch"))) {
        setTimeout(() => load(p, ft, ms, sf, sb, no, retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      const message =
        err?.message === "Not authenticated"
          ? "Session expirée. Reconnecte-toi."
          : err?.message ?? "Impossible de charger les offres";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalysis(force = false, retryCount = 0) {
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const data = await getAnalysis(force);
      setAnalysis(data);
    } catch (err: any) {
      // Retry on network/fetch errors (up to 2 times)
      if (retryCount < 2 && (err?.message?.includes("fetch") || err?.message?.includes("network") || err?.message?.includes("Failed to fetch"))) {
        setTimeout(() => loadAnalysis(force, retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      const message =
        err?.message === "Not authenticated"
          ? "Session expirée. Reconnecte-toi."
          : err?.message ?? "Impossible de charger l'analyse";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function launchSearch() {
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await runJobSearch();
      setSearchResult(res);
      if (res.inserted > 0) {
        addToast(`${res.inserted} nouvelles offres trouvees !`, "success");
      } else {
        addToast("Recherche terminee - aucune nouvelle offre", "info");
      }
      await load(1);
      await loadRuns();
      await loadStats();
    } catch (err: any) {
      const message =
        err?.message === "Not authenticated"
          ? "Session expiree. Reconnecte-toi."
          : err?.message ?? "Impossible de lancer la recherche IA";
      addToast(message, "error");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    // Prevent duplicate initialization
    if (initialized.current) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    initialized.current = true;

    // Load all data in parallel with individual error handling
    Promise.allSettled([
      load(1, filterText, minScore, sourceFilter, sortBy, newOnly),
      loadAnalysis(),
      loadRuns(),
      loadStats(),
    ]).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Dashboard load error (${index}):`, result.reason);
        }
      });
    });
  }, [router]);

  // Only reload matches when filters change (not on initial mount)
  const filtersInitialized = useRef(false);
  useEffect(() => {
    if (!filtersInitialized.current) {
      filtersInitialized.current = true;
      return;
    }
    load(1, filterText, minScore, sourceFilter, sortBy, newOnly);
  }, [filterText, minScore, sourceFilter, sortBy, newOnly]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setVisitedMatches(new Set(parsed));
        }
      }
    } catch (_err) {}
    try {
      const rawFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters);
        setFilterText(parsed.filterText ?? "");
        setMinScore(typeof parsed.minScore === "number" ? parsed.minScore : 0);
        setSourceFilter(parsed.sourceFilter ?? "all");
        setSortBy(parsed.sortBy ?? "new_first");
        setNewOnly(parsed.newOnly ?? false);
      }
    } catch (_err) {}
    try {
      const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (savedViewMode === "grid" || savedViewMode === "table") {
        setViewMode(savedViewMode);
      }
    } catch (_err) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ filterText, minScore, sourceFilter, sortBy, newOnly })
      );
    } catch (_err) {}
  }, [filterText, minScore, sourceFilter, sortBy, newOnly]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (_err) {}
  }, [viewMode]);

  function requestDelete(match?: Match) {
    if (!match?.id) return;
    setConfirmTarget(match);
  }

  useEffect(() => {
    if (!confirmTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmTarget(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!deleting && confirmTarget) {
          confirmDelete(confirmTarget.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmTarget, deleting]);

  async function confirmDelete(id?: number) {
    if (!id) return;
    setDeleting(id);
    try {
      await deleteMatch(id);
      setMatchesPage((prev) =>
        prev ? { ...prev, items: prev.items.filter((m) => m.id !== id), total: Math.max(0, prev.total - 1) } : prev
      );
      await loadStats();
      addToast("Offre supprimee avec succes", "success");
    } catch (err: any) {
      addToast(err?.message ?? "Impossible de supprimer l'offre.", "error");
    } finally {
      setDeleting(null);
      setConfirmTarget(null);
    }
  }

  async function markVisited(url: string, id?: number) {
    setVisitedMatches((prev) => {
      const next = new Set(prev);
      next.add(url);
      try {
        localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (_err) {}
      return next;
    });
    if (id) {
      try {
        await markMatchVisited(id);
        await loadStats();
      } catch (_err) {}
    }
  }

  const matches = matchesPage?.items ?? [];
  const sources =
    (matchesPage?.available_sources && matchesPage.available_sources.length > 0
      ? matchesPage.available_sources
      : Array.from(new Set((matchesPage?.items ?? []).map((m) => m.source).filter(Boolean)))) as string[];
  const totalMatches = matchesPage?.total ?? 0;
  const newOffers = matches.filter((m) => m.is_new && !visitedMatches.has(m.url));

  async function loadRuns(retryCount = 0) {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const data = await getJobRuns();
      setRuns(data);
    } catch (err: any) {
      // Retry on network errors (up to 2 times)
      if (retryCount < 2 && (err?.message?.includes("fetch") || err?.message?.includes("network"))) {
        setTimeout(() => loadRuns(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      const message = err?.message === "Not authenticated"
        ? "Session expirée"
        : "Impossible de charger l'historique";
      setRunsError(message);
    } finally {
      setRunsLoading(false);
    }
  }

  async function loadStats(retryCount = 0) {
    setStatsError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      // Retry on network errors (up to 2 times)
      if (retryCount < 2 && (err?.message?.includes("fetch") || err?.message?.includes("network"))) {
        setTimeout(() => loadStats(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      const message = err?.message === "Not authenticated"
        ? "Session expirée"
        : "Impossible de charger les statistiques";
      setStatsError(message);
    }
  }

  async function toggleSaveJob(id: number) {
    if (!id) return;
    setSaving(id);
    try {
      if (savedJobs.has(id)) {
        await unsaveMatch(id);
        setSavedJobs((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        addToast("Offre retiree des favoris", "info");
      } else {
        await saveMatch(id);
        setSavedJobs((prev) => new Set(prev).add(id));
        addToast("Offre sauvegardee", "success");
      }
      await loadStats();
    } catch (err: any) {
      addToast(err?.message ?? "Erreur", "error");
    } finally {
      setSaving(null);
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      loadRuns();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const maxPage = Math.max(1, Math.ceil(totalMatches / pageSize));

  return (
    <main className={isDark ? "min-h-screen p-4 md:p-6 bg-[#0b0c10] text-gray-100" : "min-h-screen p-4 md:p-6 bg-white text-gray-900"}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Tableau de bord
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Tes dernieres opportunites proposees
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/preferences"
              className={`
                inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
                ${isDark
                  ? "border border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                  : "border border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300"
                }
              `}
            >
              <FontAwesomeIcon icon={faSliders} className="text-xs" />
              Preferences
            </Link>
            <Link
              href="/cv"
              className={`
                inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
                ${isDark
                  ? "border border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                  : "border border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300"
                }
              `}
            >
              <FontAwesomeIcon icon={faFileLines} className="text-xs" />
              CV
            </Link>
            <Link
              href="/profile"
              className={`
                inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
                ${isDark
                  ? "border border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                  : "border border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300"
                }
              `}
            >
              <FontAwesomeIcon icon={faUser} className="text-xs" />
              Profil
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsError ? (
            <div className={`col-span-2 md:col-span-4 rounded-xl p-4 flex items-center justify-between ${
              isDark ? "bg-red-900/20 border border-red-800/50 text-red-300" : "bg-red-50 border border-red-200 text-red-600"
            }`}>
              <span className="text-sm">{statsError}</span>
              <button
                onClick={() => loadStats()}
                className={`text-sm px-3 py-1 rounded-lg transition-all ${
                  isDark ? "bg-red-800/50 hover:bg-red-800" : "bg-red-100 hover:bg-red-200"
                }`}
              >
                Réessayer
              </button>
            </div>
          ) : !stats ? (
            <>
              {[...Array(4)].map((_, i) => (
                <StatCardSkeleton key={i} isDark={isDark} />
              ))}
            </>
          ) : (
            <>
              <StatCard
                value={stats.total_jobs}
                label="Total offres"
                icon={faBriefcase}
                color="blue"
                isDark={isDark}
              />
              <StatCard
                value={stats.new_jobs}
                label="Non consultees"
                icon={faBolt}
                color="green"
                isDark={isDark}
              />
              <StatCard
                value={stats.viewed_jobs}
                label="Consultees"
                icon={faEye}
                color="gray"
                isDark={isDark}
              />
              <StatCard
                value={stats.saved_jobs}
                label="Sauvegardees"
                icon={faStar}
                color="amber"
                isDark={isDark}
              />
            </>
          )}
        </div>

        {/* AI Assistant */}
        <div className="mt-6">
          <AIAssistant
            isDark={isDark}
            analysis={analysis}
            analysisLoading={analysisLoading}
            analysisError={analysisError}
            searching={searching}
            onReloadAnalysis={() => loadAnalysis(true)}
            onLaunchSearch={launchSearch}
          />
        </div>

        {/* Search Result Banner */}
        {searchResult && (
          <div
            className={`
              mt-4 rounded-xl p-4 flex items-center justify-between
              ${isDark
                ? "bg-emerald-900/30 border border-emerald-800 text-emerald-200"
                : "bg-emerald-50 border border-emerald-200 text-emerald-800"
              }
            `}
          >
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faBolt} className="text-emerald-500" />
              <span className="text-sm">
                {searchResult.inserted > 0 ? (
                  <>
                    <span className="font-semibold">{searchResult.inserted}</span> nouvelles offres ajoutees
                    {searchResult.tried_queries.length > 0 && (
                      <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>
                        {" "}• Requetes: {searchResult.tried_queries.join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  <>Aucune nouvelle offre trouvee</>
                )}
              </span>
            </div>
            <button
              onClick={() => setSearchResult(null)}
              className={`text-sm underline ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
            >
              Fermer
            </button>
          </div>
        )}

        {/* Filters and Job List */}
        <div className={`mt-6 rounded-2xl border p-5 ${isDark ? "border-gray-700 bg-[#0f1116]" : "border-gray-200 bg-white"}`}>
          <FilterBar
            isDark={isDark}
            filterText={filterText}
            setFilterText={(v) => { setPage(1); setFilterText(v); }}
            minScore={minScore}
            setMinScore={(v) => { setPage(1); setMinScore(v); }}
            sourceFilter={sourceFilter}
            setSourceFilter={(v) => { setPage(1); setSourceFilter(v); }}
            sortBy={sortBy}
            setSortBy={(v) => { setPage(1); setSortBy(v); }}
            newOnly={newOnly}
            setNewOnly={(v) => { setPage(1); setNewOnly(v); }}
            sources={sources}
            newCount={matchesPage?.new_count ?? 0}
            viewMode={viewMode}
            setViewMode={setViewMode}
            totalMatches={totalMatches}
            currentCount={matches.length}
            page={page}
          />

          {/* Loading overlay */}
          {loading && matchesPage && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-[#0f1116]/50 rounded-xl z-10">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>Chargement...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className={`
              mt-4 rounded-xl p-4 flex items-center justify-between
              ${isDark ? "bg-red-900/30 border border-red-800 text-red-200" : "bg-red-50 border border-red-200 text-red-700"}
            `}>
              <span className="text-sm">{error}</span>
              <button
                onClick={() => load()}
                className={`
                  text-sm px-3 py-1 rounded-lg transition-all
                  ${isDark ? "bg-red-800 hover:bg-red-700" : "bg-red-100 hover:bg-red-200"}
                `}
              >
                Reessayer
              </button>
            </div>
          )}

          {/* Job list/grid */}
          {(!loading || matchesPage) && !error && (
            <div className="mt-6">
              {loading && !matchesPage ? (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
                  {[...Array(6)].map((_, i) => (
                    <JobCardSkeleton key={i} isDark={isDark} />
                  ))}
                </div>
              ) : matches.length === 0 ? (
                <div className={`
                  flex flex-col items-center justify-center py-12 text-center
                  ${isDark ? "text-gray-500" : "text-gray-400"}
                `}>
                  <FontAwesomeIcon icon={faBriefcase} className="text-5xl mb-4" />
                  <p className="text-lg font-medium">Pas encore d'offres</p>
                  <p className="text-sm mt-1">Relance une recherche IA ou repasse dans quelques jours</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matches.map((m) => (
                    <JobCard
                      key={m.id}
                      match={m}
                      isDark={isDark}
                      isNew={!!m.is_new && !visitedMatches.has(m.url)}
                      isSaved={savedJobs.has(m.id ?? 0)}
                      isSaving={saving === m.id}
                      isDeleting={deleting === m.id}
                      onSave={() => m.id && toggleSaveJob(m.id)}
                      onDelete={() => requestDelete(m)}
                      onVisit={() => markVisited(m.url, m.id)}
                    />
                  ))}
                </div>
              ) : (
                /* Table view */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                        <th className={`py-3 pr-4 text-left font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Role</th>
                        <th className={`py-3 pr-4 text-left font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Entreprise</th>
                        <th className={`py-3 pr-4 text-left font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Localisation</th>
                        <th className={`py-3 pr-4 text-left font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Source</th>
                        <th className={`py-3 pr-4 text-left font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Score</th>
                        <th className={`py-3 pr-4 text-left font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Lien</th>
                        <th className={`py-3 pr-4 text-center font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m) => {
                        const showNew = m.is_new && !visitedMatches.has(m.url);
                        return (
                          <tr key={m.id} className={`border-b ${isDark ? "border-gray-800 hover:bg-gray-800/50" : "border-gray-100 hover:bg-gray-50"} transition-colors`}>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isDark ? "text-gray-100" : "text-gray-900"}`}>{m.title}</span>
                                {showNew && (
                                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Nouveau
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={`py-3 pr-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              <div className="flex items-center gap-1.5">
                                <FontAwesomeIcon icon={faBuilding} className="text-xs text-gray-500" />
                                {m.company || "-"}
                              </div>
                            </td>
                            <td className={`py-3 pr-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              <div className="flex items-center gap-1.5">
                                <FontAwesomeIcon icon={faLocationDot} className="text-xs text-gray-500" />
                                {m.location || "-"}
                              </div>
                            </td>
                            <td className={`py-3 pr-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              <div className="flex items-center gap-1.5">
                                <FontAwesomeIcon icon={faGlobe} className="text-xs text-gray-500" />
                                {m.source || "-"}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`
                                inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold
                                ${m.score !== null && m.score >= 8
                                  ? isDark ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-100 text-emerald-700"
                                  : m.score !== null && m.score >= 6
                                    ? isDark ? "bg-amber-900/40 text-amber-300" : "bg-amber-100 text-amber-700"
                                    : isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
                                }
                              `}>
                                {m.score ?? "-"}/10
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => markVisited(m.url, m.id)}
                                className={`
                                  inline-flex items-center gap-1.5 text-sm font-medium transition-colors
                                  ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}
                                `}
                              >
                                <FontAwesomeIcon icon={faExternalLink} className="text-xs" />
                                Ouvrir
                              </a>
                            </td>
                            <td className="py-3 pr-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => m.id && toggleSaveJob(m.id)}
                                  disabled={saving === m.id}
                                  className={`
                                    inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all disabled:opacity-50
                                    ${savedJobs.has(m.id ?? 0)
                                      ? isDark ? "bg-amber-900/40 text-amber-400" : "bg-amber-100 text-amber-600"
                                      : isDark ? "text-gray-500 hover:bg-gray-800 hover:text-amber-400" : "text-gray-400 hover:bg-gray-100 hover:text-amber-500"
                                    }
                                  `}
                                  title={savedJobs.has(m.id ?? 0) ? "Retirer des favoris" : "Sauvegarder"}
                                >
                                  <FontAwesomeIcon icon={(savedJobs.has(m.id ?? 0) ? faStar : faStarRegular) as any} />
                                </button>
                                <button
                                  onClick={() => requestDelete(m)}
                                  disabled={deleting === m.id}
                                  className={`
                                    inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all disabled:opacity-50
                                    ${isDark ? "text-gray-500 hover:bg-red-900/40 hover:text-red-400" : "text-gray-400 hover:bg-red-100 hover:text-red-500"}
                                  `}
                                  title="Supprimer"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {matches.length > 0 && (
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => {
                      const next = Math.max(1, page - 1);
                      setPage(next);
                      load(next, filterText, minScore, sourceFilter, sortBy, newOnly);
                    }}
                    disabled={page <= 1 || loading}
                    className={`
                      inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50
                      ${isDark
                        ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                      }
                    `}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                    Precedent
                  </button>

                  <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    <span>Page</span>
                    <span className={`font-semibold ${isDark ? "text-gray-200" : "text-gray-800"}`}>{page}</span>
                    <span>sur</span>
                    <span className={`font-semibold ${isDark ? "text-gray-200" : "text-gray-800"}`}>{maxPage}</span>
                  </div>

                  <button
                    onClick={() => {
                      const next = Math.min(maxPage, page + 1);
                      if (next !== page) {
                        setPage(next);
                        load(next, filterText, minScore, sourceFilter, sortBy, newOnly);
                      }
                    }}
                    disabled={loading || page >= maxPage}
                    className={`
                      inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50
                      ${isDark
                        ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                      }
                    `}
                  >
                    Suivant
                    <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search History */}
        <div className="mt-6">
          <SearchHistory
            isDark={isDark}
            runs={runs}
            runsLoading={runsLoading}
            runsError={runsError}
            onRefresh={loadRuns}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div
            className={`
              w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in
              ${isDark ? "bg-[#0f1116] border border-gray-700" : "bg-white"}
            `}
          >
            <h3 className={`text-lg font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
              Supprimer cette offre ?
            </h3>
            <div className={`mt-3 rounded-xl p-3 ${isDark ? "bg-gray-800/50" : "bg-gray-50"}`}>
              <p className={`font-medium ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                {confirmTarget.title}
              </p>
              {confirmTarget.company && (
                <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {confirmTarget.company}
                </p>
              )}
            </div>
            <p className={`mt-3 text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              Cette action est irreversible.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className={`
                  rounded-xl px-4 py-2.5 text-sm font-medium transition-all
                  ${isDark
                    ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                Annuler
              </button>
              <button
                onClick={() => confirmDelete(confirmTarget.id)}
                disabled={deleting === confirmTarget.id}
                className={`
                  rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50
                  ${isDark
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-red-600 text-white hover:bg-red-700"
                  }
                `}
              >
                {deleting === confirmTarget.id ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
