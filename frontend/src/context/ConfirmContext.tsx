import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'primary',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      variant: opts.variant || 'primary',
    });
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const getVariantStyles = () => {
    switch (options.variant) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-6 h-6 text-rose-500" />,
          iconBg: 'bg-rose-50 border-rose-200',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
          iconBg: 'bg-amber-50 border-amber-200',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
        };
      case 'primary':
      default:
        return {
          icon: <HelpCircle className="w-6 h-6 text-emerald-600" />,
          iconBg: 'bg-emerald-50 border-emerald-200',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={handleCancel}
          />

          {/* Modal Container */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 transition-all animate-in zoom-in-95 duration-200"
          >
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl border shrink-0 ${styles.iconBg}`}>
                {styles.icon}
              </div>
              <div className="flex-1 pr-6">
                <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-900 leading-snug">
                  {options.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                {options.cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-offset-2 ${styles.confirmBtn}`}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
