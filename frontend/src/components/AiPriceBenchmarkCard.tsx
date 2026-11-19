import React from 'react';
import { TrendingUp, AlertCircle, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { PriceEstimate } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AiPriceBenchmarkCardProps {
  brand: string;
  model: string;
  priceEstimate: PriceEstimate | null;
  loading: boolean;
  askingPrice: string;
  onAskingPriceChange: (val: string) => void;
  onRefreshEstimate: () => void;
}

export type CompetitivenessTier = 'underpriced' | 'fair' | 'premium' | 'unpriced';

export function getCompetitivenessTier(
  askingPriceNum: number,
  estimate: PriceEstimate | null
): { tier: CompetitivenessTier; label: string; description: string; badgeClass: string } {
  if (!estimate || askingPriceNum <= 0) {
    return {
      tier: 'unpriced',
      label: 'Set Asking Price',
      description: 'Enter your desired asking price to calculate market competitiveness.',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    };
  }

  const { estimated_price, price_range_low, price_range_high } = estimate;

  if (askingPriceNum < price_range_low) {
    return {
      tier: 'underpriced',
      label: 'Under-Priced / Fast Sell',
      description: 'Priced below average secondary market value. Attracts immediate buyer offers and rapid sale.',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    };
  } else if (askingPriceNum <= price_range_high) {
    return {
      tier: 'fair',
      label: 'Fair Market Value',
      description: 'Aligned with secondary market pricing for this model and condition grade.',
      badgeClass: 'bg-teal-50 text-teal-800 border-teal-300',
    };
  } else {
    return {
      tier: 'premium',
      label: 'Premium Asking Price',
      description: 'Priced above average market range. May take longer to sell or invite buyer counteroffers.',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    };
  }
}

export const AiPriceBenchmarkCard: React.FC<AiPriceBenchmarkCardProps> = ({
  brand,
  model,
  priceEstimate,
  loading,
  askingPrice,
  onAskingPriceChange,
  onRefreshEstimate,
}) => {
  const askingPriceNum = Number(askingPrice) || 0;
  const comp = getCompetitivenessTier(askingPriceNum, priceEstimate);

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Estimated Resale Valuation
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Random Forest algorithmic valuation based on hardware specifications and cosmetic condition.
          </p>
        </div>

        {priceEstimate && (
          <button
            type="button"
            onClick={onRefreshEstimate}
            disabled={loading}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto disabled:opacity-50"
          >
            <span>Recalculate</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-700">
            Evaluating secondary smartphone market data...
          </p>
          <p className="text-[11px] text-slate-400">
            Applying 17-feature Random Forest model to {brand} {model}.
          </p>
        </div>
      ) : priceEstimate ? (
        <div className="space-y-4">
          {/* Main Dark Valuation Card */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="text-emerald-400 font-extrabold uppercase tracking-wider text-[10.5px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Random Forest Secondary Benchmark
              </span>
              <span className="text-slate-400 font-medium">{brand} {model}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Estimated Benchmark:</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-0.5 block tracking-tight">
                  {formatCurrency(priceEstimate.estimated_price)}
                </span>
              </div>
              <div className="text-xs text-slate-300">
                <span className="text-[10.5px] text-slate-400 block font-medium">Estimated Market Range:</span>
                <span className="font-semibold text-slate-200">
                  {formatCurrency(priceEstimate.price_range_low)} — {formatCurrency(priceEstimate.price_range_high)}
                </span>
              </div>
            </div>

            {/* Model Rationale */}
            {priceEstimate.explanation && (
              <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-slate-800">
                {priceEstimate.explanation}
              </p>
            )}

            <div className="text-[11px] text-emerald-300/90 leading-relaxed bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/40">
              Note: This valuation is an algorithmic statistical benchmark based on secondary market transactions. It is not an appraisal or selling mandate; you maintain full sovereignty to set your own price.
            </div>
          </div>

          {/* Quick Apply Action */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-emerald-950 font-bold block">
                Apply Benchmark Price of {formatCurrency(priceEstimate.estimated_price)}?
              </span>
              <span className="text-emerald-800 text-[11px] block mt-0.5">
                One-click set as your default asking price. You can adjust it at any time.
              </span>
            </div>

            <button
              type="button"
              onClick={() => onAskingPriceChange(String(Math.round(priceEstimate.estimated_price)))}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-2xs transition-colors shrink-0"
            >
              Apply {formatCurrency(priceEstimate.estimated_price)}
            </button>
          </div>

          {/* Competitiveness Analysis Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Secondary Market Competitiveness
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border ${comp.badgeClass}`}>
                {comp.label}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {comp.description}
            </p>

            {/* Visual Bar Indicator */}
            {priceEstimate && askingPriceNum > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>Fast Sell ({formatCurrency(priceEstimate.price_range_low)})</span>
                  <span>Benchmark ({formatCurrency(priceEstimate.estimated_price)})</span>
                  <span>Premium ({formatCurrency(priceEstimate.price_range_high)})</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      comp.tier === 'underpriced'
                        ? 'bg-emerald-500 w-1/3'
                        : comp.tier === 'fair'
                        ? 'bg-teal-500 w-2/3'
                        : 'bg-amber-500 w-full'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 space-y-2">
          <p className="text-xs text-slate-500">Valuation not yet computed.</p>
          <button
            type="button"
            onClick={onRefreshEstimate}
            className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xs hover:bg-slate-800 transition-colors"
          >
            Calculate Resale Valuation
          </button>
        </div>
      )}
    </div>
  );
};
