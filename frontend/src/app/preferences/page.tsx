"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPreferences,
  updatePreferences,
  getMatchesCount,
  type Preference,
} from "../../lib/api";
import { getToken, clearToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";

export default function PreferencesPage() {
  const router = useRouter();
  const [pref, setPref] = useState<Preference | null>(null);
  const [initialPref, setInitialPref] = useState<Preference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasExistingJobs, setHasExistingJobs] = useState<boolean | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const data = await getPreferences();
        setPref(data);
        setInitialPref(data);
      } catch (err: any) {
        setError(err?.message ?? "Impossible de charger les préférences");
        if (err?.message === "Not authenticated") {
          clearToken();
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function doSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!pref) return;
      const updated = await updatePreferences(pref);
      setPref(updated);
      setInitialPref(updated);
      setSuccess("Préférences sauvegardées avec succès !");
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!pref || !hasChanges()) return;

    setConfirmOpen(true);
    setChecking(true);

    try {
      const { count } = await getMatchesCount();
      setHasExistingJobs(count > 0);

      if (count === 0) {
        setConfirmOpen(false);
        await doSave();
      }
    } catch (_err) {
      setHasExistingJobs(null);
    } finally {
      setChecking(false);
    }
  }

  function updateField<K extends keyof Preference>(key: K, value: Preference[K]) {
    setPref((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function hasChanges() {
    if (!pref || !initialPref) return false;
    const keys: (keyof Preference)[] = ["role", "location", "contract_type", "salary_min", "must_keywords", "avoid_keywords"];
    return keys.some((k) => {
      const cur = pref[k];
      const initial = initialPref[k];
      if (typeof cur === "string" && typeof initial === "string") {
        return cur.trim() !== initial.trim();
      }
      return (cur ?? "") !== (initial ?? "");
    });
  }

  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!saving && !checking) {
          void doSave();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, saving, checking, pref]);

  // Styles
  const cardClass = isDark
    ? "rounded-2xl border border-gray-700/50 bg-gradient-to-br from-[#0f1116] to-[#12141a] p-6 shadow-lg"
    : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm";

  const textMuted = isDark ? "text-gray-400" : "text-gray-500";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-900";

  const inputClass = isDark
    ? "w-full rounded-xl border border-gray-700 bg-[#0d1016] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
    : "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all";

  const labelClass = isDark
    ? "block text-sm font-medium text-gray-200 mb-2"
    : "block text-sm font-medium text-gray-700 mb-2";

  const btnPrimary = isDark
    ? "rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
    : "rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const btnSecondary = isDark
    ? "rounded-xl border border-gray-600 bg-[#0f1116] hover:bg-gray-800 px-4 py-2 font-medium text-gray-200 transition-all duration-200"
    : "rounded-xl border border-gray-300 bg-white hover:bg-gray-50 px-4 py-2 font-medium text-gray-700 transition-all duration-200";

  return (
    <main className={isDark ? "min-h-screen p-4 md:p-6 max-w-4xl mx-auto bg-[#0b0c10] text-gray-100" : "min-h-screen p-4 md:p-6 max-w-4xl mx-auto bg-gray-50 text-gray-900"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className={isDark ? "p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg shadow-purple-600/20" : "p-2.5 rounded-xl bg-purple-600 shadow-md"}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </span>
            Préférences
          </h1>
          <p className={`mt-2 ${textMuted}`}>Configure tes critères de recherche d'emploi</p>
        </div>
        <Link href="/dashboard" className={btnSecondary}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </span>
        </Link>
      </div>

      {/* Error message */}
      {error && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${isDark ? "bg-red-900/20 border border-red-700/50" : "bg-red-50 border border-red-200"}`}>
          <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-red-400" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={`text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>{error}</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${isDark ? "bg-green-900/20 border border-green-700/50" : "bg-green-50 border border-green-200"}`}>
          <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-green-400" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={`text-sm ${isDark ? "text-green-300" : "text-green-700"}`}>{success}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className={`h-4 w-24 rounded animate-pulse mb-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-12 w-full rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                  </div>
                ))}
              </div>
              <div>
                <div className={`h-4 w-32 rounded animate-pulse mb-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                <div className={`h-20 w-full rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
              </div>
              <div>
                <div className={`h-4 w-28 rounded animate-pulse mb-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                <div className={`h-20 w-full rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {pref && !loading && (
        <form onSubmit={save} className="space-y-6">
          {/* Critères principaux */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-6">
              <div className={`p-2 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-100"}`}>
                <svg className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Critères de recherche</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Rôle recherché
                  </span>
                </label>
                <input
                  className={inputClass}
                  value={pref.role ?? ""}
                  onChange={(e) => updateField("role", e.target.value)}
                  placeholder="Data analyst, Dev fullstack..."
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Localisation
                  </span>
                </label>
                <input
                  className={inputClass}
                  value={pref.location ?? ""}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="Paris, Remote, Lyon..."
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Type de contrat
                  </span>
                </label>
                <input
                  className={inputClass}
                  value={pref.contract_type ?? ""}
                  onChange={(e) => updateField("contract_type", e.target.value)}
                  placeholder="CDI, Stage, Alternance..."
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Salaire minimum (€/an)
                  </span>
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={pref.salary_min ?? ""}
                  onChange={(e) =>
                    updateField(
                      "salary_min",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  placeholder="35000"
                />
              </div>
            </div>
          </div>

          {/* Mots-clés */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-6">
              <div className={`p-2 rounded-lg ${isDark ? "bg-emerald-900/30" : "bg-emerald-100"}`}>
                <svg className={`w-5 h-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Mots-clés</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${isDark ? "text-green-400" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mots-clés obligatoires
                  </span>
                </label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={pref.must_keywords ?? ""}
                  onChange={(e) => updateField("must_keywords", e.target.value)}
                  placeholder="python, fastapi, sql, react..."
                />
                <p className={`text-xs mt-2 ${textMuted}`}>
                  Les offres doivent contenir au moins un de ces mots-clés. Sépare-les par des virgules.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${isDark ? "text-red-400" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Mots-clés à éviter
                  </span>
                </label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={pref.avoid_keywords ?? ""}
                  onChange={(e) => updateField("avoid_keywords", e.target.value)}
                  placeholder="c#, java, senior..."
                />
                <p className={`text-xs mt-2 ${textMuted}`}>
                  Les offres contenant ces mots-clés seront exclues.
                </p>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className={btnPrimary}
              disabled={saving || checking || !hasChanges()}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sauvegarde...
                </span>
              ) : checking ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Vérification...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sauvegarder les préférences
                </span>
              )}
            </button>

            {hasChanges() && (
              <span className={`text-sm ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                Modifications non sauvegardées
              </span>
            )}
          </div>
        </form>
      )}

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? "bg-[#0f1116] border border-gray-700" : "bg-white"}`}>
            {checking ? (
              <div className="text-center py-4">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
                  <svg className={`animate-spin w-6 h-6 ${isDark ? "text-blue-400" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Vérification en cours...</h3>
                <p className={`mt-2 text-sm ${textMuted}`}>Analyse de vos offres existantes</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${isDark ? "bg-amber-900/30" : "bg-amber-100"}`}>
                    <svg className={`w-6 h-6 ${isDark ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>
                    Attention
                  </h3>
                </div>
                <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                  Modifier les préférences va supprimer les offres d'emploi actuellement enregistrées.
                  Une nouvelle recherche sera lancée avec les nouveaux critères.
                </p>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    className={btnSecondary}
                    onClick={() => setConfirmOpen(false)}
                  >
                    Annuler
                  </button>
                  <button
                    className={`rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 font-medium text-white transition-colors disabled:opacity-50`}
                    onClick={doSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sauvegarde...
                      </span>
                    ) : (
                      "Confirmer et sauvegarder"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
