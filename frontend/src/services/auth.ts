import type { AuthUser, UserRole } from "../types";

// Same-origin by default: the frontend's own Nginx reverse-proxies /api to the backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TOKEN_KEY = "cloudops_token";
const USER_KEY = "cloudops_user";

interface AuthResponse {
  token: string;
  username: string;
  role: UserRole;
}

async function authRequest(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Invalid username or password" : `Request failed (${response.status})`);
  }
  return response.json() as Promise<AuthResponse>;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  return persist(await authRequest("/auth/login", { username, password }));
}

export async function register(username: string, password: string, role: UserRole): Promise<AuthUser> {
  return persist(await authRequest("/auth/register", { username, password, role }));
}

function persist(auth: AuthResponse): AuthUser {
  const user: AuthUser = { username: auth.username, role: auth.role };
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
