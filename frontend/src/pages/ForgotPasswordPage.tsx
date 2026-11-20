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
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full">
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex justify-center mb-4">
            <BrandLogo />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Forgot Password</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter your registered email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-8">
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
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-2 space-y-5">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900 mb-2">Check Your Email</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  If an account exists with this email, you will receive a password reset link.
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
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
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted with SHA-256 and single-use link protection</span>
        </div>
      </div>
    </div>
  );
};
