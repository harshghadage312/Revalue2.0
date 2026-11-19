import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    idCounter.current += 1;
    const id = `toast-${Date.now()}-${idCounter.current}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((msg: string, duration?: number) => addToast(msg, 'success', duration), [addToast]);
  const error = useCallback((msg: string, duration?: number) => addToast(msg, 'error', duration ?? 5000), [addToast]);
  const warning = useCallback((msg: string, duration?: number) => addToast(msg, 'warning', duration), [addToast]);
  const info = useCallback((msg: string, duration?: number) => addToast(msg, 'info', duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: { success, error, warning, info } }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const typeStyles = {
            success: {
              border: 'border-emerald-500/40',
              bg: 'bg-slate-900/95',
              iconColor: 'text-emerald-400',
              Icon: CheckCircle2,
              progressBg: 'bg-emerald-500',
            },
            error: {
              border: 'border-rose-500/40',
              bg: 'bg-slate-900/95',
              iconColor: 'text-rose-400',
              Icon: XCircle,
              progressBg: 'bg-rose-500',
            },
            warning: {
              border: 'border-amber-500/40',
              bg: 'bg-slate-900/95',
              iconColor: 'text-amber-400',
              Icon: AlertTriangle,
              progressBg: 'bg-amber-500',
            },
            info: {
              border: 'border-cyan-500/40',
              bg: 'bg-slate-900/95',
              iconColor: 'text-cyan-400',
              Icon: Info,
              progressBg: 'bg-cyan-500',
            },
          }[item.type];

          const IconComponent = typeStyles.Icon;

          return (
            <div
              key={item.id}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border backdrop-blur-md p-4 text-white shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${typeStyles.bg} ${typeStyles.border}`}
            >
              <div className="flex items-start gap-3">
                <IconComponent className={`w-5 h-5 mt-0.5 shrink-0 ${typeStyles.iconColor}`} />
                <div className="flex-1 text-sm font-medium leading-snug text-slate-100 pr-2">
                  {item.message}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(item.id)}
                  className="text-slate-400 hover:text-white transition-colors p-0.5 rounded-md focus:outline-none"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
