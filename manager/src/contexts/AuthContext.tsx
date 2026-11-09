import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AuthUser,
  loginManager,
  refreshSession,
  logoutManager,
  getAccessToken
} from '../services/auth';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refresh: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = async () => {
    try {
      const res = await refreshSession();
      if (res.status === 'success' && res.data?.user) {
        if (['manager', 'admin'].includes(res.data.user.role)) {
          setUser(res.data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const res = await loginManager(email, pass);
      if (res.status === 'success' && res.data?.user) {
        if (!['manager', 'admin'].includes(res.data.user.role)) {
          await logoutManager();
          setUser(null);
          return {
            success: false,
            message: `Account role '${res.data.user.role}' is not authorized to access Manager Web. Role 'manager' required.`
          };
        }
        setUser(res.data.user);
        return { success: true };
      }

      let msg = res.message || 'Login failed';
      if (res.statusCode === 401) {
        msg = 'Invalid credentials.';
      } else if (res.statusCode === 503) {
        msg = 'Authentication service temporarily unavailable. Please try again.';
      } else if (res.statusCode === 500) {
        msg = 'An unexpected server error occurred.';
      } else if (res.statusCode === 400) {
        msg = res.message || 'Please provide valid login credentials.';
      }

      return { success: false, message: msg };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await logoutManager();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!getAccessToken(),
        isLoading,
        login,
        logout,
        refresh
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

