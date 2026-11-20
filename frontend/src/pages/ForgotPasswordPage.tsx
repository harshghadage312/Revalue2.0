import React, { useState, useEffect } from 'react';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { BrandLogo } from '../components/BrandLogo';

interface ForgotPasswordPageProps {
  onNavigate?: (page: string, params?: any) => void;
  onOpenAuth?: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigate,
  onOpenAuth,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.forgotPassword(cleanEmail);
      setSubmitted(true);
      setCooldown(res.cooldown_seconds || 60);
    } catch (err: any) {
      setError(err.message || 'Unable to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      setCooldown(res.cooldown_seconds || 60);
    } catch (err: any) {
      setError(err.message || 'Unable to resend reset link. Please try again.');
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
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Forgot Password</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter your registered email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-brand-900/5 border border-slate-200 p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 outline-none transition-all placeholder:text-slate-400"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rv-btn-primary min-h-12 font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="rv-spinner rv-spinner-light w-4 h-4" aria-hidden="true" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-white/80" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-2 space-y-5">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto text-green-600 border border-green-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  If an account exists with this email, you will receive a password reset link.
                </p>
                <p className="text-2xs text-slate-400 mt-2">
                  The link is valid for <strong>15 minutes</strong>. Please check your spam or promotions folder if you don't see it shortly.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend Reset Link'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Back to Login Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (onOpenAuth) {
                  onOpenAuth();
                } else {
                  onNavigate?.('landing');
                }
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-2xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted with SHA-256 and single-use link protection</span>
        </div>
      </div>
    </div>
  );
};
