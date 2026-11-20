import React, { useState, useEffect } from 'react';
import { X, MessageSquareText } from 'lucide-react';
import { useDialogA11y } from './ui/useDialogA11y';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  description,
  label,
  placeholder = '',
  initialValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  required = false,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onCancel);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError('');
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (required && !value.trim()) {
      setError('This field cannot be empty');
      return;
    }
    onConfirm(value);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px] rv-fade" onClick={onCancel} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 z-10 max-sm:rv-sheet-up sm:animate-in sm:fade-in sm:zoom-in-95"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <div className="sm:hidden mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded-xl p-2"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <MessageSquareText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="prompt-modal-title" className="text-lg font-extrabold text-slate-900 leading-snug">
              {title}
            </h3>
            {description && <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="prompt-modal-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              {label}
              {required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            <textarea
              id="prompt-modal-input"
              autoFocus
              rows={4}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError('');
              }}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'prompt-modal-error' : undefined}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none placeholder:text-slate-400 resize-none"
            />
            {error && (
              <p id="prompt-modal-error" className="text-2xs text-rose-600 font-semibold mt-1.5">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {cancelText}
            </button>
            <button type="submit" className="w-full sm:w-auto min-h-11 px-6 py-2.5 rv-btn-primary text-sm font-bold rounded-xl">
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
