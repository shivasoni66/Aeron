import React from 'react';

interface AuthSubmitButtonProps {
  isSubmitting: boolean;
  label?: string;
  loadingLabel?: string;
  disabled?: boolean;
}

export const AuthSubmitButton: React.FC<AuthSubmitButtonProps> = ({
  isSubmitting,
  label = 'AUTHENTICATE & ENTER GCS',
  loadingLabel = 'AUTHENTICATING OPERATOR...',
  disabled = false
}) => {
  return (
    <button
      type="submit"
      disabled={isSubmitting || disabled}
      className="w-full h-16 sm:h-[66px] px-4 sm:px-6 rounded-2xl bg-[#BFF42E] hover:bg-[#cbf648] text-[#0a1209] font-sans font-bold text-xs sm:text-[13px] xl:text-[14px] uppercase tracking-normal sm:tracking-wider transition-all duration-200 shadow-[0_0_24px_rgba(191,244,46,0.35)] hover:shadow-[0_0_32px_rgba(191,244,46,0.55)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2.5 sm:gap-3 select-none overflow-hidden"
    >
      {isSubmitting ? (
        <>
          <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-[#0a1209] border-t-transparent animate-spin shrink-0" />
          <span className="whitespace-nowrap">{loadingLabel}</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span className="whitespace-nowrap tracking-wider">{label}</span>
        </>
      )}
    </button>
  );
};
