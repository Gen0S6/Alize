"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearToken, getToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";
import { useToast } from "../../components/Toast";
import { DashboardSkeleton, TableRowSkeleton } from "../../components/Skeleton";
import {
  getAnalysis,
  getMatches,
  deleteMatch,
  runJobSearch,
  getJobRuns,
  markMatchVisited,
  type Analysis,
  type JobSearchResult,
  type Match,
  type MatchesPage,
  type JobRun,
  type SortOption,
} from "../../lib/api";

const VISITED_STORAGE_KEY = "visitedMatches";
const FILTERS_STORAGE_KEY = "dashboardFilters";

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
  const [searchError, setSearchError] = useState<string | null>(null);
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
  const [runs, setRuns] = useState<JobRun[]>([]);

  async function load(p = page, ft = filterText, ms = minScore, sf = sourceFilter, sb = sortBy, no = newOnly) {
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
      const message =
        err?.message === "Not authenticated"
          ? "Session expirée. Reconnecte-toi."
          : err?.message ?? "Failed to load matches";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalysis(force = false) {
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const data = await getAnalysis(force);
      setAnalysis(data);
    } catch (err: any) {
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
    setSearchError(null);
    try {
      const res = await runJobSearch();
      setSearchResult(res);
      if (res.inserted > 0) {
        addToast(`${res.inserted} nouvelles offres trouvées !`, "success");
      } else {
        addToast("Recherche terminée - aucune nouvelle offre", "info");
      }
      await load(1);
      await loadRuns();
    } catch (err: any) {
      const message =
        err?.message === "Not authenticated"
          ? "Session expirée. Reconnecte-toi."
          : err?.message ?? "Impossible de lancer la recherche IA";
      setSearchError(message);
      addToast(message, "error");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    // Load all data in parallel for better performance
    Promise.all([
      load(1, filterText, minScore, sourceFilter),
      loadAnalysis(),
      loadRuns(),
    ]).catch((err) => {
      console.error("Error loading dashboard data:", err);
    });
  }, [router]);

  useEffect(() => {
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
    } catch (_err) {
    }
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
    } catch (_err) {
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ filterText, minScore, sourceFilter, sortBy, newOnly })
      );
    } catch (_err) {
    }
  }, [filterText, minScore, sourceFilter, sortBy, newOnly]);

  function logout() {
    clearToken();
    router.push("/");
  }

  function requestDelete(match?: Match) {
    if (!match?.id) return;
    setConfirmTarget(match);
  }

  // Gestion clavier pour le popup de confirmation : Enter = OK, Escape = annuler
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
      addToast("Offre supprimée avec succès", "success");
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
      } catch (_err) {
      }
      return next;
    });
    if (id) {
      try {
        await markMatchVisited(id);
      } catch (_err) {
        // ignore API failure for marking visited
      }
    }
  }

  const matches = matchesPage?.items ?? [];
  const sources =
    (matchesPage?.available_sources && matchesPage.available_sources.length > 0
      ? matchesPage.available_sources
      : Array.from(new Set((matchesPage?.items ?? []).map((m) => m.source).filter(Boolean)))) as string[];
  const totalMatches = matchesPage?.total ?? 0;
  const newOffers = matches.filter((m) => m.is_new && !visitedMatches.has(m.url));

  async function loadRuns() {
    try {
      const data = await getJobRuns();
      setRuns(data);
    } catch (_err) {
    }
  }

  // Rafraîchit l'historique sans rechargement de page
  useEffect(() => {
    const id = setInterval(() => {
      loadRuns();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  function formatDate(dateVal: string | Date) {
    if (!dateVal) return "";
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (Number.isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString();
  }

  return (
    <main className={isDark ? "min-h-screen p-6 bg-[#0b0c10] text-gray-100 theme-hover" : "min-h-screen p-6 bg-white text-gray-900 theme-hover"}>
      <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <div>
            <h1 className="text-2xl font-semibold">Tableau de bord</h1>
            <p className={isDark ? "text-sm text-gray-400 mt-1" : "text-sm text-gray-600 mt-1"}>
              Tes dernières opportunités proposées.
            </p>
          </div>

            <div className="flex items-center gap-2">
              <Link
                href="/preferences"
                className={
                  isDark
                    ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
                    : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100"
                }
              >
                Préférences
              </Link>
              <Link
                href="/cv"
                className={
                  isDark
                    ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
                    : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100"
                }
              >
                CV
              </Link>
              <Link
                href="/profile"
                className={
                  isDark
                    ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
                    : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100"
                }
              >
                Profil
              </Link>
              <button
                onClick={logout}
                className={
                  isDark
                    ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
                    : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100"
                }
              >
                Déconnexion
              </button>
          </div>
          </div>

        <div
          className={
            isDark
              ? "mt-6 rounded-2xl border border-gray-700 bg-[#0f1116] p-4"
              : "mt-6 rounded-2xl border border-gray-200 bg-white p-4"
          }
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assistant IA</h2>
              <p className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>
                Analyse ton CV et tes préférences pour suggérer des recherches ciblées.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadAnalysis(true)}
                className={
                  isDark
                    ? "rounded-xl border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
                    : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                }
                disabled={analysisLoading}
              >
                {analysisLoading ? "Analyse..." : "Relancer l'analyse"}
              </button>
              <button
                onClick={() => launchSearch()}
                className={
                  isDark
                    ? "rounded-xl border border-gray-600 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
                    : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                }
                disabled={searching}
              >
                {searching ? "Recherche..." : "Recherche IA"}
              </button>
            </div>
          </div>

          {analysisError && (
            <p className={isDark ? "mt-3 text-sm text-red-400" : "mt-3 text-sm text-red-700"}>{analysisError}</p>
          )}
          {searchError && (
            <p className={isDark ? "mt-1 text-sm text-red-400" : "mt-1 text-sm text-red-700"}>{searchError}</p>
          )}

          {analysisLoading && !analysis && (
            <p className={isDark ? "mt-3 text-sm text-gray-400" : "mt-3 text-sm text-gray-600"}>Analyse en cours...</p>
          )}

          {analysis && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div
                className={
                  isDark
                    ? "rounded-xl border border-gray-700 bg-[#0d1016] p-3"
                    : "rounded-xl border border-gray-200 bg-white p-3"
                }
              >
                <p className={isDark ? "text-sm text-gray-100" : "text-sm text-gray-800"}>{analysis.summary}</p>
                {analysis.llm_used ? (
                  <p className={isDark ? "mt-1 text-xs text-green-300" : "mt-1 text-xs text-green-700"}>
                    Résumé et requêtes enrichis par OpenAI.
                  </p>
                ) : null}
                <div className="mt-2">
                  <p className={isDark ? "text-xs uppercase text-gray-400" : "text-xs uppercase text-gray-500"}>Requêtes IA</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {analysis.suggested_queries.length === 0 && (
                      <span className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-500"}>
                        Ajoute un CV ou des préférences.
                      </span>
                    )}
                    {analysis.suggested_queries.map((q) => (
                      <span
                        key={q}
                        className={
                          isDark
                            ? "rounded-full bg-[#111621] px-2 py-1 text-xs text-gray-100 border border-gray-700"
                            : "rounded-full bg-white px-2 py-1 text-xs text-gray-800 border"
                        }
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div
                className={
                  isDark
                    ? "rounded-xl border border-gray-700 bg-[#0d1016] p-3"
                    : "rounded-xl border border-gray-200 bg-white p-3"
                }
              >
                <p className={isDark ? "text-xs uppercase text-gray-400" : "text-xs uppercase text-gray-500"}>
                  Compétences détectées
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {analysis.top_keywords.slice(0, 10).map((kw) => (
                    <span
                      key={kw}
                      className={
                        isDark
                          ? "rounded-full bg-[#111621] px-2 py-1 text-xs text-gray-100 border border-gray-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800"
                      }
                    >
                      {kw}
                    </span>
                  ))}
                  {analysis.top_keywords.length === 0 && (
                    <span className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-500"}>
                      Aucune compétence détectée.
                    </span>
                  )}
                </div>
                {(analysis.must_hits.length > 0 || analysis.missing_must.length > 0) && (
                  <div
                    className={
                      isDark
                        ? "mt-2 grid grid-cols-1 gap-2 text-xs text-gray-300 md:grid-cols-2"
                        : "mt-2 grid grid-cols-1 gap-2 text-xs text-gray-700 md:grid-cols-2"
                    }
                  >
                    <div>
                      <p className={isDark ? "font-semibold text-green-400" : "font-semibold text-green-700"}>
                        Trouvés
                      </p>
                      <ul className="list-disc list-inside">
                        {analysis.must_hits.length === 0 && <li>—</li>}
                        {analysis.must_hits.map((kw) => (
                          <li key={kw}>{kw}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className={isDark ? "font-semibold text-orange-400" : "font-semibold text-orange-700"}>
                        Manquants
                      </p>
                      <ul className="list-disc list-inside">
                        {analysis.missing_must.length === 0 && <li>—</li>}
                        {analysis.missing_must.map((kw) => (
                          <li key={kw}>{kw}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {searchResult && (
            <div
              className={
                isDark
                  ? "mt-3 rounded-xl border border-green-700 bg-green-900/40 p-3 text-sm text-green-100"
                  : "mt-3 rounded-xl border bg-green-50 p-3 text-sm text-green-800"
              }
            >
              <div className="flex items-start justify-between">
                <div>
                  {searchResult.inserted > 0 ? (
                    <span>
                      {searchResult.inserted} nouvelles offres ajoutées.
                      {searchResult.tried_queries.length > 0 && (
                        <> Requêtes: {searchResult.tried_queries.join(" • ")}.</>
                      )}
                    </span>
                  ) : (
                    <span>
                      0 nouvelle offre ajoutée. Requête(s): {searchResult.tried_queries.join(" • ") || "—"}.<br />
                      Relancez une recherche ou patientez, dans 3 jours un email de notification vous sera envoyé pour de vous avertir de potentielles nouvelles offres.
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSearchResult(null)}
                  className="ml-2 text-xs underline"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={isDark ? "mt-6 rounded-2xl border border-gray-700 p-4 bg-[#0f1116]" : "mt-6 rounded-2xl border p-4 bg-white"}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className={isDark ? "text-xs font-semibold uppercase text-gray-400" : "text-xs font-semibold uppercase text-gray-500"}>
                  Recherche
                </label>
                <input
                  className={
                    isDark
                      ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
                      : "mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  }
                  placeholder="Titre, entreprise, localisation..."
                  value={filterText}
                  onChange={(e) => {
                    setPage(1);
                    setFilterText(e.target.value);
                  }}
                />
              </div>
              <div className="md:col-span-1">
                <label className={isDark ? "text-xs font-semibold uppercase text-gray-400" : "text-xs font-semibold uppercase text-gray-500"}>
                  Score min
                </label>
                <input
                  className={
                    isDark
                      ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-sm text-gray-100"
                      : "mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  }
                  type="number"
                  min={0}
                  max={10}
                  value={minScore}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                    setPage(1);
                    setMinScore(val);
                  }}
                />
              </div>
              <div className="md:col-span-1">
                <label className={isDark ? "text-xs font-semibold uppercase text-gray-400" : "text-xs font-semibold uppercase text-gray-500"}>
                  Source
                </label>
                <select
                  className={
                    isDark
                      ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-sm text-gray-100"
                      : "mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  }
                  value={sourceFilter}
                  onChange={(e) => {
                    setPage(1);
                    setSourceFilter(e.target.value);
                  }}
                >
                  <option value="all">Toutes</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Second row of filters: Sort and New Only */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className={isDark ? "text-xs font-semibold uppercase text-gray-400" : "text-xs font-semibold uppercase text-gray-500"}>
                  Trier par
                </label>
                <select
                  className={
                    isDark
                      ? "rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-sm text-gray-100"
                      : "rounded-xl border px-3 py-2 text-sm"
                  }
                  value={sortBy}
                  onChange={(e) => {
                    setPage(1);
                    setSortBy(e.target.value as SortOption);
                  }}
                >
                  <option value="new_first">Nouveautés d'abord</option>
                  <option value="newest">Plus récentes</option>
                  <option value="score">Meilleur score</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newOnly}
                  onChange={(e) => {
                    setPage(1);
                    setNewOnly(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={isDark ? "text-sm text-gray-300" : "text-sm text-gray-700"}>
                  Nouveautés uniquement
                </span>
                {(matchesPage?.new_count ?? 0) > 0 && (
                  <span className={
                    isDark
                      ? "rounded-full bg-green-900/40 px-2 py-0.5 text-[11px] font-semibold text-green-200 border border-green-700/60"
                      : "rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700"
                  }>
                    {matchesPage?.new_count}
                  </span>
                )}
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                {matches.length} résultats sur {totalMatches} (page {page})
              </p>
              {newOffers.length > 0 && !newOnly && (
                <span
                  className={
                    isDark
                      ? "rounded-full bg-green-900/40 px-2 py-1 text-[11px] font-semibold text-green-200 border border-green-700/60"
                      : "rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700"
                  }
                >
                  {newOffers.length} nouvelles offres non consultées
                </span>
              )}
            </div>
          </div>
          {loading && !matchesPage && (
            <div className="mt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`py-3 border-b ${isDark ? "border-gray-800" : "border-gray-200"} animate-pulse`}>
                  <div className="flex items-center gap-4">
                    <div className={`h-4 w-1/4 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-4 w-1/6 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-4 w-1/6 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-4 w-12 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && matchesPage && <p className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Chargement...</p>}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="flex items-start justify-between">
                <span>{error}</span>
                <button
                  onClick={() => load()}
                  className="ml-3 rounded-lg border px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {matches.length === 0 ? (
                <div className={isDark ? "text-sm text-gray-300" : "text-sm text-gray-700"}>
                  <p>Pas encore d'offres correspondantes.</p>
                  <p className="mt-1">
                    Relance une recherche ou repasse dans 3 jours : un email de notification te sera envoyé quand de nouvelles offres arriveront.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left">
                        <tr className="border-b">
                          <th className="py-2 pr-4">Rôle</th>
                          <th className="py-2 pr-4">Entreprise</th>
                          <th className="py-2 pr-4">Localisation</th>
                          <th className="py-2 pr-4">Source</th>
                          <th className="py-2 pr-4">Score /10</th>
                          <th className="py-2 pr-4">Lien</th>
                          <th className="py-2 pr-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m, idx) => {
                          const showNew = m.is_new && !visitedMatches.has(m.url);
                        return (
                            <tr key={idx} className={isDark ? "border-b border-gray-800 last:border-b-0" : "border-b last:border-b-0"}>
                              <td className="py-2 pr-4 font-medium">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{m.title}</span>
                                  {showNew ? (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                                    Nouveau
                                  </span>
                                ) : null}
                                </div>
                              </td>
                              <td className="py-2 pr-4">{m.company}</td>
                              <td className="py-2 pr-4">{m.location}</td>
                              <td className="py-2 pr-4">{m.source ?? "—"}</td>
                              <td className="py-2 pr-4">{m.score ?? "-"}</td>
                              <td className="py-2 pr-4">
                                <a
                                  className={isDark ? "underline text-blue-300 hover:text-blue-200" : "underline text-blue-700 hover:text-blue-900"}
                                  href={m.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => markVisited(m.url, m.id)}
                                >
                                  Ouvrir
                                </a>
                              </td>
                              <td className="py-2 pr-4 text-center">
                                <button
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => requestDelete(m)}
                  disabled={deleting === m.id}
                                  aria-label="Supprimer"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    className={
                      isDark
                        ? "rounded-lg border border-gray-700 px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-800"
                        : "rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-100"
                    }
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  load(next, filterText, minScore, sourceFilter, sortBy, newOnly);
                }}
                    disabled={page <= 1 || loading}
                  >
                    ← Précédent
                  </button>
                  <span className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-600"}>
                    Page {page} • {totalMatches} offres totales
                  </span>
                  <button
                    className={
                      isDark
                        ? "rounded-lg border border-gray-700 px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-800"
                        : "rounded-lg border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-100"
                    }
                    onClick={() => {
                      const maxPage = Math.max(1, Math.ceil(totalMatches / pageSize));
                      const next = Math.min(maxPage, page + 1);
                      if (next !== page) {
                        setPage(next);
                        load(next, filterText, minScore, sourceFilter, sortBy, newOnly);
                      }
                    }}
                    disabled={loading || (matchesPage ? page >= Math.ceil(totalMatches / pageSize) : false)}
                  >
                    Suivant →
                  </button>
                </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={isDark ? "mx-auto max-w-4xl mt-4 rounded-2xl border border-gray-700 p-4 bg-[#0f1116]" : "mx-auto max-w-4xl mt-4 rounded-2xl border p-4 bg-white"}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Historique des recherches</h2>
            <p className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Derniers lancements : date, requêtes et offres ajoutées.</p>
          </div>
          <button
            className={isDark ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50" : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"}
            onClick={loadRuns}
          >
            Rafraîchir
          </button>
        </div>
        {runs.length === 0 ? (
          <p className={isDark ? "mt-2 text-sm text-gray-400" : "mt-2 text-sm text-gray-600"}>Pas encore d'historique.</p>
        ) : (
          <ul className={isDark ? "mt-3 divide-y divide-gray-800" : "mt-3 divide-y"}>
            {runs.map((run) => (
              <li key={run.id} className={isDark ? "py-2 text-sm flex items-start justify-between gap-3 text-gray-200" : "py-2 text-sm flex items-start justify-between gap-3 text-gray-800"}>
                <div>
                  <div className={isDark ? "font-medium text-gray-100" : "font-medium text-gray-900"}>
                    {formatDate(run.created_at)}
                  </div>
                  <div className={isDark ? "text-gray-300" : "text-gray-700"}>
                    Requêtes: {run.tried_queries && run.tried_queries.length > 0 ? run.tried_queries.join(" • ") : "—"}
                  </div>
                  <div className={isDark ? "text-gray-400 text-xs" : "text-gray-600 text-xs"}>
                    Sources: {Object.entries(run.sources || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
                  </div>
                </div>
                <span className={isDark ? "rounded-full bg-[#111621] border border-gray-700 px-3 py-1 text-xs font-semibold text-blue-300" : "rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700"}>
                  +{run.inserted} offres
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className={
              isDark
                ? "w-full max-w-sm rounded-xl bg-[#0f1116] p-4 shadow-xl border border-gray-700 text-gray-100"
                : "w-full max-w-sm rounded-xl bg-white p-4 shadow-xl text-gray-900"
            }
          >
            <h3 className="text-sm font-semibold">Supprimer cette offre ?</h3>
            <p className={isDark ? "mt-1 text-sm text-gray-300" : "mt-1 text-sm text-gray-600"}>
              {confirmTarget.title}
              {confirmTarget.company ? (
                <>
                  <br />
                  {confirmTarget.company}
                </>
              ) : null}
            </p>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button
                className={
                  isDark
                    ? "rounded-md px-3 py-1.5 text-gray-300 hover:bg-gray-800 border border-gray-700"
                    : "rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100"
                }
                onClick={() => setConfirmTarget(null)}
              >
                Annuler
              </button>
              <button
                className={
                  isDark
                    ? "rounded-md bg-red-900/40 border border-red-700 px-3 py-1.5 text-red-200 hover:bg-red-900/60 disabled:opacity-50"
                    : "rounded-md bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50"
                }
                onClick={() => confirmDelete(confirmTarget.id)}
                disabled={deleting === confirmTarget.id}
              >
                {deleting === confirmTarget.id ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
