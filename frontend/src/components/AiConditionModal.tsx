import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Upload, Check, ScanLine, RefreshCw } from 'lucide-react';
import { useDialogA11y } from './ui/useDialogA11y';
import { Spinner } from './ui/Loader';
import { api } from '../services/api';
import { MobileCondition } from '../types';
import { getConditionMeta } from '../utils/formatters';

interface AiConditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConditionConfirmed?: (condition: string) => void;
}

export const AiConditionModal: React.FC<AiConditionModalProps> = ({
  isOpen,
  onClose,
  onConditionConfirmed,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MobileCondition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  // Release object URLs for previous previews
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.assessCondition(selectedFile);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unable to analyze image. Please ensure a clear photo of the phone.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (conditionKey: string) => {
    if (onConditionConfirmed) {
      onConditionConfirmed(conditionKey);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px] rv-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="condition-title"
        className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-sm:rv-sheet-up sm:animate-in sm:fade-in sm:zoom-in-95 sm:my-6 text-xs max-h-[100dvh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <div className="sm:hidden mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-2 pr-10">
          <div className="w-11 h-11 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-md shadow-brand-700/25 shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs font-bold uppercase tracking-[0.14em] text-brand-600">AI Visual Scanner</p>
            <h2 id="condition-title" className="text-lg font-extrabold text-slate-900 tracking-tight">
              Phone Condition Check
            </h2>
          </div>
        </div>

        <p className="text-slate-500 mb-5 leading-relaxed">
          Upload a clear photo of the phone screen or back casing to evaluate exterior wear.
        </p>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Dropzone */}
        <div className="mb-4">
          <label
            className={`group relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors overflow-hidden ${
              loading ? 'cursor-wait border-brand-300 bg-brand-50/40' : 'cursor-pointer border-slate-200 hover:border-brand-400 bg-page-gradient'
            } ${previewUrl ? 'p-2' : 'p-8'}`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
            {previewUrl ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950/90">
                <img src={previewUrl} alt="Phone preview" className={`w-full h-full object-contain transition-opacity ${loading ? 'opacity-70' : ''}`} />
                {loading && (
                  <>
                    <div className="absolute inset-0 bg-brand-900/20" aria-hidden="true" />
                    <div className="rv-scan-line" aria-hidden="true" />
                    <div className="absolute inset-3 border-2 border-white/40 rounded-lg pointer-events-none" aria-hidden="true" />
                  </>
                )}
                {!loading && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 text-2xs font-bold text-slate-700 shadow-sm opacity-90 group-hover:opacity-100">
                    <RefreshCw className="w-3 h-3" /> Change photo
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-3 text-brand-500 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-800 block text-sm">Choose device photo</span>
                <span className="text-2xs text-slate-400 block mt-1">JPEG, PNG, WebP up to 5MB</span>
              </div>
            )}
          </label>
        </div>

        {selectedFile && !result && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full min-h-12 py-3 rv-btn-primary font-bold rounded-xl text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner size="sm" light />
                <span>Checking condition...</span>
              </>
            ) : (
              <>
                <ScanLine className="w-4 h-4" />
                <span>Check Condition</span>
              </>
            )}
          </button>
        )}

        {/* Result Card */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2" aria-live="polite">
            <div className="p-4 sm:p-5 rounded-2xl bg-page-gradient border border-brand-100 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                    Estimated Condition
                  </span>
                  <span className="mt-1 inline-flex items-center gap-2 text-lg font-extrabold text-slate-900">
                    <span className={`w-2.5 h-2.5 rounded-full ${getConditionMeta(result.predicted_condition).dotColor}`} />
                    {getConditionMeta(result.predicted_condition).label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                    Match Confidence
                  </span>
                  <span className="text-2xl font-extrabold text-brand-700 leading-tight">
                    {Math.round(result.confidence_score * 100)}%
                  </span>
                </div>
              </div>

              {result.class_probabilities && (
                <div className="space-y-2.5 pt-3 border-t border-brand-100 text-2xs">
                  {Object.entries(result.class_probabilities).map(([cKey, prob]) => {
                    const meta = getConditionMeta(cKey);
                    const pct = Math.round((prob as number) * 100);
                    const isTop = cKey === result.predicted_condition;
                    return (
                      <div key={cKey} className="space-y-1">
                        <div className="flex justify-between text-slate-600">
                          <span className={isTop ? 'font-bold text-slate-900' : ''}>{meta.label}</span>
                          <span className="font-semibold text-slate-800">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width] duration-700 ease-out ${isTop ? 'bg-brand-gradient' : 'bg-slate-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleApply(result.predicted_condition)}
                className="flex-1 min-h-11 py-2.5 rv-btn-primary font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Apply Condition</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
