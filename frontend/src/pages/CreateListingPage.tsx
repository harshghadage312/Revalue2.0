import React, { useState, useEffect } from 'react';
import {
  Camera, Upload, ShieldCheck, Gavel, Handshake,
  CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Trash2, Smartphone,
  Cpu, Check, MapPin, Sparkles, RefreshCw, Wand2, Info
} from 'lucide-react';
import { api } from '../services/api';
import { ProductCondition, SellingMethod, PriceEstimate } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AiConditionModal } from '../components/AiConditionModal';
import { CatalogueSpecsCard, CatalogueSpecsData } from '../components/CatalogueSpecsCard';
import { MultiImageUploader } from '../components/MultiImageUploader';
import { AiPriceBenchmarkCard } from '../components/AiPriceBenchmarkCard';
import { ListingPreviewCard } from '../components/ListingPreviewCard';
import {
  generateTitleSuggestions,
  generateDescriptionSuggestions,
  TitleSuggestion,
  DescriptionSuggestion
} from '../utils/smartListingGenerator';
import { formatCurrency, getConditionMeta, getSellingMethodMeta } from '../utils/formatters';

interface CreateListingPageProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenAuth: () => void;
}

const STEPS = [
  { id: 1, title: 'Phone Specs', stepLabel: 'Specs' },
  { id: 2, title: 'Photos & Condition', stepLabel: 'Condition' },
  { id: 3, title: 'Resale Valuation', stepLabel: 'Valuation' },
  { id: 4, title: 'Listing Details', stepLabel: 'Details' },
  { id: 5, title: 'Choose How to Sell', stepLabel: 'Method' },
  { id: 6, title: 'Review & Publish', stepLabel: 'Review' },
];

export const CreateListingPage: React.FC<CreateListingPageProps> = ({
  onNavigate,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Specs
  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('Apple iPhone 14');
  const [customModel, setCustomModel] = useState(false);
  const [storageGb, setStorageGb] = useState(128);
  const [ramGb, setRamGb] = useState(6);
  const [batteryHealth, setBatteryHealth] = useState(88);
  const [color, setColor] = useState('Midnight');
  const [ageMonths, setAgeMonths] = useState(12);
  const [originalMSRP, setOriginalMSRP] = useState('79900');

  // Step 2: Photos & Condition
  const [images, setImages] = useState<string[]>([]);
  const [condition, setCondition] = useState<ProductCondition>('good');
  const [isAiConditionVerified, setIsAiConditionVerified] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [screenCrack, setScreenCrack] = useState('No');
  const [scratches, setScratches] = useState('Minor');
  const [repairHistory, setRepairHistory] = useState('No');
  const [warrantyAvailable, setWarrantyAvailable] = useState('No');

  // Step 3: Resale Valuation
  const [aiPriceLoading, setAiPriceLoading] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);

  // Step 4: Listing Information
  const [title, setTitle] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [description, setDescription] = useState('');
  const [locationCity, setLocationCity] = useState('Mumbai');
  const [hasBox, setHasBox] = useState(true);
  const [hasCharger, setHasCharger] = useState(true);
  const [knownFaults, setKnownFaults] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestion[]>([]);
  const [descSuggestions, setDescSuggestions] = useState<DescriptionSuggestion[]>([]);

  // Step 5: Selling Method
  const [sellingMethod, setSellingMethod] = useState<SellingMethod>('negotiation');
  const [minAcceptablePrice, setMinAcceptablePrice] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [auctionDays, setAuctionDays] = useState(3);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize title if empty
  useEffect(() => {
    if (!title && brand && model) {
      const condMeta = getConditionMeta(condition);
      setTitle(`${brand} ${model} (${storageGb}GB) - ${condMeta.label}`);
    }
  }, [brand, model, storageGb, condition]);

  // Update AI title and description suggestions when specs or condition change
  useEffect(() => {
    const ctx = {
      brand,
      model,
      storageGb,
      ramGb,
      batteryHealth,
      color,
      condition,
      hasBox,
      hasCharger,
      locationCity,
      knownFaults,
      ageMonths,
    };
    setTitleSuggestions(generateTitleSuggestions(ctx));
    setDescSuggestions(generateDescriptionSuggestions(ctx));
  }, [brand, model, storageGb, ramGb, batteryHealth, color, condition, hasBox, hasCharger, locationCity, knownFaults, ageMonths]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-brand-gradient text-white mx-auto flex items-center justify-center shadow-lg shadow-brand-700/25 mb-2">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in to Sell Your Phone</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Log in with your verified ReValue account to create a listing.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-3 h-11 px-6 rv-btn-primary font-bold text-sm rounded-xl"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Calculate Resale Valuation via Random Forest
  const calculateResalePrice = async () => {
    if (!model.trim()) return;
    setAiPriceLoading(true);
    setError(null);
    try {
      const est = await api.getPriceEstimate({
        brand,
        model: model.trim(),
        category: 'smartphone',
        approximate_age_months: Number(ageMonths),
        condition,
        storage_gb: Number(storageGb),
        ram_gb: Number(ramGb),
        battery_health_percent: Number(batteryHealth),
        original_retail_price: originalMSRP ? Number(originalMSRP) : undefined,
        screen_crack: screenCrack,
        scratches: scratches,
        repair_history: repairHistory,
        warranty_available: warrantyAvailable,
      });

      setPriceEstimate(est);

      // Auto-suggest prices if currently unset
      if (!askingPrice) {
        setAskingPrice(String(Math.round(est.estimated_price)));
      }
      if (!minAcceptablePrice) {
        setMinAcceptablePrice(String(Math.round(est.estimated_price * 0.85)));
      }
      if (!startingBid) {
        setStartingBid(String(Math.round(est.estimated_price * 0.75)));
      }
      if (!reservePrice) {
        setReservePrice(String(Math.round(est.estimated_price * 0.90)));
      }
    } catch (err: any) {
      setError(err.message || 'Price valuation is currently unavailable.');
      toast.error('Unable to calculate resale valuation. Please check inputs.');
    } finally {
      setAiPriceLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);

    // Validation for Step 1
    if (currentStep === 1) {
      if (!model.trim()) {
        setError('Please select or enter your smartphone model.');
        return;
      }
    }

    // Validation for Step 2
    else if (currentStep === 2) {
      if (images.length === 0) {
        setError('Please upload at least 1 photo of your phone.');
        return;
      }
      // Trigger price estimate as we transition to Step 3
      calculateResalePrice();
    }

    // Validation for Step 4
    else if (currentStep === 4) {
      if (!title.trim()) {
        setError('Please provide a listing title.');
        return;
      }
      if (sellingMethod === 'negotiation' && (!askingPrice || Number(askingPrice) <= 0)) {
        setError('Please enter a valid asking price.');
        return;
      }
    }

    // Validation for Step 5
    else if (currentStep === 5) {
      if (sellingMethod === 'bidding') {
        if (!startingBid || Number(startingBid) <= 0) {
          setError('Please specify an opening bid floor.');
          return;
        }
      }
    }

    setCurrentStep(prev => Math.min(6, prev + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setError(null);
    setCurrentStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitListing = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      const deadline = new Date(now.getTime() + auctionDays * 24 * 60 * 60 * 1000);
      const sBid = Number(startingBid || askingPrice);

      const payload: any = {
        title: title.trim(),
        description: description.trim() || `${brand} ${model} in ${getConditionMeta(condition).label} condition.`,
        category: 'smartphone',
        brand,
        model: model.trim(),
        condition,
        asking_price: sellingMethod === 'bidding' ? sBid : Number(askingPrice),
        currency: 'INR',
        original_retail_price: originalMSRP ? Number(originalMSRP) : undefined,
        approximate_age_months: Number(ageMonths),
        location_city: locationCity.trim(),
        selling_method: sellingMethod,
        images,
        specs: {
          storage_gb: Number(storageGb),
          ram_gb: Number(ramGb),
          battery_health_percent: Number(batteryHealth),
          color: color.trim(),
          has_original_box: hasBox,
          has_original_charger: hasCharger,
          known_faults: knownFaults.trim() || undefined,
        },
      };

      if (sellingMethod === 'negotiation') {
        payload.negotiation_settings = {
          min_acceptable_price: minAcceptablePrice ? Number(minAcceptablePrice) : undefined,
          allow_counteroffers: true,
        };
      } else {
        payload.auction_settings = {
          starting_bid: sBid,
          reserve_price: reservePrice ? Number(reservePrice) : undefined,
          min_increment: 500,
          deadline: deadline.toISOString(),
        };
      }

      const created = await api.createProduct(payload);
      toast.success('Phone listing published successfully on ReValue!');
      onNavigate('product-detail', { id: created.id });
    } catch (err: any) {
      setError(err.message || 'Failed to publish listing. Please check inputs.');
      toast.error(err.message || 'Failed to publish listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 py-6 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('marketplace')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-700 mb-2 -ml-2 px-2 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Sell Your Smartphone
          </h1>
        </div>

        <div className="text-right text-xs shrink-0">
          <span className="inline-block px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-bold text-2xs">Step {currentStep} of 6</span>
          <span className="font-extrabold text-slate-900 block mt-1.5 text-sm">{STEPS[currentStep - 1].title}</span>
        </div>
      </div>

      {/* Step Progress Navigation Bar */}
      <div className="bg-white rounded-2xl p-2 sm:p-3 border border-slate-200 shadow-sm">
        <div className="h-1 rounded-full bg-slate-100 mb-2 sm:mb-3 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-brand-gradient rounded-full transition-[width] duration-500 ease-out" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <div className="grid grid-cols-6 gap-1">
          {STEPS.map((s) => {
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { if (isCompleted) setCurrentStep(s.id); }}
                disabled={!isCompleted && !isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                className={`py-2 px-1 rounded-xl text-center transition-all ${
                  isCurrent
                    ? 'bg-brand-50 text-brand-900 font-extrabold'
                    : isCompleted
                    ? 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                    : 'text-slate-300 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-full text-2xs font-bold flex items-center justify-center mb-1 transition-colors ${
                  isCurrent
                    ? 'bg-brand-gradient text-white shadow-md shadow-brand-700/30'
                    : isCompleted
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {isCompleted ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <span className="text-3xs sm:text-2xs truncate block font-semibold">

                  {s.stepLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Error Notice */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* STEP 1: SMART SPECS AUTO-FILL */}
      {currentStep === 1 && (
        <CatalogueSpecsCard
          brand={brand}
          onBrandChange={setBrand}
          model={model}
          onModelChange={setModel}
          storageGb={storageGb}
          onStorageChange={setStorageGb}
          ramGb={ramGb}
          onRamChange={setRamGb}
          batteryHealth={batteryHealth}
          onBatteryHealthChange={setBatteryHealth}
          ageMonths={ageMonths}
          onAgeMonthsChange={setAgeMonths}
          color={color}
          onColorChange={setColor}
          originalMSRP={originalMSRP}
          onOriginalMSRPChange={setOriginalMSRP}
          customModel={customModel}
          onCustomModelToggle={setCustomModel}
          onSpecsLoaded={(specs) => {
            toast.info(`Loaded specs for ${brand} ${model} from catalogue.`);
          }}
        />
      )}

      {/* STEP 2: MULTI-IMAGE UPLOAD & CONDITION CHECK */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <Camera className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Device Photos & Cosmetic Condition
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload clear photos of your phone and select its cosmetic grade.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowConditionModal(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dedicated AI Condition Scanner</span>
            </button>
          </div>

          {/* Multi-Image Upload Dropzone */}
          <MultiImageUploader
            images={images}
            onImagesChange={setImages}
            currentCondition={condition}
            onConditionDetected={(detected, conf) => {
              setCondition(detected);
              setIsAiConditionVerified(true);
              toast.success(`Condition updated to ${getConditionMeta(detected).label} (${Math.round(conf * 100)}% match)`);
            }}
          />

          {/* Condition Tier Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Cosmetic Condition Grade <span className="text-rose-500">*</span>
              </label>
              {isAiConditionVerified && (
                <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Verified by AI
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: 'excellent', label: 'Like New (Flawless)', desc: 'Screen & body in pristine condition. Zero visible scratches.' },
                { key: 'good', label: 'Good Condition', desc: 'Display in great shape with minor cosmetic micro-marks.' },
                { key: 'bad', label: 'Noticeable Wear', desc: 'Visible casing scuffs or surface scratches from daily use.' },
                { key: 'defective', label: 'Damaged / For Parts', desc: 'Cracked glass or physical faults. Sold for components/repair.' },
              ].map((c) => (
                <label
                  key={c.key}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    condition === c.key
                      ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-600/20 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={c.key}
                    checked={condition === c.key}
                    onChange={() => {
                      setCondition(c.key as ProductCondition);
                      setIsAiConditionVerified(false);
                    }}
                    className="accent-emerald-600 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">{c.label}</span>
                    <span className="text-2xs text-slate-500 mt-0.5 block">{c.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Physical Verification Inputs */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block">
              Physical Checkpoints
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Screen Glass</label>
                <select
                  value={screenCrack}
                  onChange={(e) => setScreenCrack(e.target.value)}
                  className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                >
                  <option value="No">No Cracks</option>
                  <option value="Minor">Minor Hairline</option>
                  <option value="Severe">Severe Crack</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Body Scratches</label>
                <select
                  value={scratches}
                  onChange={(e) => setScratches(e.target.value)}
                  className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                >
                  <option value="None">None</option>
                  <option value="Minor">Minor</option>
                  <option value="Heavy">Heavy Scuffs</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Past Repairs</label>
                <select
                  value={repairHistory}
                  onChange={(e) => setRepairHistory(e.target.value)}
                  className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                >
                  <option value="No">None / Original</option>
                  <option value="Yes">Repaired</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Brand Warranty</label>
                <select
                  value={warrantyAvailable}
                  onChange={(e) => setWarrantyAvailable(e.target.value)}
                  className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                >
                  <option value="No">Expired</option>
                  <option value="Yes">Active Warranty</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: RESALE VALUATION */}
      {currentStep === 3 && (
        <AiPriceBenchmarkCard
          brand={brand}
          model={model}
          priceEstimate={priceEstimate}
          loading={aiPriceLoading}
          askingPrice={askingPrice}
          onAskingPriceChange={(val) => {
            setAskingPrice(val);
            toast.info(`Asking price set to ${formatCurrency(Number(val))}`);
          }}
          onRefreshEstimate={calculateResalePrice}
        />
      )}

      {/* STEP 4: LISTING DETAILS & SMART GENERATION */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <Wand2 className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Listing Information & AI Suggestions
                </h2>
              </div>
              <p className="text-slate-500 mt-0.5">
                Set your listing title, asking price, accessories, and description.
              </p>
            </div>
          </div>

          {/* Title Suggestions */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-bold text-slate-700">
                Listing Title <span className="text-rose-500">*</span>
              </label>
              <span className="text-2xs text-emerald-700 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Smart Suggestions
              </span>
            </div>

            {/* Title variation chips */}
            <div className="flex flex-wrap gap-1.5">
              {titleSuggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => {
                    setTitle(sug.title);
                    toast.info(`Selected ${sug.label} title.`);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border text-2xs font-semibold text-left transition-all ${
                    title === sug.title
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="block font-bold text-3xs text-slate-400 uppercase">{sug.label}</span>
                  <span className="line-clamp-1">{sug.title}</span>
                </button>
              ))}
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Apple iPhone 14 (128GB) - Like New"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 font-medium text-xs"
              required
            />
          </div>

          {/* Asking Price & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Asking Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="500"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="Enter price in ₹"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                City Location <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g. Mumbai, Bengaluru, Delhi"
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 outline-none text-xs font-semibold"
                  required
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Accessories Checkboxes */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap gap-4 text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={hasBox}
                onChange={(e) => setHasBox(e.target.checked)}
                className="accent-emerald-600 rounded-xl"
              />
              <span>Original Box Included</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={hasCharger}
                onChange={(e) => setHasCharger(e.target.checked)}
                className="accent-emerald-600 rounded-xl"
              />
              <span>Original Charger Included</span>
            </label>
          </div>

          {/* Description Suggestions & Textarea */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center">
              <label className="block font-bold text-slate-700">
                Seller Description & Notes
              </label>
              <span className="text-2xs text-emerald-700 font-bold flex items-center gap-1">
                <Wand2 className="w-3 h-3" />
                AI Description Templates
              </span>
            </div>

            {/* Template Selector Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {descSuggestions.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setDescription(tpl.text);
                    toast.info(`Applied ${tpl.label} description.`);
                  }}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50/40 text-left transition-colors"
                >
                  <span className="font-bold text-2xs text-slate-800 block">{tpl.label}</span>
                  <span className="text-3xs text-slate-400 font-medium block mt-0.5">{tpl.tag}</span>
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe condition, phone usage, battery health habits..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 outline-none text-xs leading-relaxed"
            />
          </div>

          {/* Disclosed Faults */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Disclosed Cosmetic Faults <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={knownFaults}
              onChange={(e) => setKnownFaults(e.target.value)}
              placeholder="e.g. Tiny pin-sized scuff on lower bezel, never dropped"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs"
            />
          </div>
        </div>
      )}

      {/* STEP 5: SELLING METHOD */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Choose How to Sell
            </h2>
            <p className="text-slate-500 mt-0.5">
              Select direct sale with private counteroffer negotiation or a sealed auction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Direct Buy */}
            <div
              onClick={() => setSellingMethod('negotiation')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                sellingMethod === 'negotiation'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm">Direct Buy & Offers</span>
                <input
                  type="radio"
                  name="sellingMethod"
                  checked={sellingMethod === 'negotiation'}
                  onChange={() => setSellingMethod('negotiation')}
                  className="accent-emerald-600"
                />
              </div>
              <p className="text-slate-500 leading-relaxed text-xs">
                Buyers can buy instantly at {formatCurrency(Number(askingPrice) || 0)} or submit private counteroffers.
              </p>
            </div>

            {/* Sealed Auction */}
            <div
              onClick={() => setSellingMethod('bidding')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                sellingMethod === 'bidding'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm">Sealed-Bid Auction</span>
                <input
                  type="radio"
                  name="sellingMethod"
                  checked={sellingMethod === 'bidding'}
                  onChange={() => setSellingMethod('bidding')}
                  className="accent-emerald-600"
                />
              </div>
              <p className="text-slate-500 leading-relaxed text-xs">
                Buyers place confidential bids. Highest bid meeting your secret reserve price wins.
              </p>
            </div>
          </div>

          {/* Method Settings */}
          {sellingMethod === 'negotiation' ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <label className="block font-bold text-slate-800">
                Minimum Acceptable Price (Private Floor in ₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 45000 (offers below this are automatically rejected)"
                value={minAcceptablePrice}
                onChange={(e) => setMinAcceptablePrice(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-semibold text-xs"
              />
              <span className="text-2xs text-slate-400 block">
                🔒 Security Guarantee: This floor price is confidential and is NEVER revealed to buyers or included in public API responses.
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-amber-950 mb-1">Starting Bid Floor (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 35000"
                    value={startingBid}
                    onChange={(e) => setStartingBid(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl outline-none font-semibold text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-950 mb-1">Secret Reserve Price (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 48000"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl outline-none font-semibold text-xs"
                  />
                  <span className="text-3xs text-amber-800 mt-0.5 block">🔒 Strictly confidential to you.</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-amber-950 mb-1">Auction Duration</label>
                <select
                  value={auctionDays}
                  onChange={(e) => setAuctionDays(Number(e.target.value))}
                  className="w-full sm:w-48 px-3 py-2.5 bg-white border border-amber-200 rounded-xl font-bold outline-none text-xs"
                >
                  <option value={1}>1 Day (Express)</option>
                  <option value={3}>3 Days (Standard)</option>
                  <option value={5}>5 Days (Extended)</option>
                  <option value={7}>7 Days (Maximum Reach)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 6: MARKETPLACE REVIEW */}
      {currentStep === 6 && (
        <ListingPreviewCard
          title={title}
          brand={brand}
          model={model}
          condition={condition}
          askingPrice={askingPrice}
          sellingMethod={sellingMethod}
          startingBid={startingBid}
          reservePrice={reservePrice}
          minAcceptablePrice={minAcceptablePrice}
          auctionDays={auctionDays}
          storageGb={storageGb}
          ramGb={ramGb}
          batteryHealth={batteryHealth}
          color={color}
          ageMonths={ageMonths}
          hasBox={hasBox}
          hasCharger={hasCharger}
          locationCity={locationCity}
          description={description}
          knownFaults={knownFaults}
          images={images}
          isAiConditionVerified={isAiConditionVerified}
          onEditStep={(step) => {
            setCurrentStep(step);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {/* Wizard Navigation Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={currentStep === 1 || submitting}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-40"
        >
          Previous
        </button>

        {currentStep < 6 ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="px-5 py-2 bg-slate-900 hover:bg-brand-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmitListing}
            disabled={submitting}
            className="px-6 py-2.5 rv-btn-primary text-white text-xs font-extrabold rounded-xl shadow-2xs transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="rv-spinner rv-spinner-light w-4 h-4" aria-hidden="true" />
                <span>Publishing Listing...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Publish to Marketplace</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Standalone Condition Check Modal */}
      <AiConditionModal
        isOpen={showConditionModal}
        onClose={() => setShowConditionModal(false)}
        onConditionConfirmed={(assessedCond) => {
          setCondition(assessedCond as ProductCondition);
          setIsAiConditionVerified(true);
          toast.success(`Condition updated to ${getConditionMeta(assessedCond as ProductCondition).label}`);
        }}
      />
    </div>
  );
};
