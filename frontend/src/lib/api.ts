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
};

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

export async function getMatches(page = 1, pageSize = 20, filterText = "", minScore = 0, source = "all") {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filterText) params.set("filter_text", filterText);
  if (minScore) params.set("min_score", String(minScore));
  if (source && source !== "all") params.set("source", source);
  return apiFetch(`/matches?${params.toString()}`, { method: "GET" }) as Promise<MatchesPage>;
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
