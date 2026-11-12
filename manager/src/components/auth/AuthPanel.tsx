import React from 'react';
import { AuthInput } from './AuthInput';
import { AuthSubmitButton } from './AuthSubmitButton';

interface AuthPanelProps {
  roleBadge: string;
  portalTitle: string;
  portalSubtitle: string;
  roleDescriptor: string;
  email: string;
  setEmail: (val: string) => void;
  emailPlaceholder?: string;
  password: string;
  setPassword: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error?: string | null;
  submitButtonLabel?: string;
  footerText?: string;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  roleBadge,
  portalTitle,
  portalSubtitle,
  roleDescriptor,
  email,
  setEmail,
  emailPlaceholder = 'operator@aeron.internal',
  password,
  setPassword,
  handleSubmit,
  isSubmitting,
  error,
  submitButtonLabel = 'AUTHENTICATE & ENTER MISSION DESK',
  footerText = 'SECURE AUTHENTICATION // AUTHORIZED PERSONNEL ONLY'
}) => {
  return (
    <div
      className="w-full max-w-[490px] bg-[#0c1510]/85 backdrop-blur-2xl border border-neutral-700/60 rounded-3xl p-7 sm:p-9 xl:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(191,244,46,0.06)] relative overflow-hidden z-20 transition-all"
      style={{
        width: 'clamp(390px, calc(15vw + 195px), 485px)'
      }}
    >
      {/* Subtle top border accent glow */}
      <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-[#BFF42E]/70 to-transparent" />

      {/* Card Header */}
      <div className="mb-6 sm:mb-7 select-none">
        <div className="flex items-center justify-between gap-3 mb-2 sm:mb-2.5">
          <span className="font-sans font-bold text-2xl sm:text-[28px] xl:text-[30px] tracking-wider text-white">
            AERON
          </span>
          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-[#1c271c] border border-[#BFF42E]/40 text-[#BFF42E] font-bold shadow-sm">
            {roleBadge}
          </span>
        </div>

        <h2 className="font-sans font-bold text-xl sm:text-2xl xl:text-[26px] text-neutral-100 tracking-tight leading-snug">
          {portalTitle}
        </h2>

        <p className="font-sans text-sm sm:text-[15px] xl:text-base text-neutral-400 mt-2 leading-relaxed">
          {portalSubtitle}
        </p>

        {/* Role Access Indicator Tag */}
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111913] border border-neutral-800">
          <span className="w-1.5 h-1.5 rounded-full bg-[#BFF42E] animate-pulse" />
          <span className="font-mono text-[11px] sm:text-xs text-neutral-300 font-semibold tracking-wider uppercase">
            {roleDescriptor}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 sm:p-4 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 font-sans text-xs sm:text-sm flex items-center gap-2.5 shadow-sm"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Authentication Form */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <AuthInput
          id="operator-email"
          label="OPERATOR IDENTITY (EMAIL)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={emailPlaceholder}
          required
          autoComplete="email"
          disabled={isSubmitting}
          icon="badge"
        />

        <AuthInput
          id="operator-password"
          label="OPERATIONAL PASSPHRASE"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          required
          autoComplete="current-password"
          disabled={isSubmitting}
          icon="key"
        />

        <div className="pt-2 sm:pt-3">
          <AuthSubmitButton
            isSubmitting={isSubmitting}
            label={submitButtonLabel}
            disabled={!email || !password}
          />
        </div>
      </form>

      {/* Card Footer */}
      <div className="mt-6 sm:mt-7 pt-4 sm:pt-5 border-t border-neutral-800/80 flex items-center justify-between text-neutral-400 select-none">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#BFF42E]/70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider">
            {footerText}
          </span>
        </div>
      </div>
    </div>
  );
};
