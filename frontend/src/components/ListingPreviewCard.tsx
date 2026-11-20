import React, { useState } from 'react';
import {
  Smartphone, ShieldCheck, MapPin, Package, Check, Star,
  Calendar, Layers, Edit3, ArrowRight, Sparkles, CheckCircle2
} from 'lucide-react';
import { ProductCondition, SellingMethod } from '../types';
import { formatCurrency, getConditionMeta, getSellingMethodMeta } from '../utils/formatters';
import { resolveMediaUrl } from '../services/api';

interface ListingPreviewCardProps {
  title: string;
  brand: string;
  model: string;
  condition: ProductCondition;
  askingPrice: string;
  sellingMethod: SellingMethod;
  startingBid?: string;
  reservePrice?: string;
  minAcceptablePrice?: string;
  auctionDays?: number;
  storageGb: number;
  ramGb: number;
  batteryHealth: number;
  color: string;
  ageMonths: number;
  hasBox: boolean;
  hasCharger: boolean;
  locationCity: string;
  description: string;
  knownFaults: string;
  images: string[];
  isAiConditionVerified?: boolean;
  onEditStep: (stepNumber: number) => void;
}

export const ListingPreviewCard: React.FC<ListingPreviewCardProps> = ({
  title,
  brand,
  model,
  condition,
  askingPrice,
  sellingMethod,
  startingBid,
  reservePrice,
  minAcceptablePrice,
  auctionDays = 3,
  storageGb,
  ramGb,
  batteryHealth,
  color,
  ageMonths,
  hasBox,
  hasCharger,
  locationCity,
  description,
  knownFaults,
  images,
  isAiConditionVerified,
  onEditStep,
}) => {
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);

  const condMeta = getConditionMeta(condition);
  const methodMeta = getSellingMethodMeta(sellingMethod);
  const activeImage = images[selectedImgIndex] || images[0];

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Listing Marketplace Preview
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            This is how prospective buyers will view your smartphone listing on the live marketplace.
          </p>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-2xs font-bold self-start sm:self-auto">
          Final Review
        </span>
      </div>

      {/* Main Preview Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Image Carousel / Gallery */}
        <div className="md:col-span-5 space-y-3">
          <div className="aspect-square rounded-2xl bg-slate-50 border border-slate-200/80 overflow-hidden relative flex items-center justify-center p-2">
            {activeImage ? (
              <img
                src={resolveMediaUrl(activeImage)}
                alt="Product preview"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-center p-4 text-slate-400">
                <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <span className="text-xs font-semibold">No photo uploaded</span>
              </div>
            )}

            {/* Condition Chip */}
            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-xs border ${condMeta.badgeClass}`}>
                {condMeta.label}
              </span>
              {isAiConditionVerified && (
                <span className="px-2 py-0.5 rounded bg-slate-900/90 text-emerald-300 text-3xs font-bold flex items-center gap-1 shadow-2xs backdrop-blur-xs">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  <span>MobileNetV2 Verified</span>
                </span>
              )}
            </div>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img + idx}
                  type="button"
                  onClick={() => setSelectedImgIndex(idx)}
                  className={`w-14 h-14 rounded-xl border p-1 bg-slate-50 shrink-0 transition-all ${
                    selectedImgIndex === idx
                      ? 'border-emerald-600 ring-2 ring-emerald-600/30'
                      : 'border-slate-200 hover:border-slate-300 opacity-70'
                  }`}
                >
                  <img
                    src={resolveMediaUrl(img)}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Listing Details & Pricing */}
        <div className="md:col-span-7 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-bold uppercase tracking-wider text-2xs">
                {brand} • {model}
              </span>
              <button
                type="button"
                onClick={() => onEditStep(1)}
                className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit specs</span>
              </button>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
              {title}
            </h3>
          </div>

          {/* Price Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                {sellingMethod === 'bidding' ? 'Starting Bid' : 'Asking Price'}
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {formatCurrency(Number(sellingMethod === 'bidding' ? startingBid : askingPrice) || 0)}
              </span>
              <span className="text-2xs text-slate-500 block mt-0.5">
                {sellingMethod === 'bidding'
                  ? `Sealed Auction (${auctionDays} days duration)`
                  : 'Direct Purchase • Private counteroffers enabled'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onEditStep(sellingMethod === 'bidding' ? 5 : 4)}
              className="text-xs text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit price</span>
            </button>
          </div>

          {/* Technical Specs Pill Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-3xs text-slate-400 font-bold uppercase block">Storage</span>
              <span className="font-extrabold text-slate-900">{storageGb} GB</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-3xs text-slate-400 font-bold uppercase block">RAM</span>
              <span className="font-extrabold text-slate-900">{ramGb} GB</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-3xs text-slate-400 font-bold uppercase block">Battery Health</span>
              <span className="font-extrabold text-emerald-700">{batteryHealth}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-3xs text-slate-400 font-bold uppercase block">Color</span>
              <span className="font-extrabold text-slate-900 truncate block">{color || 'Standard'}</span>
            </div>
          </div>

          {/* Accessories & Location Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {hasBox ? 'Original Box' : 'No Box'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {hasCharger ? 'Original Charger' : 'No Charger'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {locationCity || 'India'}
            </span>
          </div>

          {/* Disclosed Wear */}
          {knownFaults?.trim() && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-1">
              <span className="font-bold text-amber-950 block">Disclosed Cosmetic Wear:</span>
              <p className="text-amber-900">{knownFaults}</p>
            </div>
          )}

          {/* Description Preview */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Seller Description:</span>
              <button
                type="button"
                onClick={() => onEditStep(4)}
                className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5 text-2xs"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit notes</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
              {description || 'No description provided.'}
            </div>
          </div>

          {/* Buyer Trust Highlights */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-2xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1 text-emerald-900">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Protected by ReValue Platform Guarantees</span>
            </div>
            <ul className="list-disc list-inside text-emerald-800 space-y-0.5 text-2xs">
              <li>Confidential reserve and private price floors are never disclosed to buyers.</li>
              <li>Payment held in secure platform escrow until buyer inspection OTP confirmation.</li>
              <li>48-hour return window for undisclosed physical defects.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
