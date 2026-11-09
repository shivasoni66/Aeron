import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 selection:bg-primary-container selection:text-on-primary-container">
      <div className="w-full max-w-md bg-surface-container-low border border-surface-variant p-8 rounded-lg shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 w-48 h-48 bg-primary-fixed/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 text-center relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-headline-lg text-headline-lg tracking-wider text-primary">AERON</span>
            <span className="text-[10px] font-label-telemetry text-primary-fixed uppercase tracking-widest px-2 py-0.5 rounded bg-surface-variant border border-outline-variant">
              MISSION INTEL
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">OPERATIONAL FLIGHT DECK</h1>
          <p className="font-body-sm text-secondary text-xs mt-1">Authorized Mission Manager & Flight Commander Access</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-error-container/30 border border-error/50 text-error font-label-telemetry text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10 font-label-telemetry">
          <div>
            <label className="block text-outline text-[11px] uppercase tracking-wider mb-1.5">
              OPERATOR EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="manager@aeron.internal"
              className="w-full px-3.5 py-2.5 rounded bg-surface-container-lowest border border-surface-variant focus:border-primary-fixed focus:outline-none text-on-surface text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-outline text-[11px] uppercase tracking-wider mb-1.5">
              SECURITY PASSPHRASE
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded bg-surface-container-lowest border border-surface-variant focus:border-primary-fixed focus:outline-none text-on-surface text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(191,244,46,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-on-primary-fixed border-t-transparent animate-spin" />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>ENTER COMMAND DECK</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-surface-variant text-center font-label-telemetry text-[10px] text-outline">
          AERON MISSION INTELLIGENCE SYSTEM // STRICT RBAC ENFORCED
        </div>
      </div>
    </div>
  );
};

