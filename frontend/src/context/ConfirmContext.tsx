import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';
import { useDialogA11y } from '../components/ui/useDialogA11y';

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

const VARIANTS = {
  danger: {
    Icon: Trash2,
    iconWrap: 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/60',
    confirmBtn: 'bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white shadow-lg shadow-rose-600/25',
  },
  warning: {
    Icon: AlertTriangle,
    iconWrap: 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/60',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25',
  },
  primary: {
    Icon: HelpCircle,
    iconWrap: 'bg-brand-50 text-brand-600 ring-8 ring-brand-50/60',
    confirmBtn: 'rv-btn-primary',
  },
} as const;

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
    // If a previous confirmation is still pending, treat it as cancelled.
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
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

  const settle = useCallback((value: boolean) => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  const handleConfirm = () => settle(true);
  const handleCancel = useCallback(() => settle(false), [settle]);

  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, handleCancel);
  const v = VARIANTS[options.variant || 'primary'];
  const Icon = v.Icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px] rv-fade"
            onClick={handleCancel}
            aria-hidden="true"
          />

          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-message"
            tabIndex={-1}
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 z-10 max-sm:rv-sheet-up sm:animate-in sm:fade-in sm:zoom-in-95 outline-none"
            style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
          >
            <div className="sm:hidden mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              onClick={handleCancel}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded-xl p-2"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${v.iconWrap}`}>
                <Icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 id="confirm-modal-title" className="mt-5 text-lg font-extrabold text-slate-900 leading-snug sm:pr-8">
                {options.title}
              </h3>
              <p id="confirm-modal-message" className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {options.message}
              </p>
            </div>

            <div className="mt-7 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
              <button
                type="button"
                data-autofocus={options.variant === 'danger' ? true : undefined}
                onClick={handleCancel}
                className="w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                {options.cancelText}
              </button>
              <button
                type="button"
                data-autofocus={options.variant !== 'danger' ? true : undefined}
                onClick={handleConfirm}
                className={`w-full sm:w-auto min-h-11 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${v.confirmBtn}`}
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
