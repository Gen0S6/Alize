"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import {
  getProfile,
  updateProfile,
  deleteProfile,
  requestEmailVerification,
  getPreferences,
  updatePreferences,
  type Preference,
  type Profile,
} from "../../lib/api";
import { clearToken, getToken, clearTokenAndRedirectHome } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "../ThemeProvider";
import { useToast } from "../../components/Toast";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialEmail, setInitialEmail] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notificationPref, setNotificationPref] = useState<Preference | null>(null);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationEnabledSaving, setNotificationEnabledSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const { addToast } = useToast();

  async function handleSendVerification() {
    setSendingVerification(true);
    try {
      await requestEmailVerification();
      addToast("Email de vérification envoyé !", "success");
    } catch (err: any) {
      addToast(err?.message ?? "Erreur lors de l'envoi", "error");
    } finally {
      setSendingVerification(false);
    }
  }

  // Sauvegarde automatique des notifications
  async function handleToggleNotifications() {
    if (!profile) return;
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    setSavingNotifications(true);
    try {
      const updated = await updateProfile({ notifications_enabled: newValue });
      setProfile(updated);
      addToast(newValue ? "Notifications activées" : "Notifications désactivées", "success");
    } catch (err: any) {
      // Revert on error
      setNotificationsEnabled(!newValue);
      addToast(err?.message ?? "Erreur lors de la mise à jour", "error");
    } finally {
      setSavingNotifications(false);
    }
  }

  // Détection des changements pour griser le bouton
  function hasChanges(): boolean {
    if (!profile) return false;
    const emailChanged = email.trim() !== initialEmail.trim();
    const passwordChanged = newPassword.length > 0;
    return emailChanged || passwordChanged;
  }

  // Raccourcis clavier pour le modal de confirmation
  useEffect(() => {
    if (!confirmDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmDelete(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!deleting) {
          handleDeleteAccount();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDelete, deleting]);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteProfile();
      clearTokenAndRedirectHome();
    } catch (err: any) {
      addToast(err?.message ?? "Impossible de supprimer le compte", "error");
      setDeleting(false);
    }
  }

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
        const [profileResult, prefResult] = await Promise.allSettled([getProfile(), getPreferences()]);
        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value);
          setEmail(profileResult.value.email);
          setNotificationEnabled(profileResult.value.notifications_enabled);
        } else {
          setError(profileResult.reason?.message ?? "Impossible de charger le profil");
          if (profileResult.reason?.message === "Not authenticated") {
            clearToken();
            router.push("/login");
          }
        }
        if (prefResult.status === "fulfilled") {
          setNotificationPref(prefResult.value);
        } else {
          addToast(prefResult.reason?.message ?? "Impossible de charger les notifications", "error");
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
      });
      setProfile(updated);
      setInitialEmail(updated.email);
      setSuccess("Profil sauvegardé");
      addToast("Profil sauvegardé avec succès", "success");
      // Notifier le header que le profil a été mis à jour
      window.dispatchEvent(new CustomEvent("profile_updated", { detail: updated }));
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de la sauvegarde");
      addToast(err?.message ?? "Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  }

  function hasProfileChanges() {
    if (!profile) return false;
    const emailChanged = email.trim() !== profile.email.trim();
    const passwordChanged = Boolean(newPassword);
    return emailChanged || passwordChanged;
  }

  function updateNotificationField<K extends keyof Preference>(key: K, value: Preference[K]) {
    setNotificationPref((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveNotifications(nextPref?: Preference | MouseEvent<HTMLButtonElement>) {
    const provided = nextPref && "user_id" in nextPref ? nextPref : undefined;
    if (!notificationPref && !provided) return;
    setNotificationSaving(true);
    try {
      const payload = provided ?? notificationPref;
      if (!payload) return;
      const updated = await updatePreferences({
        notification_frequency: payload.notification_frequency ?? "every_3_days",
        send_empty_digest: payload.send_empty_digest ?? true,
        notification_max_jobs: payload.notification_max_jobs ?? 5,
      });
      setNotificationPref(updated);
      addToast("Notifications mises à jour", "success");
    } catch (err: any) {
      addToast(err?.message ?? "Erreur lors de la mise à jour", "error");
    } finally {
      setNotificationSaving(false);
    }
  }

  async function saveNotificationsEnabled(nextValue: boolean) {
    if (!profile) return;
    setNotificationEnabledSaving(true);
    try {
      const updated = await updateProfile({ notifications_enabled: nextValue });
      setProfile(updated);
      setNotificationEnabled(updated.notifications_enabled);
      addToast("Préférences de notification mises à jour", "success");
    } catch (err: any) {
      setNotificationEnabled(profile.notifications_enabled);
      addToast(err?.message ?? "Erreur lors de la mise à jour", "error");
    } finally {
      setNotificationEnabledSaving(false);
    }
  }

  // Styles cohérents avec les autres pages
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

  const btnDanger = isDark
    ? "rounded-xl border border-red-700/50 bg-red-900/20 hover:bg-red-900/40 px-4 py-2 font-medium text-red-300 transition-all duration-200"
    : "rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 font-medium text-red-700 transition-all duration-200";

  return (
    <main className={isDark ? "min-h-screen p-4 md:p-6 bg-[#0b0c10] text-gray-100" : "min-h-screen p-4 md:p-6 bg-white text-gray-900"}>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span className={isDark ? "p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-lg shadow-indigo-600/20" : "p-2.5 rounded-xl bg-indigo-600 shadow-md"}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              Mon Profil
            </h1>
            <p className={`mt-2 ${textMuted}`}>Gère ton compte et ta sécurité</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className={btnSecondary}
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {isDark ? "Mode clair" : "Mode sombre"}
              </span>
            </button>
            <Link href="/dashboard" className={btnSecondary}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Dashboard
              </span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className={btnDanger}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Déconnexion
              </span>
            </button>
          </div>
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
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <div className={`h-4 w-24 rounded animate-pulse mb-2 ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-12 w-full rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {profile && !loading && (
          <form onSubmit={save} className="space-y-6">
            {/* Informations du compte */}
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-6">
                <div className={`p-2 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-100"}`}>
                  <svg className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <h2 className={`text-lg font-semibold ${textPrimary}`}>Informations du compte</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Adresse email
                    </span>
                  </label>
                  <input
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="ton@email.com"
                  />
                  {/* État de vérification d'email */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {profile.email_verified ? (
                        <>
                          <svg className={`w-4 h-4 ${isDark ? "text-green-400" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={`text-sm ${isDark ? "text-green-400" : "text-green-600"}`}>
                            Email vérifié
                          </span>
                        </>
                      ) : (
                        <>
                          <svg className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className={`text-sm ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                            Email non vérifié
                          </span>
                        </>
                      )}
                    </div>
                    {!profile.email_verified && (
                      <button
                        type="button"
                        onClick={handleSendVerification}
                        disabled={sendingVerification}
                        className={`text-sm px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                          isDark
                            ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        {sendingVerification ? "Envoi..." : "Vérifier mon email"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sécurité */}
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-6">
                <div className={`p-2 rounded-lg ${isDark ? "bg-amber-900/30" : "bg-amber-100"}`}>
                  <svg className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className={`text-lg font-semibold ${textPrimary}`}>Sécurité</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Mot de passe actuel
                    </span>
                  </label>
                  <input
                    className={inputClass}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type="password"
                    placeholder="Requis pour changer de mot de passe"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Nouveau mot de passe
                    </span>
                  </label>
                  <input
                    className={inputClass}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="Laisse vide pour ne pas changer"
                  />
                  <p className={`text-xs mt-2 ${textMuted}`}>
                    8 caractères minimum
                  </p>
                </div>
              </div>
            </div>

            {/* Notifications */}
            {notificationPref && (
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-6">
                  <div className={`p-2 rounded-lg ${isDark ? "bg-amber-900/30" : "bg-amber-100"}`}>
                    <svg className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className={`text-lg font-semibold ${textPrimary}`}>Notifications</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>
                      Fréquence des emails
                    </label>
                    <select
                      className={inputClass}
                      value={notificationPref.notification_frequency ?? "every_3_days"}
                      onChange={(e) =>
                        updateNotificationField(
                          "notification_frequency",
                          e.target.value as Preference["notification_frequency"]
                        )
                      }
                    >
                      <option value="daily">Tous les jours</option>
                      <option value="every_3_days">Tous les 3 jours</option>
                      <option value="weekly">Toutes les semaines</option>
                    </select>
                    <p className={`text-xs mt-2 ${textMuted}`}>
                      Définit la cadence de réception des emails de matching.
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Envoyer un email quand aucune offre n'est trouvée
                    </label>
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateNotificationField(
                            "send_empty_digest",
                            !(notificationPref.send_empty_digest ?? true)
                          )
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          (notificationPref.send_empty_digest ?? true)
                            ? isDark
                              ? "bg-emerald-600"
                              : "bg-emerald-500"
                            : isDark
                              ? "bg-gray-700"
                              : "bg-gray-200"
                        }`}
                        aria-pressed={notificationPref.send_empty_digest ?? true}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            (notificationPref.send_empty_digest ?? true) ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className={`text-sm ${textMuted}`}>
                        {notificationPref.send_empty_digest ?? true ? "Activé" : "Désactivé"}
                      </span>
                    </div>
                    <p className={`text-xs mt-2 ${textMuted}`}>
                      Désactive pour ne recevoir un email que lorsqu'il y a de nouvelles offres.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={saveNotifications}
                    disabled={notificationSaving || !notificationHasChanges()}
                  >
                    {notificationSaving ? "Mise à jour..." : "Sauvegarder les notifications"}
                  </button>
                  {notificationHasChanges() && (
                    <span className={`text-sm ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                      Modifications non sauvegardées
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Submit button */}
            <div className="flex items-center justify-between">
              <button
                type="submit"
                className={btnPrimary}
                disabled={saving || !hasProfileChanges()}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sauvegarde...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Sauvegarder les modifications
                  </span>
                )}
              </button>
              {!hasProfileChanges() && (
                <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Aucune modification à enregistrer
                </span>
              )}
            </div>

            {/* Notifications */}
            {notificationPref && (
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-6">
                  <div className={`p-2 rounded-lg ${isDark ? "bg-amber-900/30" : "bg-amber-100"}`}>
                    <svg className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className={`text-lg font-semibold ${textPrimary}`}>Notifications</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>
                      Activer l'envoi d'emails
                    </label>
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const nextValue = !notificationEnabled;
                          setNotificationEnabled(nextValue);
                          void saveNotificationsEnabled(nextValue);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          notificationEnabled
                            ? isDark
                              ? "bg-emerald-600"
                              : "bg-emerald-500"
                            : isDark
                              ? "bg-gray-700"
                              : "bg-gray-200"
                        }`}
                        aria-pressed={notificationEnabled}
                        disabled={notificationEnabledSaving}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            notificationEnabled ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className={`text-sm ${textMuted}`}>
                        {notificationEnabled ? "Activé" : "Désactivé"}
                      </span>
                      {notificationEnabledSaving && (
                        <span className={`text-xs ${textMuted}`}>Mise à jour...</span>
                      )}
                    </div>
                    <p className={`text-xs mt-2 ${textMuted}`}>
                      Active pour recevoir les nouvelles offres par email.
                    </p>
                  </div>

                  {notificationEnabled ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>
                          Fréquence des emails
                        </label>
                        <select
                          className={inputClass}
                          value={notificationPref.notification_frequency ?? "every_3_days"}
                          onChange={(e) => {
                            const nextValue = e.target.value as Preference["notification_frequency"];
                            const nextPref = { ...notificationPref, notification_frequency: nextValue };
                            updateNotificationField("notification_frequency", nextValue);
                            void saveNotifications(nextPref);
                          }}
                        >
                          <option value="daily">Tous les jours</option>
                          <option value="every_3_days">Tous les 3 jours</option>
                          <option value="weekly">Toutes les semaines</option>
                        </select>
                        <p className={`text-xs mt-2 ${textMuted}`}>
                          Définit la cadence de réception des emails de matching.
                        </p>
                      </div>

                      <div>
                        <label className={labelClass}>
                          Nombre d'offres par email
                        </label>
                        <input
                          className={inputClass}
                          type="number"
                          min={1}
                          max={20}
                          value={notificationPref.notification_max_jobs ?? 5}
                          onChange={(e) => {
                            const parsed = Number.parseInt(e.target.value, 10);
                            if (Number.isNaN(parsed)) return;
                            const nextValue = Math.min(20, Math.max(1, parsed));
                            const nextPref = { ...notificationPref, notification_max_jobs: nextValue };
                            updateNotificationField("notification_max_jobs", nextValue);
                            void saveNotifications(nextPref);
                          }}
                        />
                        <p className={`text-xs mt-2 ${textMuted}`}>
                          Entre 1 et 20 offres par envoi.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm ${textMuted}`}>
                      Active les emails pour choisir la fréquence et le nombre d'offres.
                    </p>
                  )}
                </div>
                {notificationSaving && (
                  <div className={`mt-4 text-xs ${textMuted}`}>
                    Mise à jour des notifications...
                  </div>
                )}
              </div>
            )}

            {/* Zone de danger */}
            <div className={`rounded-2xl border p-6 ${isDark ? "border-red-700/30 bg-red-900/10" : "border-red-200 bg-red-50/50"}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-lg ${isDark ? "bg-red-900/30" : "bg-red-100"}`}>
                  <svg className={`w-5 h-5 ${isDark ? "text-red-400" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className={`text-lg font-semibold ${isDark ? "text-red-300" : "text-red-700"}`}>Zone de danger</h2>
              </div>

              <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                La suppression de ton compte est irréversible. Toutes tes données, offres sauvegardées et préférences seront définitivement supprimées.
              </p>

              <button
                type="button"
                className={`${isDark ? "rounded-xl border border-red-700 bg-red-900/40 px-4 py-2.5 font-medium text-red-200 hover:bg-red-900/60 transition-all" : "rounded-xl border border-red-300 bg-red-100 px-4 py-2.5 font-medium text-red-700 hover:bg-red-200 transition-all"}`}
                onClick={() => setConfirmDelete(true)}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer mon compte
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? "bg-[#0f1116] border border-gray-700" : "bg-white"}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${isDark ? "bg-red-900/30" : "bg-red-100"}`}>
                <svg className={`w-6 h-6 ${isDark ? "text-red-400" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                Supprimer ton compte ?
              </h3>
            </div>
            <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Cette action est définitive et supprimera toutes tes données, offres sauvegardées et préférences.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                className={btnSecondary}
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
              <button
                className={`rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 font-medium text-white transition-colors disabled:opacity-50`}
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Suppression...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Supprimer
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
