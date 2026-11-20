import React, { useState, useEffect } from 'react';
import { X, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { PriceEstimate } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useDialogA11y } from './ui/useDialogA11y';
import { Spinner } from './ui/Loader';

interface AiPriceValuatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBrand?: string;
  initialModel?: string;
  initialCondition?: string;
}

const EXPANDED_BRANDS = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Realme',
  'Vivo', 'iQOO', 'Oppo', 'Motorola', 'Nothing', 'Poco',
  'Infinix', 'Tecno', 'Lava', 'Honor', 'itel', 'CMF'
];

export const AiPriceValuatorModal: React.FC<AiPriceValuatorModalProps> = ({
  isOpen,
  onClose,
  initialBrand = 'Apple',
  initialModel = 'iPhone 13',
  initialCondition = 'good',
}) => {
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState(initialModel);
  const [condition, setCondition] = useState(initialCondition);
  const [ageMonths, setAgeMonths] = useState(12);
  const [storageGb, setStorageGb] = useState(128);
  const [ramGb, setRamGb] = useState(6);
  const [batteryHealth, setBatteryHealth] = useState(88);
  const [originalRetailPrice, setOriginalRetailPrice] = useState(69900);

  // Physical checks
  const [screenCrack, setScreenCrack] = useState('No');
  const [scratches, setScratches] = useState('Minor');
  const [repairHistory, setRepairHistory] = useState('No');
  const [warrantyAvailable, setWarrantyAvailable] = useState('No');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    if (brand) {
      api.getCatalogueModels(brand)
        .then((res) => {
          if (res?.models?.length) {
            setAvailableModels(res.models);
            if (!res.models.includes(model)) {
              setModel(res.models[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [brand]);

  useEffect(() => {
    if (brand && model) {
      api.getCatalogueSpecs(brand, model)
        .then((specs) => {
          if (specs) {
            if (specs.original_retail_price) setOriginalRetailPrice(specs.original_retail_price);
            if (specs.ram_options?.length) setRamGb(specs.ram_options[0]);
            if (specs.storage_options?.length) setStorageGb(specs.storage_options[0]);
          }
        })
        .catch(() => {});
    }
  }, [model, brand]);

  if (!isOpen) return null;

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPriceEstimate({
        brand,
        model,
        category: 'smartphone',
        approximate_age_months: Number(ageMonths),
        condition,
        storage_gb: Number(storageGb),
        ram_gb: Number(ramGb),
        battery_health_percent: Number(batteryHealth),
        original_retail_price: Number(originalRetailPrice),
        screen_crack: screenCrack,
        scratches: scratches,
        repair_history: repairHistory,
        warranty_available: warrantyAvailable,
      });
      setEstimate(res);
    } catch (err: any) {
      setError(err.message || 'Resale price estimation is currently unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const fieldCls = 'w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none';
  const labelCls = 'block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';
  const range = estimate ? Math.max(1, estimate.price_range_high - estimate.price_range_low) : 1;
  const markerPct = estimate ? Math.min(100, Math.max(0, ((estimate.estimated_price - estimate.price_range_low) / range) * 100)) : 50;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px] rv-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="valuator-title"
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 max-sm:rv-sheet-up sm:animate-in sm:fade-in sm:zoom-in-95 sm:my-6 text-xs max-h-[100dvh] sm:max-h-none overflow-y-auto sm:overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 md:text-white/60 md:hover:text-white md:hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid md:grid-cols-5">
          {/* Form column */}
          <div className="md:col-span-3 p-5 sm:p-8">
            <div className="sm:hidden mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="flex items-center gap-3 mb-2 pr-10">
              <div className="w-11 h-11 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-md shadow-brand-700/25 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-3xs font-bold uppercase tracking-[0.14em] text-brand-600">AI Resale Estimator</p>
                <h2 id="valuator-title" className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Estimated Resale Value
                </h2>
              </div>
            </div>

            <p className="text-slate-500 mb-6 leading-relaxed text-xs">
              Estimate based on your phone's specifications, age, and physical condition.
            </p>

            {error && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEstimate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="val-brand" className={labelCls}>Brand</label>
                  <select id="val-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={fieldCls}>
                    {EXPANDED_BRANDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="val-model" className={labelCls}>Model</label>
                  {availableModels.length > 0 ? (
                    <select id="val-model" value={model} onChange={(e) => setModel(e.target.value)} className={fieldCls}>
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="val-model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className={fieldCls}
                      required
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="val-storage" className={labelCls}>Storage</label>
                  <select id="val-storage" value={storageGb} onChange={(e) => setStorageGb(Number(e.target.value))} className={fieldCls}>
                    {[32, 64, 128, 256, 512, 1024].map((s) => (
                      <option key={s} value={s}>{s} GB</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="val-ram" className={labelCls}>RAM</label>
                  <select id="val-ram" value={ramGb} onChange={(e) => setRamGb(Number(e.target.value))} className={fieldCls}>
                    {[3, 4, 6, 8, 12, 16].map((r) => (
                      <option key={r} value={r}>{r} GB</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="val-battery" className={labelCls}>Battery %</label>
                  <input
                    id="val-battery"
                    type="number"
                    inputMode="numeric"
                    min="50"
                    max="100"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(Number(e.target.value))}
                    className={fieldCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="val-condition" className={labelCls}>Condition</label>
                  <select id="val-condition" value={condition} onChange={(e) => setCondition(e.target.value)} className={fieldCls}>
                    <option value="excellent">Like New</option>
                    <option value="good">Good Condition</option>
                    <option value="bad">Noticeable Wear</option>
                    <option value="defective">Heavily Damaged</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="val-age" className={labelCls}>Age (Months)</label>
                  <input
                    id="val-age"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="72"
                    value={ageMonths}
                    onChange={(e) => setAgeMonths(Number(e.target.value))}
                    className={fieldCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-12 py-3 rv-btn-primary font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" light />
                    <span>Estimating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Get Resale Value Estimate</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result column */}
          <div
            className="md:col-span-2 relative bg-slate-950 text-white p-6 sm:p-8 flex flex-col justify-center overflow-hidden min-h-[16rem]"
            style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
          >
            <div aria-hidden="true" className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-brand-600/40 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-indigo-600/25 blur-3xl" />

            <div className="relative" aria-live="polite">
              {loading ? (
                <div role="status" className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="relative w-16 h-16">
                    <span className="absolute inset-0 rounded-2xl bg-brand-400/25 rv-orbit-pulse" />
                    <span className="absolute inset-0 rv-spinner rv-spinner-light" style={{ borderWidth: 3 }} />
                    <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-brand-200" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Analyzing market data…</p>
                    <p className="text-2xs text-slate-400 mt-1">Comparing specs, age and condition</p>
                  </div>
                  <div className="w-40 h-1 rounded-full rv-progress-bar" />
                </div>
              ) : estimate ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-3xs font-bold uppercase tracking-[0.14em] text-brand-200">Market Estimate</span>
                    <span className="text-3xs font-bold text-white/80 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">Indian Rupee</span>
                  </div>

                  <div>
                    <span className="text-2xs text-slate-400 block">Estimated Price:</span>
                    <span className="block text-4xl font-extrabold tracking-tight leading-none mt-1.5 break-words">
                      {formatCurrency(estimate.estimated_price)}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 text-2xs text-slate-400 mb-2">
                      <span>Expected Range:</span>
                      <span className="font-semibold text-white text-right">{formatCurrency(estimate.price_range_low)} - {formatCurrency(estimate.price_range_high)}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-white/10" aria-hidden="true">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-400/40 via-brand-400 to-indigo-400/40" />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-4 ring-brand-500/50 shadow-lg"
                        style={{ left: `${markerPct}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-2xs text-slate-300 leading-relaxed pt-4 border-t border-white/10">
                    {estimate.explanation}
                  </p>
                </div>
              ) : (
                <div className="text-center md:text-left space-y-3 py-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto md:mx-0">
                    <TrendingUp className="w-5 h-5 text-brand-200" />
                  </div>
                  <p className="text-base font-bold">Your estimate appears here</p>
                  <p className="text-2xs text-slate-400 leading-relaxed max-w-xs mx-auto md:mx-0">
                    Fill in the phone details to get a resale price with an expected range.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
