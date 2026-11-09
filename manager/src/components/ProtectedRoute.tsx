import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-label-telemetry text-primary-fixed gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary-fixed border-t-transparent animate-spin"></div>
        <div className="text-xs tracking-widest uppercase">INITIALIZING AERON MISSION INTELLIGENCE...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!['manager', 'admin'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 font-label-telemetry">
        <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[32px]">block</span>
        </div>
        <h2 className="text-xl font-bold text-primary mb-2">ACCESS RESTRICTED</h2>
        <p className="text-on-surface-variant max-w-md text-xs mb-6">
          Your current account role (<strong className="text-error">{user.role}</strong>) does not have clearance for the AERON Mission Intelligence Command Deck.
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-primary-fixed text-on-primary-fixed font-bold rounded"
        >
          RETURN TO LOGIN
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

