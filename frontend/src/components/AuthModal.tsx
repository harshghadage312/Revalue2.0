import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, AlertCircle, KeyRound, CheckCircle2, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { BrandLogo } from './BrandLogo';
import { api } from '../services/api';

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-5 sm:p-6 shadow-xl border border-slate-200 relative animate-in fade-in zoom-in-95 my-6 text-xs">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-4">
          <div className="flex justify-center mb-2">
            <BrandLogo size="sm" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">
            {isLogin
              ? 'Sign in to ReValue'
              : regStep === 'otp'
              ? 'Verify Your Email'
              : 'Create an Account'}
          </h2>
          <p className="text-slate-500 mt-0.5 text-[11px]">
            {isLogin
              ? 'Access saved phones, purchases, and offers.'
              : regStep === 'otp'
              ? `Enter the 6-digit code sent to ${email}`
              : 'Join to buy and sell verified smartphones.'}
          </p>
        </div>

        {/* Segmented Mode Switch (only visible on login or details step) */}
        {regStep !== 'otp' && (
          <div className="flex bg-slate-100 p-0.5 rounded-lg mb-3">
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                isLogin ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                !isLogin ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && !error && (
          <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-tight">{successMsg}</span>
          </div>
        )}

        {/* --- SIGN IN FORM --- */}
        {isLogin && (
          <form onSubmit={handleLoginSubmit} className="space-y-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
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
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold transition-colors cursor-pointer"
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
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* --- REGISTRATION STEP 1: DETAILS & SEND OTP --- */}
        {!isLogin && regStep === 'details' && (
          <form onSubmit={handleSendOtpSubmit} className="space-y-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none"
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Primary Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('buyer')}
                  className={`py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                    role === 'buyer'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  Buyer
                </button>
                <button
                  type="button"
                  onClick={() => setRole('seller')}
                  className={`py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                    role === 'seller'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  Seller
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {loading ? 'Sending Code...' : 'Send Verification Code'}
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
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back / Edit Registration Info</span>
            </button>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 block">Verification code sent to</span>
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
                  className="w-full text-center tracking-[0.4em] font-mono text-xl font-bold py-2 bg-emerald-50/40 border-2 border-emerald-500 rounded-lg text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Dev mode OTP notice if simulated */}
            {devOtp && (
              <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-center">
                Dev test OTP: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? 'Verifying...' : 'Verify & Complete Registration'}
            </button>

            {/* Resend Cooldown Section */}
            <div className="text-center pt-1">
              {cooldown > 0 ? (
                <span className="text-[11px] text-slate-400 font-medium">
                  Resend code in <strong className="text-slate-600">{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Resending...' : 'Resend Verification Code'}
                </button>
              )}
            </div>
          </form>
        )}

        {/* Footer info: Delivery Partner link */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500">
            Want to deliver smartphones as a fleet partner?
          </p>
          <a
            href="#delivery-partner/signup"
            onClick={onClose}
            className="mt-0.5 inline-block text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Apply to Become a Delivery Partner →
          </a>
        </div>
      </div>
    </div>
  );
};
