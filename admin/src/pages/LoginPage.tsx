import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, error, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      const ok = await login(email, password);
      if (ok) {
        navigate('/', { replace: true });
      } else {
        setLocalError(error || 'Authentication rejected. Verify credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-gutter select-none">
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/30 rounded p-space-lg shadow-xl relative overflow-hidden">
        {/* Aerospace Watermark */}
        <div className="absolute -right-4 -bottom-6 font-display-hero text-7xl text-surface-container-highest/20 pointer-events-none">
          AERON
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-space-sm mb-space-md">
          <div className="w-3.5 h-3.5 rounded-full bg-primary-container shadow-[0_0_12px_#bff42e]"></div>
          <div>
            <h1 className="font-headline-md text-headline-md tracking-wider text-primary">AERON</h1>
            <p className="font-label-telemetry text-[11px] text-primary-fixed uppercase tracking-wider">
              DRONE INTELLIGENCE // GCS-SYS
            </p>
          </div>
        </div>

        <div className="mb-space-md p-space-sm bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
          <span className="font-label-telemetry text-label-telemetry text-on-surface-variant block uppercase">
            RESTRICTED ACCESS PORTAL
          </span>
          <span className="font-body-sm text-body-sm text-secondary">
            Authorized administrator credentials required for hardware bus & flight telemetry access.
          </span>
        </div>

        {(localError || error) && (
          <div className="mb-space-md p-space-sm bg-error-container/20 border border-error/40 rounded text-error font-label-telemetry text-label-telemetry flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-space-md">
          <div>
            <label className="block font-label-telemetry text-label-telemetry text-on-surface-variant uppercase mb-1">
              Operator Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@aeron.gov"
              required
              className="w-full px-space-md py-space-sm bg-surface-container-lowest border border-surface-container-highest rounded text-on-surface font-label-telemetry text-body-sm focus:outline-none focus:border-primary-fixed transition-colors"
            />
          </div>

          <div>
            <label className="block font-label-telemetry text-label-telemetry text-on-surface-variant uppercase mb-1">
              Access Key / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-space-md py-space-sm bg-surface-container-lowest border border-surface-container-highest rounded text-on-surface font-label-telemetry text-body-sm focus:outline-none focus:border-primary-fixed transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-space-sm px-space-md rounded bg-primary-container text-on-primary-container font-label-pill text-label-pill tracking-wider uppercase font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary-fixed-dim transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin"></span>
                <span>VERIFYING CREDENTIALS...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                <span>AUTHENTICATE OPERATOR</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-space-lg pt-space-sm border-t border-surface-container-highest/60 flex items-center justify-between text-[10px] font-label-telemetry text-on-surface-variant">
          <span>SECURE MAVLINK BUS</span>
          <span>AERON PROTOCOL 2.0</span>
        </div>
      </div>
    </div>
  );
};
