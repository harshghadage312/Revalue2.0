import React, { useState, useEffect } from 'react';
import { Smartphone, Sparkles, Check, Cpu, Battery, Layers, DollarSign, Info } from 'lucide-react';
import { api } from '../services/api';

const TOP_BRANDS = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Realme',
  'Vivo', 'Motorola', 'Nothing'
];

const ALL_EXPANDED_BRANDS = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Realme',
  'Vivo', 'iQOO', 'Oppo', 'Motorola', 'Nothing', 'Poco',
  'Infinix', 'Tecno', 'Lava', 'Honor', 'itel', 'CMF',
  'Acer', 'Alcatel', 'BlackZone', 'HMD', 'Ulefone'
];

export interface CatalogueSpecsData {
  storage_options?: number[];
  ram_options?: number[];
  battery_mah?: number;
  display_size_inches?: number;
  refresh_rate_hz?: number;
  has_5g?: boolean;
  original_retail_price?: number;
  os?: string;
}

interface CatalogueSpecsCardProps {
  brand: string;
  onBrandChange: (brand: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  storageGb: number;
  onStorageChange: (storage: number) => void;
  ramGb: number;
  onRamChange: (ram: number) => void;
  batteryHealth: number;
  onBatteryHealthChange: (health: number) => void;
  ageMonths: number;
  onAgeMonthsChange: (age: number) => void;
  color: string;
  onColorChange: (color: string) => void;
  originalMSRP: string;
  onOriginalMSRPChange: (msrp: string) => void;
  customModel: boolean;
  onCustomModelToggle: (custom: boolean) => void;
  onSpecsLoaded?: (specs: CatalogueSpecsData) => void;
}

export const CatalogueSpecsCard: React.FC<CatalogueSpecsCardProps> = ({
  brand,
  onBrandChange,
  model,
  onModelChange,
  storageGb,
  onStorageChange,
  ramGb,
  onRamChange,
  batteryHealth,
  onBatteryHealthChange,
  ageMonths,
  onAgeMonthsChange,
  color,
  onColorChange,
  originalMSRP,
  onOriginalMSRPChange,
  customModel,
  onCustomModelToggle,
  onSpecsLoaded,
}) => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [curatedSpecs, setCuratedSpecs] = useState<CatalogueSpecsData | null>(null);

  // Fetch catalogue models when brand changes
  useEffect(() => {
    if (!brand) return;
    setLoadingModels(true);
    api.getCatalogueModels(brand)
      .then((res) => {
        if (res?.models?.length) {
          setAvailableModels(res.models);
          if (!model || !res.models.includes(model)) {
            onModelChange(res.models[0]);
          }
        } else {
          setAvailableModels([]);
        }
      })
      .catch(() => setAvailableModels([]))
      .finally(() => setLoadingModels(false));
  }, [brand]);

  // Fetch reference specs when model changes
  useEffect(() => {
    if (brand && model && !customModel) {
      setLoadingSpecs(true);
      api.getCatalogueSpecs(brand, model)
        .then((specs) => {
          if (specs) {
            setCuratedSpecs(specs);
            if (specs.original_retail_price) {
              onOriginalMSRPChange(String(specs.original_retail_price));
            }
            if (specs.storage_options?.length && !specs.storage_options.includes(storageGb)) {
              onStorageChange(specs.storage_options[0]);
            }
            if (specs.ram_options?.length && !specs.ram_options.includes(ramGb)) {
              onRamChange(specs.ram_options[0]);
            }
            if (onSpecsLoaded) {
              onSpecsLoaded(specs);
            }
          }
        })
        .catch(() => setCuratedSpecs(null))
        .finally(() => setLoadingSpecs(false));
    }
  }, [brand, model, customModel]);

  const storageChoices = curatedSpecs?.storage_options?.length
    ? curatedSpecs.storage_options
    : [32, 64, 128, 256, 512, 1024];

  const ramChoices = curatedSpecs?.ram_options?.length
    ? curatedSpecs.ram_options
    : [3, 4, 6, 8, 12, 16];

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Smartphone className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Smartphone Specifications
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Select your phone to automatically load curated hardware specifications.
          </p>
        </div>

        {curatedSpecs && !customModel && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-bold self-start sm:self-auto">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>Auto-filled from Catalogue</span>
          </div>
        )}
      </div>

      {/* Brand Selection with Top Brand Chips */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700">
          Smartphone Brand <span className="text-rose-500">*</span>
        </label>

        {/* Quick-pick brand chips */}
        <div className="flex flex-wrap gap-1.5">
          {TOP_BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                onBrandChange(b);
                onCustomModelToggle(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                brand === b
                  ? 'bg-slate-900 text-white shadow-2xs scale-102'
                  : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Full Brand Dropdown for All 23+ Brands */}
        <div className="pt-1">
          <select
            value={brand}
            onChange={(e) => {
              onBrandChange(e.target.value);
              onCustomModelToggle(false);
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-colors"
          >
            {ALL_EXPANDED_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-xs font-bold text-slate-700">
            Model Name <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => onCustomModelToggle(!customModel)}
            className="text-[11px] text-emerald-700 font-bold hover:underline"
          >
            {customModel ? '← Select from catalogue' : '+ Enter custom model'}
          </button>
        </div>

        {customModel || availableModels.length === 0 ? (
          <input
            type="text"
            placeholder="e.g. Galaxy S23 Ultra, iPhone 14 Pro"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
            required
          />
        ) : (
          <div className="relative">
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={loadingModels}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none disabled:opacity-50"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {loadingModels && (
              <div className="absolute right-3 top-2.5">
                <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Curated Hardware Specifications Badges */}
      {curatedSpecs && !customModel && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              Catalogue Hardware Profile
            </span>
            <span className="text-[10.5px] text-slate-500 font-medium uppercase">
              {curatedSpecs.os === 'ios' ? 'Apple iOS' : 'Google Android'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Battery</span>
              <span className="font-bold text-slate-800">{curatedSpecs.battery_mah ? `${curatedSpecs.battery_mah} mAh` : 'Standard'}</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Display</span>
              <span className="font-bold text-slate-800">{curatedSpecs.display_size_inches ? `${curatedSpecs.display_size_inches}" Display` : 'Standard'}</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Connectivity</span>
              <span className="font-bold text-emerald-700">{curatedSpecs.has_5g ? '5G Ultra' : '4G LTE'}</span>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Retail Launch MSRP</span>
              <span className="font-bold text-slate-800">
                {curatedSpecs.original_retail_price ? `₹${curatedSpecs.original_retail_price.toLocaleString('en-IN')}` : 'Market Avg'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Storage and RAM Chip Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Storage */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Internal Storage <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {storageChoices.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStorageChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  storageGb === s
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {s >= 1024 ? `${s / 1024} TB` : `${s} GB`}
              </button>
            ))}
          </div>
        </div>

        {/* RAM */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            System RAM <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ramChoices.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRamChange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  ramGb === r
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {r} GB
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Physical Variables: Battery Health, Age, Color, MSRP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Battery Health % <span className="text-slate-400 font-normal">(50-100)</span>
          </label>
          <input
            type="number"
            min="50"
            max="100"
            value={batteryHealth}
            onChange={(e) => onBatteryHealthChange(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Age (Months) <span className="text-slate-400 font-normal">(1-72)</span>
          </label>
          <input
            type="number"
            min="1"
            max="72"
            value={ageMonths}
            onChange={(e) => onAgeMonthsChange(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Color / Finish</label>
          <input
            type="text"
            placeholder="e.g. Space Grey, Blue"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Original MSRP (₹)</label>
          <input
            type="number"
            placeholder="e.g. 69900"
            value={originalMSRP}
            onChange={(e) => onOriginalMSRPChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-600"
          />
        </div>
      </div>
    </div>
  );
};
