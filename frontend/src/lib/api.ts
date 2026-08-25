/**
 * HTTP client for the Chitra AI API.
 *
 * Token handling mirrors the backend contract in `accounts/views.py`:
 * the access token lives in this module's memory only -- never in
 * localStorage, where an XSS payload could read it -- and the refresh token
 * is an httpOnly cookie this code cannot see. A reload therefore starts with
 * no access token and calls `refresh()`, which the browser answers with the
 * cookie.
 */

import type {
  AuthResult,
  GeneratedImage,
  GenerationInput,
  GenerationOptions,
  Paginated,
  User,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, code: string, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** First message for a field, if the server flagged one. */
  fieldError(name: string): string | undefined {
    return this.fieldErrors[name]?.[0];
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

/* -------------------------------------------------------------------------
   Access token, held in memory only.
------------------------------------------------------------------------- */

let accessToken: string | null = null;
let onSessionEnded: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Registered by the auth provider so a dead session can clear app state. */
export function setSessionEndedHandler(handler: (() => void) | null) {
  onSessionEnded = handler;
}

/* -------------------------------------------------------------------------
   Request plumbing
------------------------------------------------------------------------- */

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the automatic refresh-and-retry. Used by refresh() itself. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

function parseErrorBody(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "error";
    const detail = typeof record.detail === "string" ? record.detail : null;

    const fieldErrors: FieldErrors = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "detail" || key === "code") continue;
      if (Array.isArray(value)) {
        fieldErrors[key] = value.map(String);
      } else if (typeof value === "string") {
        fieldErrors[key] = [value];
      }
    }

    const firstField = Object.values(fieldErrors)[0]?.[0];
    return new ApiError(status, code, detail ?? firstField ?? fallbackMessage(status), fieldErrors);
  }
  return new ApiError(status, "error", fallbackMessage(status));
}

function fallbackMessage(status: number) {
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You do not have access to that.";
  if (status === 404) return "That item no longer exists.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Something went wrong. Please try again.";
}

/** In-flight refresh, shared so parallel 401s trigger exactly one round trip. */
let refreshInFlight: Promise<AuthResult | null> | null = null;

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = "GET", body, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      // Sends and accepts the httpOnly refresh cookie across origins.
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "network_error",
      "Could not reach Chitra AI. Check your connection and try again.",
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) throw parseErrorBody(response.status, payload);
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (error) {
    const isExpiredAccess =
      error instanceof ApiError && error.status === 401 && !options.skipRefresh;
    if (!isExpiredAccess) throw error;

    const renewed = await refreshOnce();
    if (!renewed) {
      onSessionEnded?.();
      throw error;
    }
    return rawRequest<T>(path, { ...options, skipRefresh: true });
  }
}

async function refreshOnce(): Promise<AuthResult | null> {
  refreshInFlight ??= (async () => {
    try {
      const result = await rawRequest<AuthResult>("/api/auth/refresh/", {
        method: "POST",
        skipRefresh: true,
      });
      accessToken = result.access;
      return result;
    } catch {
      accessToken = null;
      return null;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all see it.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

/* -------------------------------------------------------------------------
   Endpoints
------------------------------------------------------------------------- */

export const api = {
  register(input: { email: string; password: string; display_name?: string }) {
    return request<AuthResult>("/api/auth/register/", { method: "POST", body: input });
  },

  login(input: { email: string; password: string }) {
    return request<AuthResult>("/api/auth/login/", {
      method: "POST",
      body: input,
      skipRefresh: true,
    });
  },

  /** Restores a session on cold load using the refresh cookie alone. */
  restoreSession() {
    return refreshOnce();
  },

  async logout() {
    try {
      await request<void>("/api/auth/logout/", { method: "POST", skipRefresh: true });
    } finally {
      accessToken = null;
    }
  },

  me() {
    return request<User>("/api/auth/me/");
  },

  updateProfile(input: { display_name: string }) {
    return request<User>("/api/auth/me/", { method: "PATCH", body: input });
  },

  changePassword(input: { current_password: string; new_password: string }) {
    return request<AuthResult>("/api/auth/password/", { method: "POST", body: input });
  },

  options() {
    return request<GenerationOptions>("/api/images/options/");
  },

  generate(input: GenerationInput, signal?: AbortSignal) {
    return request<GeneratedImage>("/api/images/generate/", {
      method: "POST",
      body: input,
      signal,
    });
  },

  history(page = 1, pageSize = 12) {
    return request<Paginated<GeneratedImage>>(
      `/api/images/?page=${page}&page_size=${pageSize}`,
    );
  },

  image(id: number) {
    return request<GeneratedImage>(`/api/images/${id}/`);
  },

  remove(id: number) {
    return request<void>(`/api/images/${id}/`, { method: "DELETE" });
  },
};

export { BASE as API_BASE_URL };
