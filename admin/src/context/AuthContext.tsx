import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, loginAdmin, refreshSession, logoutAdmin, getAccessToken } from '../services/auth';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Attempt silent session refresh on application load
    const initAuth = async () => {
      try {
        const res = await refreshSession();
        if (res.status === 'success' && res.data?.user) {
          setUser(res.data.user);
        } else {
          setUser(null);
        }
      } catch (_) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await loginAdmin(email, password);
      if (res.status === 'success' && res.data?.user) {
        setUser(res.data.user);
        return true;
      } else {
        setError(res.message || 'Authentication failed');
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      return false;
    }
  };

  const logout = async () => {
    try {
      await logoutAdmin();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!getAccessToken(),
        isAdmin: user?.role === 'admin',
        loading,
        error,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

