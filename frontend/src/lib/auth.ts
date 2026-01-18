const TOKEN_KEY = "jobapp_token_v1";

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  try {
    window.dispatchEvent(new Event("token_changed"));
  } catch (_err) {
    // ignore
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  try {
    window.dispatchEvent(new Event("token_changed"));
  } catch (_err) {
    // ignore
  }
}

// Dispatch a custom event for client-side navigation (avoids full page reload)
export function navigateTo(path: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app_navigate", { detail: { path } }));
  }
}

export function clearTokenAndRedirectHome() {
  clearToken();
  navigateTo("/");
}

export function redirectToLogin() {
  navigateTo("/login");
}

export function isAuthed(): boolean {
  return !!getToken();
}
