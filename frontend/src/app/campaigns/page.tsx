"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";
import { useToast } from "../../components/Toast";
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getDashboardStats,
  type Campaign,
  type CampaignCreate,
  type CampaignListResponse,
  type DashboardStats,
  type CampaignStats,
} from "../../lib/api";

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

const ICONS = [
  "briefcase",
  "code",
  "chart-line",
  "laptop-code",
  "users",
  "building",
  "rocket",
  "star",
];

const CONTRACT_TYPES = ["CDI", "CDD", "Freelance", "Stage", "Alternance"];
const EXPERIENCE_LEVELS = ["Junior", "Confirme", "Senior", "Lead"];
const REMOTE_OPTIONS = ["Sur site", "Hybride", "Full remote"];
const EMAIL_FREQUENCIES = [
  { value: "instant", label: "Instantane" },
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
];

export default function CampaignsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { addToast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CampaignCreate>({
    name: "",
    description: "",
    color: COLORS[0],
    icon: ICONS[0],
    target_role: "",
    target_location: "",
    contract_type: "",
    salary_min: undefined,
    salary_max: undefined,
    experience_level: "",
    remote_preference: "",
    must_keywords: "",
    nice_keywords: "",
    avoid_keywords: "",
    email_notifications: true,
    email_frequency: "daily",
    min_score_for_notification: 6,
    is_default: false,
    priority: 0,
  });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const [campaignsRes, statsRes] = await Promise.all([
        getCampaigns(),
        getDashboardStats(),
      ]);
      setCampaigns(campaignsRes.campaigns);
      setStats(statsRes);
    } catch (err: any) {
      setError(err?.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router]);

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      color: COLORS[0],
      icon: ICONS[0],
      target_role: "",
      target_location: "",
      contract_type: "",
      salary_min: undefined,
      salary_max: undefined,
      experience_level: "",
      remote_preference: "",
      must_keywords: "",
      nice_keywords: "",
      avoid_keywords: "",
      email_notifications: true,
      email_frequency: "daily",
      min_score_for_notification: 6,
      is_default: false,
      priority: 0,
    });
  }

  function openCreateModal() {
    resetForm();
    setShowCreateModal(true);
  }

  function openEditModal(campaign: Campaign) {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      color: campaign.color || COLORS[0],
      icon: campaign.icon || ICONS[0],
      target_role: campaign.target_role || "",
      target_location: campaign.target_location || "",
      contract_type: campaign.contract_type || "",
      salary_min: campaign.salary_min || undefined,
      salary_max: campaign.salary_max || undefined,
      experience_level: campaign.experience_level || "",
      remote_preference: campaign.remote_preference || "",
      must_keywords: campaign.must_keywords || "",
      nice_keywords: campaign.nice_keywords || "",
      avoid_keywords: campaign.avoid_keywords || "",
      email_notifications: campaign.email_notifications,
      email_frequency: campaign.email_frequency,
      min_score_for_notification: campaign.min_score_for_notification,
      is_default: campaign.is_default,
      priority: campaign.priority,
    });
    setShowEditModal(true);
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      addToast("Le nom de la campagne est requis", "error");
      return;
    }
    setSaving(true);
    try {
      const newCampaign = await createCampaign(formData);
      setCampaigns((prev) => [newCampaign, ...prev]);
      setShowCreateModal(false);
      resetForm();
      addToast("Campagne creee avec succes", "success");
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de la creation", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingCampaign) return;
    if (!formData.name.trim()) {
      addToast("Le nom de la campagne est requis", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCampaign(editingCampaign.id, formData);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setShowEditModal(false);
      setEditingCampaign(null);
      resetForm();
      addToast("Campagne mise a jour", "success");
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de la mise a jour", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await deleteCampaign(confirmDelete.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== confirmDelete.id));
      setConfirmDelete(null);
      addToast("Campagne supprimee", "success");
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de la suppression", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaignActive(campaign: Campaign) {
    try {
      const updated = await updateCampaign(campaign.id, {
        is_active: !campaign.is_active,
      });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      addToast(
        updated.is_active ? "Campagne activee" : "Campagne desactivee",
        "success"
      );
    } catch (err: any) {
      addToast(err?.message || "Erreur", "error");
    }
  }

  function getCampaignStats(campaignId: number): CampaignStats | undefined {
    return stats?.campaigns_stats.find((s) => s.campaign_id === campaignId);
  }

  const inputClass = `w-full px-3 py-2 rounded-lg border ${
    isDark
      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
  } focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const selectClass = `w-full px-3 py-2 rounded-lg border ${
    isDark
      ? "bg-gray-700 border-gray-600 text-white"
      : "bg-white border-gray-300 text-gray-900"
  } focus:outline-none focus:ring-2 focus:ring-blue-500`;

  if (loading) {
    return (
      <main
        className={`min-h-screen p-6 ${
          isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`p-6 rounded-xl ${
                    isDark ? "bg-gray-800" : "bg-white"
                  } shadow-sm`}
                >
                  <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-4" />
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-600 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-600 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen p-6 ${
        isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Mes Campagnes de Recherche</h1>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Gerez vos recherches d&apos;emploi personnalisees
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-900"
              } transition-colors`}
            >
              Retour au Dashboard
            </Link>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus" />
              Nouvelle Campagne
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div
              className={`p-4 rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-sm`}
            >
              <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Campagnes actives
              </div>
              <div className="text-2xl font-bold text-blue-500">
                {stats.active_campaigns}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-sm`}
            >
              <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Offres trouvees
              </div>
              <div className="text-2xl font-bold text-green-500">
                {stats.total_jobs_found}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-sm`}
            >
              <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Candidatures
              </div>
              <div className="text-2xl font-bold text-amber-500">
                {stats.total_applications}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-sm`}
            >
              <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Entretiens
              </div>
              <div className="text-2xl font-bold text-purple-500">
                {stats.total_interviews}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Campaigns Grid */}
        {campaigns.length === 0 ? (
          <div
            className={`p-12 rounded-xl text-center ${
              isDark ? "bg-gray-800" : "bg-white"
            } shadow-sm`}
          >
            <i className="fas fa-folder-open text-4xl text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune campagne</h3>
            <p className={`${isDark ? "text-gray-400" : "text-gray-600"} mb-4`}>
              Creez votre premiere campagne de recherche d&apos;emploi personnalisee
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Creer une campagne
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const campaignStats = getCampaignStats(campaign.id);
              return (
                <div
                  key={campaign.id}
                  className={`p-6 rounded-xl ${
                    isDark ? "bg-gray-800" : "bg-white"
                  } shadow-sm border-l-4 transition-all hover:shadow-md`}
                  style={{ borderLeftColor: campaign.color || COLORS[0] }}
                >
                  {/* Campaign Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${campaign.color}20` }}
                      >
                        <i
                          className={`fas fa-${campaign.icon || "briefcase"}`}
                          style={{ color: campaign.color ?? undefined }}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        {campaign.is_default && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                            Par defaut
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCampaignActive(campaign)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${
                          campaign.is_active
                            ? "bg-green-500"
                            : isDark
                            ? "bg-gray-600"
                            : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            campaign.is_active ? "right-1" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Campaign Details */}
                  <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"} space-y-1 mb-4`}>
                    {campaign.target_role && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-user-tie w-4" />
                        <span>{campaign.target_role}</span>
                      </div>
                    )}
                    {campaign.target_location && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-map-marker-alt w-4" />
                        <span>{campaign.target_location}</span>
                      </div>
                    )}
                    {campaign.contract_type && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-file-contract w-4" />
                        <span>{campaign.contract_type}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className={`p-2 rounded-lg text-center ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                      <div className="text-lg font-bold text-blue-500">
                        {campaignStats?.total_jobs || campaign.jobs_found}
                      </div>
                      <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        Offres
                      </div>
                    </div>
                    <div className={`p-2 rounded-lg text-center ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                      <div className="text-lg font-bold text-amber-500">
                        {campaignStats?.applied_jobs || campaign.jobs_applied}
                      </div>
                      <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        Postule
                      </div>
                    </div>
                    <div className={`p-2 rounded-lg text-center ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                      <div className="text-lg font-bold text-green-500">
                        {campaignStats?.interviews || campaign.jobs_interviewed}
                      </div>
                      <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        Entretiens
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Voir les offres
                    </Link>
                    <button
                      onClick={() => openEditModal(campaign)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        isDark
                          ? "bg-gray-700 hover:bg-gray-600 text-white"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                      }`}
                    >
                      <i className="fas fa-edit" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(campaign)}
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } p-6`}
            >
              <h2 className="text-xl font-bold mb-6">
                {showCreateModal ? "Nouvelle Campagne" : "Modifier la Campagne"}
              </h2>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-500 uppercase">
                    Informations
                  </h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Nom de la campagne *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ex: Recherche Dev Python Paris"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Description optionnelle..."
                      rows={2}
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Couleur
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setFormData({ ...formData, color })}
                            className={`w-8 h-8 rounded-lg transition-transform ${
                              formData.color === color
                                ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                                : ""
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Icone
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {ICONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setFormData({ ...formData, icon })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              formData.icon === icon
                                ? "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/30"
                                : isDark
                                ? "bg-gray-700"
                                : "bg-gray-100"
                            }`}
                          >
                            <i
                              className={`fas fa-${icon}`}
                              style={{
                                color:
                                  formData.icon === icon
                                    ? formData.color
                                    : undefined,
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Criteria */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-500 uppercase">
                    Criteres de recherche
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Poste cible
                      </label>
                      <input
                        type="text"
                        value={formData.target_role}
                        onChange={(e) =>
                          setFormData({ ...formData, target_role: e.target.value })
                        }
                        placeholder="Ex: Developpeur Python"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Localisation
                      </label>
                      <input
                        type="text"
                        value={formData.target_location}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            target_location: e.target.value,
                          })
                        }
                        placeholder="Ex: Paris, Lyon, Remote"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Type de contrat
                      </label>
                      <select
                        value={formData.contract_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contract_type: e.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="">Tous</option>
                        {CONTRACT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Experience
                      </label>
                      <select
                        value={formData.experience_level}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            experience_level: e.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="">Tous niveaux</option>
                        {EXPERIENCE_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Teletravail
                      </label>
                      <select
                        value={formData.remote_preference}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            remote_preference: e.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="">Tous</option>
                        {REMOTE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Salaire minimum
                      </label>
                      <input
                        type="number"
                        value={formData.salary_min || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            salary_min: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="Ex: 40000"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Salaire maximum
                      </label>
                      <input
                        type="number"
                        value={formData.salary_max || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            salary_max: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="Ex: 60000"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Keywords */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-500 uppercase">
                    Mots-cles
                  </h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mots-cles obligatoires
                    </label>
                    <input
                      type="text"
                      value={formData.must_keywords}
                      onChange={(e) =>
                        setFormData({ ...formData, must_keywords: e.target.value })
                      }
                      placeholder="Ex: Python, Django, PostgreSQL (separes par virgule)"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mots-cles souhaites
                    </label>
                    <input
                      type="text"
                      value={formData.nice_keywords}
                      onChange={(e) =>
                        setFormData({ ...formData, nice_keywords: e.target.value })
                      }
                      placeholder="Ex: Docker, AWS, CI/CD"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mots-cles a eviter
                    </label>
                    <input
                      type="text"
                      value={formData.avoid_keywords}
                      onChange={(e) =>
                        setFormData({ ...formData, avoid_keywords: e.target.value })
                      }
                      placeholder="Ex: PHP, Wordpress"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Notifications */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-500 uppercase">
                    Notifications
                  </h3>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Recevoir des notifications par email
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          email_notifications: !formData.email_notifications,
                        })
                      }
                      className={`w-12 h-6 rounded-full relative transition-colors ${
                        formData.email_notifications
                          ? "bg-green-500"
                          : isDark
                          ? "bg-gray-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          formData.email_notifications ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                  {formData.email_notifications && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Frequence
                        </label>
                        <select
                          value={formData.email_frequency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              email_frequency: e.target.value as any,
                            })
                          }
                          className={selectClass}
                        >
                          {EMAIL_FREQUENCIES.map((freq) => (
                            <option key={freq.value} value={freq.value}>
                              {freq.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Score minimum pour notifier
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={formData.min_score_for_notification}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              min_score_for_notification: parseInt(e.target.value) || 0,
                            })
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Default Campaign */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Definir comme campagne par defaut
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_default: !formData.is_default,
                      })
                    }
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      formData.is_default
                        ? "bg-blue-500"
                        : isDark
                        ? "bg-gray-600"
                        : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.is_default ? "right-1" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setEditingCampaign(null);
                    resetForm();
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? "bg-gray-700 hover:bg-gray-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                  } transition-colors`}
                >
                  Annuler
                </button>
                <button
                  onClick={showCreateModal ? handleCreate : handleUpdate}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <i className="fas fa-spinner fa-spin" />
                      Enregistrement...
                    </span>
                  ) : showCreateModal ? (
                    "Creer la campagne"
                  ) : (
                    "Enregistrer"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              className={`w-full max-w-md rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } p-6`}
            >
              <h2 className="text-xl font-bold mb-4">Supprimer la campagne ?</h2>
              <p className={`${isDark ? "text-gray-400" : "text-gray-600"} mb-6`}>
                Etes-vous sur de vouloir supprimer la campagne &quot;
                {confirmDelete.name}&quot; ? Cette action est irreversible et
                supprimera toutes les offres associees.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? "bg-gray-700 hover:bg-gray-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                  } transition-colors`}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
