/**
 * AERON Manager Web — Authentication Service & Contracts
 * Role: 'manager'
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
  statusCode?: number;
  code?: string;
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

export const loginManager = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, clientType: 'WEB' })
    });

    const data: AuthResponse = await res.json().catch(() => ({
      status: 'error',
      message: res.status === 503
        ? 'Authentication service temporarily unavailable. Please try again.'
        : 'An unexpected server error occurred.'
    }));

    data.statusCode = res.status;

    if (res.status === 200 && data.status === 'success' && data.data?.accessToken) {
      setAccessToken(data.data.accessToken);
      if (data.data.csrfToken) {
        setCsrfToken(data.data.csrfToken);
      }
    }
    return data;
  } catch (err: unknown) {
    return {
      status: 'error',
      statusCode: 0,
      message: 'Network connection failure. Unable to reach authentication server.'
    };
  }
};

export const refreshSession = async (): Promise<AuthResponse> => {
  try {
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

    const data: AuthResponse = await res.json().catch(() => ({
      status: 'error',
      message: 'Session refresh failed'
    }));

    data.statusCode = res.status;

    if (res.status === 200 && data.status === 'success' && data.data?.accessToken) {
      setAccessToken(data.data.accessToken);
      if (data.data.csrfToken) {
        setCsrfToken(data.data.csrfToken);
      }
    } else {
      setAccessToken(null);
    }
    return data;
  } catch {
    setAccessToken(null);
    return {
      status: 'error',
      statusCode: 0,
      message: 'Session refresh network error'
    };
  }
};

export const logoutManager = async (): Promise<void> => {
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

