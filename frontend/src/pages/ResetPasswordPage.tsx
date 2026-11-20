import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { BrandLogo } from '../components/BrandLogo';

interface ResetPasswordPageProps {
  token?: string;
  onNavigate?: (page: string, params?: any) => void;
  onOpenAuth?: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token: propToken,
  onNavigate,
  onOpenAuth,
}) => {
  // Resolve token from props, search params, or hash params
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (propToken) {
      setToken(propToken);
      return;
    }
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');
      if (urlToken) {
        setToken(urlToken);
        return;
      }
      const hash = window.location.hash;
      if (hash.includes('?')) {
        const hashParams = new URLSearchParams(hash.split('?')[1]);
        const hashToken = hashParams.get('token');
        if (hashToken) {
          setToken(hashToken);
        }
      }
    }
  }, [propToken]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Auto-redirect on success
  useEffect(() => {
    if (!success) return;
    if (redirectCountdown <= 0) {
      if (onOpenAuth) {
        onOpenAuth();
      } else {
        onNavigate?.('landing');
      }
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [success, redirectCountdown, onOpenAuth, onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing. Please use the link sent to your email.');
      setIsTokenInvalid(true);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      const msg = err.message || 'Failed to reset password. The link may have expired.';
      setError(msg);
      if (
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('already been used') ||
        msg.toLowerCase().includes('invalid')
      ) {
        setIsTokenInvalid(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-10 2xl:px-12 bg-page-gradient">
      <div className="max-w-md w-full">
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex justify-center mb-4">
            <BrandLogo />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Set New Password</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create a strong, secure password for your ReValue account.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-brand-900/5 border border-slate-200 p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1">
                <span className="leading-relaxed block">{error}</span>
                {isTokenInvalid && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('forgot-password')}
                    className="mt-2 text-2xs font-bold text-rose-700 underline hover:text-rose-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Request a new reset link</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 outline-none transition-all placeholder:text-slate-400"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && (
                  <p className={`mt-1.5 text-2xs font-medium ${newPassword.length >= 8 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {newPassword.length >= 8 ? '✓ Minimum length satisfied' : `• Minimum 8 characters (${newPassword.length}/8)`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 outline-none transition-all placeholder:text-slate-400"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`mt-1.5 text-2xs font-medium ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || (newPassword.length > 0 && newPassword.length < 8)}
                className="w-full mt-2 py-3 px-4 rv-btn-primary min-h-12 font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="rv-spinner rv-spinner-light w-4 h-4" aria-hidden="true" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-white/80" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto text-green-600 border border-green-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Password Reset Successful!</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Your password has been updated securely. You can now log in to ReValue with your new credentials.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAuth) {
                      onOpenAuth();
                    } else {
                      onNavigate?.('landing');
                    }
                  }}
                  className="w-full py-2.5 px-4 rv-btn-primary text-white font-bold rounded-xl text-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <span>Sign In Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <p className="text-2xs text-slate-400 mt-2">
                  Redirecting automatically in {redirectCountdown}s...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-2xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Bcrypt-encrypted password update with session invalidation</span>
        </div>
      </div>
    </div>
  );
};
