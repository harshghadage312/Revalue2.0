import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  leaving?: boolean;
}

interface ToastApi {
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  /** Persistent toast for an in-flight operation. Dismiss it with `toast.dismiss(id)`. */
  loading: (message: string) => string;
  dismiss: (id: string) => void;
}

interface ToastContextType {
  toast: ToastApi;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TYPE_META: Record<ToastType, { title: string; Icon: React.ElementType | null; iconWrap: string; bar: string }> = {
  success: { title: 'Success', Icon: CheckCircle2, iconWrap: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  error: { title: 'Something went wrong', Icon: XCircle, iconWrap: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500' },
  warning: { title: 'Heads up', Icon: AlertTriangle, iconWrap: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  info: { title: 'Notice', Icon: Info, iconWrap: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
  loading: { title: 'Working on it', Icon: null, iconWrap: 'bg-brand-50', bar: 'bg-brand-500' },
};

const MAX_VISIBLE = 4;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    const pending = timers.current.get(id);
    if (pending) clearTimeout(pending);
    // play exit animation, then unmount
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 200);
    timers.current.set(id, t);
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    idCounter.current += 1;
    const id = `toast-${Date.now()}-${idCounter.current}`;
    setToasts((prev) => [...prev, { id, message, type, duration }].slice(-MAX_VISIBLE));

    if (duration > 0) {
      timers.current.set(id, setTimeout(() => removeToast(id), duration));
    }
    return id;
  }, [removeToast]);

  const success = useCallback((msg: string, duration?: number) => addToast(msg, 'success', duration), [addToast]);
  const error = useCallback((msg: string, duration?: number) => addToast(msg, 'error', duration ?? 5500), [addToast]);
  const warning = useCallback((msg: string, duration?: number) => addToast(msg, 'warning', duration ?? 5000), [addToast]);
  const info = useCallback((msg: string, duration?: number) => addToast(msg, 'info', duration), [addToast]);
  const loading = useCallback((msg: string) => addToast(msg, 'loading', 0), [addToast]);

  const api = React.useMemo<ToastApi>(
    () => ({ success, error, warning, info, loading, dismiss: removeToast }),
    [success, error, warning, info, loading, removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast: api }}>
      {children}
      <div
        className="fixed z-[11000] pointer-events-none flex flex-col gap-2.5 inset-x-3 top-3 sm:top-auto sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[24rem]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.Icon;
          const isAlert = item.type === 'error' || item.type === 'warning';
          return (
            <div
              key={item.id}
              role={isAlert ? 'alert' : 'status'}
              aria-live={isAlert ? 'assertive' : 'polite'}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl ${
                item.leaving ? 'rv-toast-out' : 'rv-toast-in'
              }`}
            >
              <div className="flex items-start gap-3 p-3.5 pr-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconWrap}`}>
                  {Icon ? <Icon className="w-[18px] h-[18px]" aria-hidden="true" /> : <span className="rv-spinner w-4 h-4" aria-hidden="true" />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{meta.title}</p>
                  <p className="text-xs font-semibold leading-snug text-slate-800 mt-0.5 break-words">{item.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(item.id)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors p-1.5 rounded-lg -mt-0.5"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {item.duration > 0 && !item.leaving && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
                  <div
                    className={`h-full origin-left ${meta.bar}`}
                    style={{ animation: `rv-toast-bar ${item.duration}ms linear forwards` }}
                  />
                </div>
              )}
              {item.type === 'loading' && <div className="absolute bottom-0 left-0 right-0 h-[3px] rv-progress-bar" />}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
