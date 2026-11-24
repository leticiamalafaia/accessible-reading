import { AuthStatusResponse, AuthUser } from "../types/reader";

// Session token lives strictly in JS memory (never persisted to localStorage/sessionStorage)
let inMemoryAuthToken: string | null = null;

export function getAuthToken(): string | null {
  return inMemoryAuthToken;
}

export function setAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
}

export function clearAuthToken(): void {
  inMemoryAuthToken = null;
}

export function getAuthHeaders(): Record<string, string> {
  return inMemoryAuthToken
    ? { Authorization: `Bearer ${inMemoryAuthToken}` }
    : {};
}

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function parseAuthJson<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const response = await fetch("/api/auth/status", {
    method: "GET",
    cache: "no-store",
  });
  const data = await parseAuthJson<AuthStatusResponse & { error?: string }>(
    response
  );
  if (!response.ok || !data) {
    throw new AuthApiError(
      data?.error || "Não foi possível verificar o status de acesso do servidor.",
      response.status
    );
  }
  return data;
}

export async function setupAdminAccount(params: {
  name: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch("/api/auth/setup-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseAuthJson<{
    token?: string;
    user?: AuthUser;
    error?: string;
  }>(response);
  if (!response.ok || !data?.token || !data?.user) {
    throw new AuthApiError(
      data?.error || "Não foi possível ativar sua conta agora.",
      response.status
    );
  }
  setAuthToken(data.token);
  return { token: data.token, user: data.user };
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseAuthJson<{
    token?: string;
    user?: AuthUser;
    error?: string;
  }>(response);
  if (!response.ok || !data?.token || !data?.user) {
    throw new Error(data?.error || "E-mail ou senha inválidos.");
  }
  setAuthToken(data.token);
  return { token: data.token, user: data.user };
}

export async function registerAccount(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseAuthJson<{
    token?: string;
    user?: AuthUser;
    error?: string;
  }>(response);
  if (!response.ok || !data?.token || !data?.user) {
    throw new Error(data?.error || "Não foi possível criar a conta agora.");
  }
  setAuthToken(data.token);
  return { token: data.token, user: data.user };
}

export async function changeAccountPassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ user: AuthUser; message: string }> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await parseAuthJson<{
    token?: string;
    user?: AuthUser;
    message?: string;
    error?: string;
  }>(response);
  if (!response.ok || !data?.token || !data?.user) {
    throw new Error(data?.error || "Não foi possível alterar a senha.");
  }
  setAuthToken(data.token);
  return {
    user: data.user,
    message: data.message || "Senha alterada com sucesso.",
  };
}

export async function logoutSession(allSessions = false): Promise<void> {
  try {
    if (inMemoryAuthToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ allSessions }),
      });
    }
  } catch {
    // Always clear client session memory even if network fails
  } finally {
    clearAuthToken();
  }
}
