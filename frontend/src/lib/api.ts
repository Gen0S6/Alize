import { getToken, clearToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/* =========================
   API FETCH WRAPPER
   ========================= */

function redirectToLogin() {
  window.location.assign("/login");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401  || res.status === 403) {
    clearToken();
    redirectToLogin();
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      const text = await res.text();
      if (text) detail = text;
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}


export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export type Match = {
  id?: number;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  source?: string;
  description?: string | null;
  is_remote?: boolean | null;
  is_new?: boolean | null;
  created_at?: string;
};

export type Preference = {
  id: number;
  user_id: number;
  role?: string | null;
  location?: string | null;
  contract_type?: string | null;
  salary_min?: number | null;
  must_keywords?: string | null;
  avoid_keywords?: string | null;
};

export type CVLatest = {
  id: number;
  filename: string;
  created_at: string;
  text?: string | null;
  url: string;
};

export type Analysis = {
  cv_present: boolean;
  top_keywords: string[];
  inferred_roles: string[];
  suggested_queries: string[];
  must_hits: string[];
  missing_must: string[];
  summary: string;
  llm_used?: boolean;
  // Enhanced fields
  titre_poste_cible?: string | null;
  niveau_experience?: string;
  competences_techniques?: string[];
  competences_transversales?: string[];
  langues?: string[];
  formation?: string;
  secteurs_cibles?: string[];
  skills_by_category?: Record<string, string[]>;
  // Enhanced CV analysis fields
  experience_level?: string | null;
  skill_categories?: Record<string, string[]>;
  tech_skills_count?: number;
};

export type JobSearchResult = {
  inserted: number;
  tried_queries: string[];
  sources: Record<string, number>;
  analysis: Analysis;
};

export type MatchesPage = {
  items: Match[];
  total: number;
  page: number;
  page_size: number;
  available_sources?: string[];
  new_count?: number;
};

export type SortOption = "new_first" | "newest" | "score";

export type JobRun = {
  id: number;
  inserted: number;
  tried_queries: string[];
  sources: Record<string, number>;
  created_at: string;
};

export type Profile = {
  id: number;
  email: string;
  notifications_enabled: boolean;
  email_verified: boolean;
  created_at: string;
};

export type ProfileUpdatePayload = {
  email?: string;
  current_password?: string;
  new_password?: string;
  notifications_enabled?: boolean;
};

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

export async function register(email: string, password: string) {
  return http<TokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  return http<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMatches(
  page = 1,
  pageSize = 20,
  filterText = "",
  minScore = 0,
  source = "all",
  sortBy: SortOption = "new_first",
  newOnly = false
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
  });
  if (filterText) params.set("filter_text", filterText);
  if (minScore) params.set("min_score", String(minScore));
  if (source && source !== "all") params.set("source", source);
  if (newOnly) params.set("new_only", "true");
  return apiFetch(`/matches?${params.toString()}`, { method: "GET" }) as Promise<MatchesPage>;
}

export async function getMatchesCount() {
  return apiFetch("/matches/count", { method: "GET" }) as Promise<{ count: number }>;
}

export async function deleteMatch(id: number) {
  return apiFetch(`/matches/${id}`, { method: "DELETE" }) as Promise<{ deleted: boolean }>;
}

export async function markMatchVisited(id: number) {
  return apiFetch(`/matches/${id}/visit`, { method: "POST" }) as Promise<{ visited: boolean }>;
}

export async function getPreferences() {
  return apiFetch("/preferences", { method: "GET" }) as Promise<Preference>;
}

export async function updatePreferences(payload: Partial<Preference>) {
  return apiFetch("/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<Preference>;
}

export async function getLatestCV() {
  return apiFetch("/cv/latest", { method: "GET" }) as Promise<CVLatest>;
}

export async function getAnalysis(force = false) {
  const url = force ? "/ai/analysis?force=1" : "/ai/analysis";
  return apiFetch(url, { method: "GET" }) as Promise<Analysis>;
}

export async function runJobSearch() {
  return apiFetch("/jobs/search", { method: "POST" }) as Promise<JobSearchResult>;
}

export async function getJobRuns() {
  // cache-buster pour éviter un éventuel cache navigateur
  return apiFetch(`/jobs/runs?ts=${Date.now()}`, { method: "GET" }) as Promise<JobRun[]>;
}

export async function getProfile() {
  return apiFetch("/profile", { method: "GET" }) as Promise<Profile>;
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  return apiFetch("/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<Profile>;
}

// Password Reset APIs
export async function requestPasswordReset(email: string) {
  return http<{ message: string; success: boolean }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  return http<{ message: string; success: boolean }>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

// Email Verification APIs
export async function requestEmailVerification() {
  return apiFetch("/auth/email/verify/request", { method: "POST" }) as Promise<{ message: string; success: boolean }>;
}

export async function confirmEmailVerification(token: string) {
  return http<{ message: string; success: boolean }>("/auth/email/verify/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function deleteProfile() {
  return apiFetch("/profile", {
    method: "DELETE",
  }) as Promise<{ deleted: boolean }>;
}

// OAuth APIs
export type OAuthProviders = {
  google: boolean;
};

export async function getOAuthProviders() {
  return http<OAuthProviders>("/auth/oauth/providers", { method: "GET" });
}

export function getGoogleOAuthUrl() {
  return `${API_BASE}/auth/oauth/google`;
}

// ==================== Campaign Types ====================

export type Campaign = {
  id: number;
  user_id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  target_role?: string | null;
  target_location?: string | null;
  contract_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  experience_level?: string | null;
  remote_preference?: string | null;
  must_keywords?: string | null;
  nice_keywords?: string | null;
  avoid_keywords?: string | null;
  email_notifications: boolean;
  email_frequency: "instant" | "daily" | "weekly";
  min_score_for_notification: number;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  jobs_found: number;
  jobs_applied: number;
  jobs_interviewed: number;
  last_search_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignCreate = {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  target_role?: string;
  target_location?: string;
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  experience_level?: string;
  remote_preference?: string;
  must_keywords?: string;
  nice_keywords?: string;
  avoid_keywords?: string;
  email_notifications?: boolean;
  email_frequency?: "instant" | "daily" | "weekly";
  min_score_for_notification?: number;
  is_default?: boolean;
  priority?: number;
};

export type CampaignUpdate = Partial<CampaignCreate> & {
  is_active?: boolean;
};

export type CampaignListResponse = {
  campaigns: Campaign[];
  total: number;
  active_count: number;
};

export type CampaignJob = {
  id: number;
  campaign_id: number;
  job_id: number;
  score?: number | null;
  status: "new" | "saved" | "applied" | "interview" | "rejected" | "hired";
  notes?: string | null;
  applied_at?: string | null;
  interview_date?: string | null;
  visited_at?: string | null;
  created_at: string;
  updated_at: string;
  job?: Match | null;
};

export type CampaignJobsPage = {
  items: CampaignJob[];
  total: number;
  page: number;
  page_size: number;
  stats: Record<string, number>;
};

export type CampaignStats = {
  campaign_id: number;
  total_jobs: number;
  new_jobs: number;
  saved_jobs: number;
  applied_jobs: number;
  interviews: number;
  rejected: number;
  hired: number;
  avg_score?: number | null;
  response_rate?: number | null;
};

export type DashboardStats = {
  total_campaigns: number;
  active_campaigns: number;
  total_jobs_found: number;
  total_applications: number;
  total_interviews: number;
  campaigns_stats: CampaignStats[];
  recent_activity: Array<{
    type: string;
    job_id: number;
    job_title: string;
    company: string;
    campaign_id: number;
    campaign_name: string;
    status: string;
    updated_at: string | null;
  }>;
};

export type DashboardConfig = {
  id: number;
  user_id: number;
  layout?: string | null;
  default_campaign_id?: number | null;
  show_stats: boolean;
  show_recent_jobs: boolean;
  show_calendar: boolean;
  show_analytics: boolean;
  theme: "light" | "dark" | "system";
  compact_mode: boolean;
  created_at: string;
  updated_at: string;
};

export type DashboardConfigUpdate = {
  layout?: string;
  default_campaign_id?: number;
  show_stats?: boolean;
  show_recent_jobs?: boolean;
  show_calendar?: boolean;
  show_analytics?: boolean;
  theme?: "light" | "dark" | "system";
  compact_mode?: boolean;
};

export type EmailTemplate = {
  id: number;
  campaign_id: number;
  template_type: "notification" | "application" | "follow_up";
  subject?: string | null;
  body?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ==================== Campaign API Functions ====================

export async function getCampaigns(activeOnly = false) {
  const params = activeOnly ? "?active_only=true" : "";
  return apiFetch(`/campaigns${params}`, { method: "GET" }) as Promise<CampaignListResponse>;
}

export async function getCampaign(campaignId: number) {
  return apiFetch(`/campaigns/${campaignId}`, { method: "GET" }) as Promise<Campaign>;
}

export async function createCampaign(payload: CampaignCreate) {
  return apiFetch("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<Campaign>;
}

export async function updateCampaign(campaignId: number, payload: CampaignUpdate) {
  return apiFetch(`/campaigns/${campaignId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<Campaign>;
}

export async function deleteCampaign(campaignId: number) {
  return apiFetch(`/campaigns/${campaignId}`, { method: "DELETE" });
}

// Campaign Jobs
export async function getCampaignJobs(
  campaignId: number,
  page = 1,
  pageSize = 20,
  status?: string,
  minScore?: number,
  search?: string
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) params.set("status", status);
  if (minScore !== undefined) params.set("min_score", String(minScore));
  if (search) params.set("search", search);
  return apiFetch(`/campaigns/${campaignId}/jobs?${params.toString()}`, {
    method: "GET",
  }) as Promise<CampaignJobsPage>;
}

export async function addJobToCampaign(
  campaignId: number,
  jobId: number,
  status = "new",
  notes?: string
) {
  return apiFetch(`/campaigns/${campaignId}/jobs`, {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, status, notes }),
  }) as Promise<CampaignJob>;
}

export async function updateCampaignJob(
  campaignId: number,
  jobId: number,
  payload: { status?: string; notes?: string; applied_at?: string; interview_date?: string }
) {
  return apiFetch(`/campaigns/${campaignId}/jobs/${jobId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<CampaignJob>;
}

export async function removeJobFromCampaign(campaignId: number, jobId: number) {
  return apiFetch(`/campaigns/${campaignId}/jobs/${jobId}`, { method: "DELETE" });
}

// Campaign Stats
export async function getCampaignStats(campaignId: number) {
  return apiFetch(`/campaigns/${campaignId}/stats`, { method: "GET" }) as Promise<CampaignStats>;
}

export async function getDashboardStats() {
  return apiFetch("/campaigns/dashboard/stats", { method: "GET" }) as Promise<DashboardStats>;
}

// Dashboard Config
export async function getDashboardConfig() {
  return apiFetch("/campaigns/dashboard/config", { method: "GET" }) as Promise<DashboardConfig>;
}

export async function updateDashboardConfig(payload: DashboardConfigUpdate) {
  return apiFetch("/campaigns/dashboard/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<DashboardConfig>;
}

// Email Templates
export async function getCampaignTemplates(campaignId: number) {
  return apiFetch(`/campaigns/${campaignId}/templates`, { method: "GET" }) as Promise<EmailTemplate[]>;
}

export async function createEmailTemplate(payload: {
  campaign_id: number;
  template_type: string;
  subject?: string;
  body?: string;
}) {
  return apiFetch("/campaigns/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<EmailTemplate>;
}

export async function updateEmailTemplate(
  templateId: number,
  payload: { subject?: string; body?: string; is_active?: boolean }
) {
  return apiFetch(`/campaigns/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<EmailTemplate>;
}

export async function deleteEmailTemplate(templateId: number) {
  return apiFetch(`/campaigns/templates/${templateId}`, { method: "DELETE" });
}
