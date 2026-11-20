import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, AlertCircle, KeyRound, CheckCircle2, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { BrandLogo } from './BrandLogo';
import { api } from '../services/api';
import { useDialogA11y } from './ui/useDialogA11y';
import { LoadingLabel } from './ui/Loader';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  onNavigate?: (page: string, params?: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
  onNavigate,
}) => {
  const { login, verifyOtpRegistration } = useAuth();
  const [isLogin, setIsLogin] = useState(defaultMode === 'login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');
  
  // Registration OTP step state: 'details' | 'otp'
  const [regStep, setRegStep] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  // Timer for OTP resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Reset errors and step when switching modes
  const handleModeSwitch = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setError(null);
    setSuccessMsg(null);
    setRegStep('details');
    setOtp('');
  };

  if (!isOpen) return null;

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      onClose();
      if (loggedUser?.role === 'rider') {
        onNavigate?.('rider-dashboard');
      } else if (loggedUser?.role === 'admin') {
        onNavigate?.('admin-dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send Registration OTP
  const handleSendOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendRegisterOtp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      setRegStep('otp');
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      setSuccessMsg(`A 6-digit verification code has been sent to ${email}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Registration OTP
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const verifiedUser = await verifyOtpRegistration(email.trim().toLowerCase(), cleanOtp);
      onClose();
      if (verifiedUser?.role === 'rider') {
        onNavigate?.('rider-dashboard');
      } else if (verifiedUser?.role === 'admin') {
        onNavigate?.('admin-dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);

    try {
      const res = await api.sendRegisterOtp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      setSuccessMsg(`A fresh verification code has been sent to ${email}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code. Please wait and try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px] rv-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full px-5 pt-6 pb-6 sm:p-8 shadow-2xl border border-slate-200 relative max-sm:rv-sheet-up sm:animate-in sm:fade-in sm:zoom-in-95 sm:my-6 text-xs max-h-[100dvh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <div className="sm:hidden mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <BrandLogo size="md" />
          </div>
          <h2 id="auth-modal-title" className="text-xl font-extrabold text-slate-900 tracking-tight">
            {isLogin
              ? 'Sign in to ReValue'
              : regStep === 'otp'
              ? 'Verify Your Email'
              : 'Create an Account'}
          </h2>
          <p className="text-slate-500 mt-1 text-xs">
            {isLogin
              ? 'Access saved phones, purchases, and offers.'
              : regStep === 'otp'
              ? `Enter the 6-digit code sent to ${email}`
              : 'Join to buy and sell verified smartphones.'}
          </p>
        </div>

        {/* Segmented Mode Switch (only visible on login or details step) */}
        {regStep !== 'otp' && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                isLogin ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                !isLogin ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && !error && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-start gap-2.5 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* --- SIGN IN FORM --- */}
        {isLogin && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate?.('forgot-password');
                  }}
                  className="text-2xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 min-h-12 rv-btn-primary font-bold rounded-xl text-sm cursor-pointer"
            >
              {loading ? <LoadingLabel>Signing in...</LoadingLabel> : 'Sign In'}
            </button>
          </form>
        )}

        {/* --- REGISTRATION STEP 1: DETAILS & SEND OTP --- */}
        {!isLogin && regStep === 'details' && (
          <form onSubmit={handleSendOtpSubmit} className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Primary Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('buyer')}
                  className={`py-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
                    role === 'buyer'
                      ? 'bg-brand-50 text-brand-800 border-brand-500 ring-2 ring-brand-500/15 font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Buyer
                </button>
                <button
                  type="button"
                  onClick={() => setRole('seller')}
                  className={`py-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
                    role === 'seller'
                      ? 'bg-brand-50 text-brand-800 border-brand-500 ring-2 ring-brand-500/15 font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Seller
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 min-h-12 rv-btn-primary font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <LoadingLabel>Sending Code...</LoadingLabel> : (<><ShieldCheck className="w-4 h-4" />Send Verification Code</>)}
            </button>
          </form>
        )}

        {/* --- REGISTRATION STEP 2: ENTER OTP & VERIFY --- */}
        {!isLogin && regStep === 'otp' && (
          <form onSubmit={handleVerifyOtpSubmit} className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setRegStep('details');
                setError(null);
                setSuccessMsg(null);
              }}
              className="flex items-center gap-1 text-2xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back / Edit Registration Info</span>
            </button>

            <div className="p-3.5 bg-page-gradient rounded-xl border border-slate-200 text-center">
              <span className="text-2xs text-slate-500 block">Verification code sent to</span>
              <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">{email}</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-center">
                Enter 6-Digit Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(val);
                  }}
                  className="rv-otp w-full text-center tracking-[0.5em] font-mono text-2xl font-bold py-3.5 bg-brand-50/50 border-2 border-brand-300 rounded-2xl text-slate-900 focus:bg-white outline-none"
                />
                <KeyRound className="w-4 h-4 text-brand-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dev mode OTP notice if simulated */}
            {devOtp && (
              <div className="text-2xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg text-center">
                Dev test OTP: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3 min-h-12 rv-btn-primary font-bold rounded-xl text-sm cursor-pointer"
            >
              {loading ? <LoadingLabel>Verifying...</LoadingLabel> : 'Verify & Complete Registration'}
            </button>

            {/* Resend Cooldown Section */}
            <div className="text-center pt-1">
              {cooldown > 0 ? (
                <span className="text-2xs text-slate-400 font-medium">
                  Resend code in <strong className="text-slate-600">{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-2xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Resending...' : 'Resend Verification Code'}
                </button>
              )}
            </div>
          </form>
        )}

        {/* Footer info: Delivery Partner link */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-2xs text-slate-500">
            Want to deliver smartphones as a fleet partner?
          </p>
          <a
            href="#delivery-partner/signup"
            onClick={onClose}
            className="mt-0.5 inline-block text-2xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Apply to Become a Delivery Partner →
          </a>
        </div>
      </div>
    </div>
  );
};
