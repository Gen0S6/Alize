"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfile, updateProfile, deleteProfile, type Profile } from "../../lib/api";
import { clearToken, getToken, clearTokenAndRedirectHome } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "../ThemeProvider";
import { useToast } from "../../components/Toast";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const { addToast } = useToast();

  function logout() {
    clearToken();
    router.push("/");
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setEmail(data.email);
        setNotificationsEnabled(data.notifications_enabled);
      } catch (err: any) {
        setError(err?.message ?? "Impossible de charger le profil");
        if (err?.message === "Not authenticated") {
          clearToken();
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);


  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (newPassword && newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword && !currentPassword) {
      setError("Veuillez entrer votre mot de passe actuel pour en définir un nouveau.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateProfile({
        email,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
        notifications_enabled: notificationsEnabled,
      });
      setProfile(updated);
      setSuccess("Profil sauvegardé");
      addToast("Profil sauvegardé avec succès", "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de la sauvegarde");
      addToast(err?.message ?? "Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  }

  const errorClass = isDark
    ? "mt-4 rounded-xl border border-red-700 bg-red-900/30 p-3 text-sm text-red-200"
    : "mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700";

  const inputClass = isDark
    ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-gray-100 placeholder-gray-500"
    : "mt-1 w-full rounded-xl border px-3 py-2 text-gray-900 placeholder-gray-500 bg-white";
  const smallTextClass = isDark ? "text-xs text-gray-400" : "text-xs text-gray-600";
  const buttonClass = isDark
    ? "rounded-xl border border-gray-600 px-4 py-2 font-medium bg-[#0f1116] text-gray-100 hover:bg-gray-800 disabled:opacity-50"
    : "rounded-xl border px-4 py-2 font-medium bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50";
  const dangerButtonClass = isDark
    ? "rounded-xl border border-red-700 px-4 py-2 font-medium bg-red-900/40 text-red-100 hover:bg-red-900/60 disabled:opacity-50"
    : "rounded-xl border border-red-300 px-4 py-2 font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50";
  const dangerNoteClass = isDark ? "text-xs text-gray-400" : "text-xs text-gray-600";
  const dangerTitleClass = isDark ? "text-sm text-red-300 font-medium" : "text-sm text-red-700 font-medium";

  return (
    <main className={isDark ? "min-h-screen p-6 bg-[#0b0c10] text-gray-100 theme-hover" : "min-h-screen p-6 bg-white text-gray-900 theme-hover"}>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Profil</h1>
            <p className={isDark ? "text-sm text-gray-300 mt-1" : "text-sm text-gray-600 mt-1"}>
              Gère ton compte, tes préférences et ta sécurité.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className={
                isDark
                  ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 bg-[#0f1116] text-gray-100"
                  : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100 bg-white text-gray-800"
              }
            >
              {isDark ? "☀️ Clair" : "🌙 Sombre"}
            </button>
            <Link
              href="/dashboard"
              className={
                isDark
                  ? "rounded-xl border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
                  : "rounded-xl border px-3 py-2 text-sm hover:bg-gray-100"
              }
            >
              ← Dashboard
            </Link>
            <button
              type="button"
              onClick={logout}
              className={
                isDark
                  ? "rounded-xl border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300 hover:bg-red-900/40"
                  : "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
              }
            >
              Déconnexion
            </button>
          </div>
        </div>

        {loading && <p className="mt-4 text-sm">Chargement...</p>}
        {error && (
          <div className={errorClass}>
            <strong>Oups :</strong> {error}
          </div>
        )}

        {profile && !loading && (
          <form onSubmit={save} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mot de passe actuel</label>
              <input
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                placeholder="Requis pour changer de mot de passe"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nouveau mot de passe</label>
              <input
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Laisse vide pour ne pas changer"
              />
              <p className={smallTextClass + " mt-1"}>8 caractères minimum.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
              Activer l'envoi d'emails tous les 3 jours
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className={buttonClass}
                disabled={saving}
              >
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
              {success && <span className="text-sm text-green-400">{success}</span>}
            </div>
            <div className="pt-4 border-t border-gray-700/40">
              <p className={dangerTitleClass}>Danger</p>
              <p className={dangerNoteClass}>Supprimer ton compte supprimera aussi tes offres et préférences.</p>
              <button
                type="button"
                className={dangerButtonClass + " mt-2"}
                onClick={() => setConfirmDelete(true)}
              >
                Supprimer mon compte
              </button>
            </div>
          </form>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={isDark ? "w-full max-w-sm rounded-xl bg-[#0f1116] border border-gray-700 p-4 shadow-xl text-gray-100" : "w-full max-w-sm rounded-xl bg-white p-4 shadow-xl text-gray-900"}>
            <h3 className="text-sm font-semibold">Supprimer le compte ?</h3>
            <p className={isDark ? "mt-1 text-sm text-gray-300" : "mt-1 text-sm text-gray-600"}>
              Cette action est définitive et supprimera tes données et offres associées.
            </p>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button
                className={isDark ? "rounded-md px-3 py-1.5 text-gray-200 hover:bg-gray-800 border border-gray-700" : "rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100"}
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
              <button
                className={isDark ? "rounded-md bg-red-900/40 border border-red-700 px-3 py-1.5 text-red-200 hover:bg-red-900/60" : "rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-100"}
                onClick={async () => {
                  try {
                    await deleteProfile();
                    clearTokenAndRedirectHome();
                  } catch (err: any) {
                    alert(err?.message ?? "Impossible de supprimer le compte");
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
