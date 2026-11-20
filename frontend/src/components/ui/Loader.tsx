import React from 'react';
import { AlertCircle, Inbox, RotateCw } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */

const SPINNER_SIZES = { xs: 'w-3.5 h-3.5', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-9 h-9', xl: 'w-12 h-12' } as const;

export const Spinner: React.FC<{ size?: keyof typeof SPINNER_SIZES; light?: boolean; className?: string; label?: string }> = ({
  size = 'md',
  light = false,
  className = '',
  label,
}) => (
  <span
    role={label ? 'status' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={`rv-spinner ${light ? 'rv-spinner-light' : ''} ${SPINNER_SIZES[size]} shrink-0 ${className}`}
  />
);

/* ------------------------------------------------------------------ */
/* Branded mark used by full-page loaders                              */
/* ------------------------------------------------------------------ */

export const BrandPulse: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
    <span className="absolute inset-0 rounded-[30%] bg-brand-400/25 rv-orbit-pulse" />
    <span className="absolute inset-0 rv-spinner" style={{ borderWidth: 3 }} />
    <span
      className="relative rounded-[28%] bg-brand-gradient flex items-center justify-center shadow-lg shadow-brand-700/30"
      style={{ width: size * 0.56, height: size * 0.56 }}
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.32, height: size * 0.32 }}>
        <rect x="5" y="2" width="14" height="20" rx="3" stroke="#fff" strokeWidth="2" />
        <path d="M8.5 13.5L12 10L15.5 13.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 10V16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Page / section loaders                                              */
/* ------------------------------------------------------------------ */

/** Centered branded loader that fills the content area (not the navbar). */
export const PageLoader: React.FC<{ label?: string; hint?: string; className?: string }> = ({
  label = 'Loading…',
  hint,
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`min-h-[60vh] w-full flex flex-col items-center justify-center gap-5 px-6 py-16 text-center rv-fade ${className}`}
  >
    <BrandPulse />
    <div className="space-y-1">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      {hint && <p className="text-xs text-slate-500 max-w-xs mx-auto">{hint}</p>}
    </div>
  </div>
);

/** Full-screen overlay used for the initial app boot / session restore. */
export const FullScreenLoader: React.FC<{ label?: string }> = ({ label = 'Preparing ReValue…' }) => (
  <div
    role="status"
    aria-live="polite"
    className="fixed inset-0 z-[12000] bg-page-gradient flex flex-col items-center justify-center gap-6 rv-fade"
  >
    <BrandPulse size={76} />
    <div className="text-center space-y-1.5">
      <p className="text-base font-extrabold tracking-tight text-slate-900">
        Re<span className="text-brand-600">Value</span>
      </p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
    <div className="w-40 h-1 rounded-full rv-progress-bar" aria-hidden="true" />
  </div>
);

/** Compact loader for cards, panels, tables and modal bodies. */
export const SectionLoader: React.FC<{ label?: string; className?: string; compact?: boolean }> = ({
  label = 'Loading…',
  className = '',
  compact = false,
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`w-full flex flex-col items-center justify-center gap-3 text-center ${compact ? 'py-8' : 'py-14'} ${className}`}
  >
    <Spinner size={compact ? 'md' : 'lg'} />
    <p className="text-xs font-semibold text-slate-500">{label}</p>
  </div>
);

/** Thin indeterminate bar for background refreshes. */
export const TopProgress: React.FC<{ active: boolean; className?: string }> = ({ active, className = '' }) =>
  active ? <div className={`h-0.5 w-full rv-progress-bar ${className}`} role="progressbar" aria-label="Loading" /> : null;

/** Inline label with spinner, for buttons: `{loading ? <LoadingLabel>Saving…</LoadingLabel> : 'Save'}` */
export const LoadingLabel: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light = true }) => (
  <span className="inline-flex items-center justify-center gap-2">
    <Spinner size="xs" light={light} />
    <span>{children}</span>
  </span>
);

/* ------------------------------------------------------------------ */
/* Empty & error states                                                */
/* ------------------------------------------------------------------ */

export const EmptyState: React.FC<{
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon = Inbox, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
    <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-500 mb-4">
      <Icon className="w-6 h-6" aria-hidden="true" />
    </div>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    {description && <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}> = ({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again', className = '' }) => (
  <div role="alert" className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
    <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-4">
      <AlertCircle className="w-6 h-6" aria-hidden="true" />
    </div>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    {message && <p className="mt-1.5 text-xs text-slate-500 max-w-sm leading-relaxed">{message}</p>}
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700 transition-colors"
      >
        <RotateCw className="w-3.5 h-3.5" />
        {retryLabel}
      </button>
    )}
  </div>
);
