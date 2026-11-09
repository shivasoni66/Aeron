import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-space-md">
        <div className="w-12 h-12 rounded-full border-2 border-primary-container border-t-transparent animate-spin"></div>
        <span className="font-label-telemetry text-label-telemetry text-primary-fixed uppercase tracking-wider">
          ESTABLISHING SECURE GCS SESSION...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!isAdmin) {
    return <AccessDeniedPage />;
  }

  return <Outlet />;
};
