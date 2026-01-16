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
      setSuccess("Préférences sauvegardées");
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

    // Afficher la popup immédiatement pour éviter le délai
    // La vérification des offres existantes se fait en arrière-plan
    setConfirmOpen(true);
    setChecking(true);

    try {
      // Utiliser l'endpoint rapide /matches/count au lieu de charger les offres
      const { count } = await getMatchesCount();
      setHasExistingJobs(count > 0);

      // Si pas d'offres existantes, sauvegarder directement sans confirmation
      if (count === 0) {
        setConfirmOpen(false);
        await doSave();
      }
    } catch (_err) {
      // En cas d'erreur, on laisse l'utilisateur décider
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

  // Gestion clavier sur le pop-up de confirmation : Enter = Continuer, Escape = Annuler
  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmOpen(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!saving) {
          void doSave();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, saving, pref]);

  const inputClass = isDark
    ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-gray-100 placeholder-gray-500"
    : "mt-1 w-full rounded-xl border px-3 py-2";
  const textMuted = isDark ? "text-sm text-gray-400 mt-1" : "text-sm text-gray-600 mt-1";
  const btnPrimary = isDark
    ? "rounded-xl border border-gray-700 px-4 py-2 font-medium bg-[#0f1116] text-gray-100 hover:bg-gray-800 disabled:opacity-50"
    : "rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50";
  const linkBtn = isDark
    ? "rounded-xl border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800"
    : "rounded-xl border px-4 py-2 text-sm hover:bg-gray-50";
  const panelClass = isDark ? "mx-auto max-w-3xl bg-[#0f1116]" : "mx-auto max-w-3xl";

  return (
    <main className={isDark ? "min-h-screen p-6 bg-[#0b0c10] text-gray-100 theme-hover" : "min-h-screen p-6 bg-white text-gray-900 theme-hover"}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Préférences</h1>
            <p className={textMuted}>
              Indique tes critères pour affiner les matches.
            </p>
          </div>
          <Link
            href="/dashboard"
            className={linkBtn}
          >
            ← Retour dashboard
          </Link>
        </div>

        {loading && <p className="mt-4 text-sm">Chargement...</p>}
        {error && (
          <div className={isDark ? "mt-4 rounded-xl border border-red-700 bg-red-900/30 p-3 text-sm text-red-200" : "mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"}>
            {error}
          </div>
        )}

        {pref && !loading && (
          <form onSubmit={save} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Rôle recherché</label>
                <input
                  className={inputClass}
                  value={pref.role ?? ""}
                  onChange={(e) => updateField("role", e.target.value)}
                  placeholder="Data analyst, Dev fullstack..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Localisation</label>
                <input
                  className={inputClass}
                  value={pref.location ?? ""}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="Paris, Remote..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type de contrat</label>
                <input
                  className={inputClass}
                  value={pref.contract_type ?? ""}
                  onChange={(e) => updateField("contract_type", e.target.value)}
                  placeholder="CDI, Stage, Alternance..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Salaire min (€/an)</label>
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

            <div>
              <label className="text-sm font-medium">Mots-clés obligatoires</label>
              <textarea
                className={inputClass}
                rows={2}
                value={pref.must_keywords ?? ""}
                onChange={(e) => updateField("must_keywords", e.target.value)}
                placeholder="python, fastapi, sql"
              />
              <p className={isDark ? "text-xs text-gray-400 mt-1" : "text-xs text-gray-500 mt-1"}>
                Sépare par des virgules.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Mots-clés à éviter</label>
              <textarea
                className={inputClass}
                rows={2}
                value={pref.avoid_keywords ?? ""}
                onChange={(e) => updateField("avoid_keywords", e.target.value)}
                placeholder="c#, cdi obligatoire"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className={btnPrimary}
                disabled={saving || checking || !hasChanges()}
              >
                {saving ? "Sauvegarde..." : checking ? "Vérification..." : "Sauvegarder"}
              </button>
              {success && <span className={isDark ? "text-sm text-green-300" : "text-sm text-green-700"}>{success}</span>}
            </div>
          </form>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={isDark ? "w-full max-w-sm rounded-xl bg-[#0f1116] border border-gray-700 p-4 shadow-xl text-gray-100" : "w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"}>
            {checking ? (
              <>
                <h3 className={isDark ? "text-sm font-semibold text-gray-100" : "text-sm font-semibold text-gray-900"}>
                  Vérification...
                </h3>
                <p className={isDark ? "mt-1 text-sm text-gray-300" : "mt-1 text-sm text-gray-600"}>
                  Analyse de vos offres en cours.
                </p>
                <div className="mt-4 flex justify-center">
                  <div className={isDark ? "animate-spin h-5 w-5 border-2 border-gray-600 border-t-gray-200 rounded-full" : "animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full"}></div>
                </div>
              </>
            ) : (
              <>
                <h3 className={isDark ? "text-sm font-semibold text-gray-100" : "text-sm font-semibold text-gray-900"}>
                  Supprimer les offres existantes ?
                </h3>
                <p className={isDark ? "mt-1 text-sm text-gray-300" : "mt-1 text-sm text-gray-600"}>
                  Changer les préférences va vider les offres actuelles.
                </p>
                <div className="mt-4 flex justify-end gap-2 text-sm">
                  <button
                    className={isDark ? "rounded-md px-3 py-1.5 text-gray-200 hover:bg-gray-800 border border-gray-700" : "rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100"}
                    onClick={() => setConfirmOpen(false)}
                  >
                    Annuler
                  </button>
                  <button
                    className={isDark ? "rounded-md bg-red-900/40 border border-red-700 px-3 py-1.5 text-red-200 hover:bg-red-900/60 disabled:opacity-50" : "rounded-md bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50"}
                    onClick={doSave}
                    disabled={saving}
                  >
                    {saving ? "…" : "Continuer"}
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
