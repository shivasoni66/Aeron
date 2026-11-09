/**
 * AERON Admin Web — Authentication Service & Contracts
 * Role: 'admin'
 * Transport: HttpOnly Cookie for Refresh Token, In-Memory for Access Token.
 */

export type UserRole = 'admin' | 'manager' | 'citizen';
export type AccountStatus = 'active' | 'suspended' | 'pending';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  profileImageUrl?: string;
  createdAt?: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message?: string;
  data?: {
    accessToken: string;
    tokenType: 'Bearer';
    expiresInSeconds: number;
    sessionId: string;
    csrfToken?: string;
    user: AuthUser;
  };
}

let inMemoryAccessToken: string | null = null;
let currentCsrfToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setCsrfToken = (csrf: string | null) => {
  currentCsrfToken = csrf;
};

export const getCsrfToken = (): string | null => {
  return currentCsrfToken;
};

import { API_BASE_URL } from './api';

export const loginAdmin = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', // Includes HttpOnly refresh token cookie
    body: JSON.stringify({ email, password, clientType: 'WEB' })
  });

  const data: AuthResponse = await res.json();
  if (data.status === 'success' && data.data?.accessToken) {
    setAccessToken(data.data.accessToken);
    if (data.data.csrfToken) {
      setCsrfToken(data.data.csrfToken);
    }
  }
  return data;
};

export const refreshSession = async (): Promise<AuthResponse> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers,
    credentials: 'include'
  });

  const data: AuthResponse = await res.json();
  if (data.status === 'success' && data.data?.accessToken) {
    setAccessToken(data.data.accessToken);
    if (data.data.csrfToken) {
      setCsrfToken(data.data.csrfToken);
    }
  } else {
    setAccessToken(null);
  }
  return data;
};

export const logoutAdmin = async (): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }
  if (currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }

  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers,
    credentials: 'include'
  });

  setAccessToken(null);
  setCsrfToken(null);
};

