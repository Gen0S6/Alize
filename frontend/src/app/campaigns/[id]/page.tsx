"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "../../../lib/auth";
import { useTheme } from "../../ThemeProvider";
import { useToast } from "../../../components/Toast";
import {
  getCampaign,
  getCampaignJobs,
  getCampaignStats,
  updateCampaignJob,
  removeJobFromCampaign,
  type Campaign,
  type CampaignJob,
  type CampaignJobsPage,
  type CampaignStats,
} from "../../../lib/api";

const STATUS_OPTIONS = [
  { value: "new", label: "Nouveau", color: "blue" },
  { value: "saved", label: "Sauvegarde", color: "gray" },
  { value: "applied", label: "Postule", color: "amber" },
  { value: "interview", label: "Entretien", color: "purple" },
  { value: "rejected", label: "Refuse", color: "red" },
  { value: "hired", label: "Accepte", color: "green" },
];

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = parseInt(params.id as string);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { addToast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [jobs, setJobs] = useState<CampaignJob[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [jobStats, setJobStats] = useState<Record<string, number>>({});

  // Modal states
  const [editingJob, setEditingJob] = useState<CampaignJob | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CampaignJob | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadCampaign() {
    try {
      const data = await getCampaign(campaignId);
      setCampaign(data);
    } catch (err: any) {
      setError(err?.message || "Erreur lors du chargement");
    }
  }

  async function loadJobs() {
    setLoading(true);
    try {
      const data = await getCampaignJobs(
        campaignId,
        page,
        pageSize,
        statusFilter || undefined,
        undefined,
        searchText || undefined
      );
      setJobs(data.items);
      setTotal(data.total);
      setJobStats(data.stats);
    } catch (err: any) {
      setError(err?.message || "Erreur lors du chargement des offres");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await getCampaignStats(campaignId);
      setStats(data);
    } catch (err: any) {
      console.error("Error loading stats:", err);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    if (!campaignId || isNaN(campaignId)) {
      router.push("/campaigns");
      return;
    }
    Promise.all([loadCampaign(), loadJobs(), loadStats()]);
  }, [router, campaignId]);

  useEffect(() => {
    loadJobs();
  }, [page, statusFilter, searchText]);

  async function handleUpdateStatus(job: CampaignJob, newStatus: string) {
    try {
      const updated = await updateCampaignJob(campaignId, job.job_id, {
        status: newStatus,
        applied_at: newStatus === "applied" ? new Date().toISOString() : undefined,
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? updated : j))
      );
      addToast("Statut mis a jour", "success");
      loadStats();
    } catch (err: any) {
      addToast(err?.message || "Erreur", "error");
    }
  }

  async function handleSaveNotes() {
    if (!editingJob) return;
    setSaving(true);
    try {
      const updated = await updateCampaignJob(campaignId, editingJob.job_id, {
        notes: editingJob.notes || undefined,
        interview_date: editingJob.interview_date || undefined,
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? updated : j))
      );
      setEditingJob(null);
      addToast("Notes enregistrees", "success");
    } catch (err: any) {
      addToast(err?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteJob() {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await removeJobFromCampaign(campaignId, confirmDelete.job_id);
      setJobs((prev) => prev.filter((j) => j.id !== confirmDelete.id));
      setConfirmDelete(null);
      addToast("Offre supprimee", "success");
      loadStats();
    } catch (err: any) {
      addToast(err?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  function getStatusColor(status: string) {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    return opt?.color || "gray";
  }

  function getStatusLabel(status: string) {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    return opt?.label || status;
  }

  const totalPages = Math.ceil(total / pageSize);

  if (!campaign && !loading && !error) {
    return (
      <main
        className={`min-h-screen p-6 ${
          isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
        }`}
      >
        <div className="max-w-7xl mx-auto text-center py-12">
          <h1 className="text-xl font-bold">Campagne introuvable</h1>
          <Link href="/campaigns" className="text-blue-500 hover:underline mt-4 inline-block">
            Retour aux campagnes
          </Link>
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
        <div className="mb-8">
          <Link
            href="/campaigns"
            className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"} hover:underline mb-2 inline-block`}
          >
            &larr; Retour aux campagnes
          </Link>
          {campaign && (
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${campaign.color}20` }}
              >
                <i
                  className={`fas fa-${campaign.icon || "briefcase"} text-xl`}
                  style={{ color: campaign.color ?? undefined }}
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
                <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {campaign.target_role && <span>{campaign.target_role}</span>}
                  {campaign.target_role && campaign.target_location && " - "}
                  {campaign.target_location && <span>{campaign.target_location}</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {STATUS_OPTIONS.map((status) => {
              const count =
                status.value === "new"
                  ? stats.new_jobs
                  : status.value === "saved"
                  ? stats.saved_jobs
                  : status.value === "applied"
                  ? stats.applied_jobs
                  : status.value === "interview"
                  ? stats.interviews
                  : status.value === "rejected"
                  ? stats.rejected
                  : status.value === "hired"
                  ? stats.hired
                  : jobStats[status.value] || 0;
              return (
                <button
                  key={status.value}
                  onClick={() =>
                    setStatusFilter(statusFilter === status.value ? "" : status.value)
                  }
                  className={`p-3 rounded-lg text-center transition-all ${
                    statusFilter === status.value
                      ? `ring-2 ring-${status.color}-500`
                      : ""
                  } ${isDark ? "bg-gray-800" : "bg-white"} shadow-sm hover:shadow-md`}
                >
                  <div className={`text-lg font-bold text-${status.color}-500`}>
                    {count}
                  </div>
                  <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {status.label}
                  </div>
                </button>
              );
            })}
            <div
              className={`p-3 rounded-lg text-center ${
                isDark ? "bg-gray-800" : "bg-white"
              } shadow-sm`}
            >
              <div className="text-lg font-bold">{stats.total_jobs}</div>
              <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Total
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div
          className={`p-4 rounded-xl mb-6 ${
            isDark ? "bg-gray-800" : "bg-white"
          } shadow-sm`}
        >
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher par titre ou entreprise..."
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Tous les statuts</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Jobs List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`p-4 rounded-xl ${
                  isDark ? "bg-gray-800" : "bg-white"
                } shadow-sm animate-pulse`}
              >
                <div className="h-5 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div
            className={`p-12 rounded-xl text-center ${
              isDark ? "bg-gray-800" : "bg-white"
            } shadow-sm`}
          >
            <i className="fas fa-inbox text-4xl text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune offre</h3>
            <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {statusFilter
                ? "Aucune offre avec ce statut"
                : "Cette campagne n'a pas encore d'offres"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((campaignJob) => {
              const job = campaignJob.job;
              if (!job) return null;
              const statusColor = getStatusColor(campaignJob.status);
              return (
                <div
                  key={campaignJob.id}
                  className={`p-4 rounded-xl ${
                    isDark ? "bg-gray-800" : "bg-white"
                  } shadow-sm border-l-4 transition-all hover:shadow-md`}
                  style={{
                    borderLeftColor:
                      statusColor === "blue"
                        ? "#3B82F6"
                        : statusColor === "amber"
                        ? "#F59E0B"
                        : statusColor === "purple"
                        ? "#8B5CF6"
                        : statusColor === "red"
                        ? "#EF4444"
                        : statusColor === "green"
                        ? "#10B981"
                        : "#6B7280",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold hover:text-blue-500 truncate"
                        >
                          {job.title}
                        </a>
                        {campaignJob.score != null && (
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              campaignJob.score >= 7
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : campaignJob.score >= 4
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {campaignJob.score}/10
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        <span className="font-medium">{job.company}</span>
                        {job.location && (
                          <>
                            {" "}
                            <span className="mx-1">/</span> {job.location}
                          </>
                        )}
                      </div>
                      {campaignJob.notes && (
                        <div
                          className={`mt-2 text-sm p-2 rounded ${
                            isDark ? "bg-gray-700" : "bg-gray-100"
                          }`}
                        >
                          <i className="fas fa-sticky-note mr-2 text-amber-500" />
                          {campaignJob.notes}
                        </div>
                      )}
                      {campaignJob.interview_date && (
                        <div className="mt-2 text-sm text-purple-500">
                          <i className="fas fa-calendar-alt mr-2" />
                          Entretien:{" "}
                          {new Date(campaignJob.interview_date).toLocaleDateString(
                            "fr-FR",
                            {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={campaignJob.status}
                        onChange={(e) =>
                          handleUpdateStatus(campaignJob, e.target.value)
                        }
                        className={`px-3 py-1.5 text-sm rounded-lg border ${
                          isDark
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-white border-gray-300 text-gray-900"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingJob(campaignJob)}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark
                            ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                            : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                        }`}
                        title="Ajouter des notes"
                      >
                        <i className="fas fa-edit" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(campaignJob)}
                        className={`p-2 rounded-lg transition-colors text-red-500 ${
                          isDark ? "hover:bg-red-900/30" : "hover:bg-red-100"
                        }`}
                        title="Supprimer"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? "bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800"
                  : "bg-white hover:bg-gray-100 disabled:bg-white"
              } disabled:opacity-50 shadow-sm`}
            >
              Precedent
            </button>
            <span
              className={`px-4 py-2 ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? "bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800"
                  : "bg-white hover:bg-gray-100 disabled:bg-white"
              } disabled:opacity-50 shadow-sm`}
            >
              Suivant
            </button>
          </div>
        )}

        {/* Edit Notes Modal */}
        {editingJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              className={`w-full max-w-lg rounded-xl ${
                isDark ? "bg-gray-800" : "bg-white"
              } p-6`}
            >
              <h2 className="text-xl font-bold mb-4">
                Notes pour {editingJob.job?.title}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={editingJob.notes || ""}
                    onChange={(e) =>
                      setEditingJob({ ...editingJob, notes: e.target.value })
                    }
                    rows={4}
                    placeholder="Ajoutez vos notes personnelles..."
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                {(editingJob.status === "interview" ||
                  editingJob.status === "applied") && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date d&apos;entretien
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        editingJob.interview_date
                          ? editingJob.interview_date.slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setEditingJob({
                          ...editingJob,
                          interview_date: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditingJob(null)}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? "bg-gray-700 hover:bg-gray-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                  } transition-colors`}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
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
              <h2 className="text-xl font-bold mb-4">Retirer cette offre ?</h2>
              <p className={`${isDark ? "text-gray-400" : "text-gray-600"} mb-6`}>
                Voulez-vous retirer &quot;{confirmDelete.job?.title}&quot; de
                cette campagne ?
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
                  onClick={handleDeleteJob}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Suppression..." : "Retirer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
