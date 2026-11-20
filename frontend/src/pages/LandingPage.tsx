import React, { useState, useEffect } from 'react';
import {
  ArrowRight, Smartphone, ChevronRight, CheckCircle2,
  Package, Handshake, Gavel, ShieldCheck, Sparkles, PlusCircle,
  Cpu, Check, Tag, ArrowUpRight, Search
} from 'lucide-react';
import { api } from '../services/api';
import { Product, RecommendationItem } from '../types';
import { ProductCard } from '../components/ProductCard';
import { MarketplaceGridSkeleton } from '../components/Skeleton';
import { formatCurrency } from '../utils/formatters';

interface LandingPageProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenValuator: () => void;
}

const POPULAR_BRANDS = [
  { name: 'Apple', hint: 'iPhone 11 to 16 Pro' },
  { name: 'Samsung', hint: 'Galaxy S, Z & A Series' },
  { name: 'OnePlus', hint: 'Flagship & Nord Series' },
  { name: 'Google', hint: 'Pixel 6 to 9 Pro' },
  { name: 'Xiaomi', hint: 'Redmi & Xiaomi Flagship' },
  { name: 'Nothing', hint: 'Phone (1), (2) & CMF' },
];

const CONDITION_TIERS = [
  {
    id: 'excellent',
    label: 'Like New',
    description: 'Flawless screen and casing. Virtually zero visible marks.',
    dot: 'bg-green-500',
    badge: 'text-green-800 bg-green-50 border-green-200',
  },
  {
    id: 'good',
    label: 'Good Condition',
    description: 'Screen in great shape with light micro-marks from normal use.',
    dot: 'bg-indigo-500',
    badge: 'text-indigo-800 bg-indigo-50 border-indigo-200',
  },
  {
    id: 'bad',
    label: 'Noticeable Wear',
    description: 'Visible casing scuffs or edge wear. 100% operational hardware.',
    dot: 'bg-amber-500',
    badge: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  {
    id: 'defective',
    label: 'Heavily Damaged',
    description: 'Cracked glass or exterior damage clearly disclosed for parts/repair.',
    dot: 'bg-rose-500',
    badge: 'text-rose-800 bg-rose-50 border-rose-200',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onOpenValuator,
}) => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'negotiation' | 'bidding'>('all');
  const [loading, setLoading] = useState(true);

  // Quick valuation teaser widget state
  const [teaserBrand, setTeaserBrand] = useState('Apple');
  const [teaserStorage, setTeaserStorage] = useState('128');

  useEffect(() => {
    Promise.all([
      api.listProducts({ size: 8, sort_by: 'newest' }).then(res => res.items).catch(() => []),
      api.getRecommendations().then(res => res.items).catch(() => []),
    ]).then(([prods, recs]) => {
      setFeaturedProducts(prods);
      setRecommendations(recs);
      setLoading(false);
    });
  }, []);

  const filteredListings = featuredProducts.filter(p => {
    if (activeTab === 'all') return true;
    return p.selling_method === activeTab;
  });

  const tabCls = (active: boolean) =>
    `px-3.5 sm:px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
      active ? 'bg-white text-brand-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="space-y-14 sm:space-y-20 pb-16 sm:pb-24">
      {/* 1. HERO */}
      <section className="relative overflow-hidden bg-page-gradient border-b border-slate-200/70">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-32 w-[38rem] h-[38rem] rounded-full bg-brand-300/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 w-[30rem] h-[30rem] rounded-full bg-indigo-300/20 blur-3xl" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(rgb(87 48 187 / 0.12) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(to bottom, black, transparent 85%)' }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left: Brand Positioning & Actionable Copy */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-7 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur border border-brand-100 shadow-xs text-2xs font-bold text-brand-700 tracking-wider uppercase">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-brand-600" />
                </span>
                <span>The Smarter Way to Reshop</span>
              </div>

              <h1 className="text-[2.5rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem] 2xl:text-[5rem] font-extrabold text-slate-900 tracking-[-0.035em]">
                Every phone has <span className="text-brand-gradient">more value.</span>
              </h1>

              <p className="text-sm sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                Find your next smartphone or discover what your current one could be worth. Real seller listings, transparent condition checks, and fair resale price estimates.
              </p>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('marketplace')}
                  className="h-12 sm:h-14 px-7 rv-btn-primary font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2"
                >
                  <span>Shop Phones</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('create-listing')}
                  className="h-12 sm:h-14 px-7 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm sm:text-base rounded-2xl border border-slate-200 hover:border-brand-200 shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-brand-600" />
                  <span>Sell Your Phone</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenValuator}
                  className="h-12 sm:h-14 px-5 text-brand-700 hover:text-brand-800 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-white/60 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Estimate my phone</span>
                </button>
              </div>

              {/* Core Commercial Clarity Metrics */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-6 border-t border-slate-200/80 max-w-2xl">
                {[
                  { icon: ShieldCheck, t: 'Condition Check', d: '4 transparent tiers' },
                  { icon: Cpu, t: 'Fair Valuations', d: 'Secondary market data' },
                  { icon: Gavel, t: 'Direct or Auction', d: 'Flexible selling options' },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-xs text-brand-600 flex items-center justify-center shrink-0">
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <div>
                      <span className="block text-xs font-extrabold text-slate-900">{t}</span>
                      <span className="text-2xs text-slate-500">{d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Editorial Product Showcase Card */}
            <div className="lg:col-span-5">
              <div className="relative max-w-md mx-auto lg:ml-auto">
                <div aria-hidden="true" className="absolute inset-6 rounded-[2.5rem] bg-brand-gradient blur-2xl opacity-40" />
                <div className="relative bg-slate-950 rounded-[2.25rem] p-3.5 shadow-2xl ring-1 ring-white/10 text-white">
                  <div className="flex items-center justify-between px-3 pt-1 pb-2.5">
                    <span className="text-3xs text-slate-400 font-bold">ReValue Live</span>
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full" />
                    <span className="text-3xs text-brand-300 font-semibold">Verified</span>
                  </div>

                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-[1.75rem] p-5 sm:p-6 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between gap-2 text-2xs">
                      <span className="px-2.5 py-1 rounded-full bg-brand-500/15 text-brand-200 font-bold border border-brand-400/25">
                        Like New • 92% Battery
                      </span>
                      <span className="text-slate-400 font-medium">128 GB Storage</span>
                    </div>

                    <div className="py-1 space-y-1.5">
                      <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider block">Featured Flagship</span>
                      <h3 className="text-2xl font-extrabold text-white leading-tight tracking-tight">Apple iPhone 14 Pro</h3>
                      <p className="text-xs text-slate-400">Deep Purple • Flawless Display • Original Box</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-3xs uppercase font-bold text-slate-400 block tracking-wider">Deal Asking Price</span>
                          <span className="text-3xl font-extrabold text-white tracking-tight">₹48,500</span>
                        </div>
                        <div className="text-right">
                          <span className="text-3xs uppercase font-bold text-slate-500 block">Original MSRP</span>
                          <span className="text-xs line-through text-slate-500 font-semibold">₹1,19,900</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-2xs">
                        <span className="text-slate-400">Resale Valuation Index:</span>
                        <span className="font-bold text-slate-100">₹49,200</span>
                      </div>

                      <div className="inline-flex px-2.5 py-1 rounded-full text-3xs font-bold bg-green-500/15 text-green-300 border border-green-400/20">
                        Buyer Saves ₹71,400 (60% vs New)
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('marketplace', { brand: 'Apple' })}
                      className="w-full h-12 rv-btn-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <span>Explore Similar Deals</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="hidden sm:flex absolute -top-4 -right-4 bg-white text-slate-900 border border-slate-200 shadow-lg rounded-2xl px-3.5 py-2.5 items-center gap-2 text-2xs font-bold">
                    <span className="w-6 h-6 rounded-lg bg-green-100 text-green-700 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                    <span>Flawless Screen Inspected</span>
                  </div>

                  <div className="hidden sm:flex absolute -bottom-4 -left-4 bg-white text-slate-900 border border-slate-200 shadow-lg rounded-2xl px-3.5 py-2.5 items-center gap-2 text-2xs font-bold">
                    <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center"><Handshake className="w-3.5 h-3.5" /></span>
                    <span>Direct Buy or Private Offer</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. POPULAR BRANDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">
        <SectionHead
          eyebrow="Browse"
          title="Popular Smartphone Brands"
          subtitle="Filter catalogue by certified models"
          action={
            <button type="button" onClick={() => onNavigate('marketplace')} className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-brand-50">
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {POPULAR_BRANDS.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => onNavigate('marketplace', { brand: b.name })}
              className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-brand-300 hover:shadow-lg text-left transition-all hover:-translate-y-0.5 flex items-center gap-3"
            >
              <span className="w-11 h-11 rounded-xl bg-page-gradient border border-slate-100 text-brand-700 font-extrabold text-base flex items-center justify-center shrink-0 group-hover:bg-brand-gradient group-hover:text-white transition-colors">
                {b.name.charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="text-sm font-bold text-slate-900 group-hover:text-brand-700 transition-colors block">{b.name}</span>
                <span className="text-2xs text-slate-400 block mt-0.5 truncate">{b.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. LIVE MARKETPLACE INVENTORY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">
        <SectionHead
          eyebrow={<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live</span>}
          title="Recently Listed Phones"
          subtitle="Real pre-owned smartphones ready for direct purchase, negotiation, or auction."
          action={
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200 overflow-x-auto rv-no-scrollbar max-w-full" role="tablist" aria-label="Filter listings">
              <button type="button" role="tab" aria-selected={activeTab === 'all'} onClick={() => setActiveTab('all')} className={tabCls(activeTab === 'all')}>All Phones</button>
              <button type="button" role="tab" aria-selected={activeTab === 'negotiation'} onClick={() => setActiveTab('negotiation')} className={tabCls(activeTab === 'negotiation')}>Direct Buy / Offers</button>
              <button type="button" role="tab" aria-selected={activeTab === 'bidding'} onClick={() => setActiveTab('bidding')} className={tabCls(activeTab === 'bidding')}>Sealed Auctions</button>
            </div>
          }
        />

        {loading ? (
          <MarketplaceGridSkeleton count={4} />
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 px-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">No active listings found in this category</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5">
              Be the first to list a smartphone or explore all available models.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('create-listing')}
              className="mt-5 h-11 px-5 rv-btn-primary text-xs font-bold rounded-xl"
            >
              List a Phone
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {filteredListings.slice(0, 8).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={() => onNavigate('product-detail', { id: p.id })}
              />
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <button
            type="button"
            onClick={() => onNavigate('marketplace')}
            className="h-12 px-7 rounded-2xl border border-slate-200 bg-white hover:border-brand-300 hover:text-brand-700 text-slate-800 text-sm font-bold shadow-sm transition-colors inline-flex items-center gap-2"
          >
            <span>Explore All Available Phones</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 4. SELLING EXPERIENCE & QUICK ESTIMATE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">
        <div className="relative overflow-hidden bg-slate-950 rounded-[2rem] p-6 sm:p-10 lg:p-14 text-white">
          <div aria-hidden="true" className="absolute -top-32 -right-20 w-[32rem] h-[32rem] rounded-full bg-brand-600/35 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-40 left-10 w-[26rem] h-[26rem] rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-2xs font-bold text-brand-200 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                <span>Sell With Confidence</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Know what your phone is worth before you list it.
              </h2>

              <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                ReValue replaces lowball guesswork with data-backed resale benchmarks and transparent cosmetic grading. Here is how selling works:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { n: 1, t: 'Device Details', d: 'Select brand, model, storage, and disclosed hardware condition.' },
                  { n: 2, t: 'Condition Check', d: 'Upload photos for automated exterior grading and physical checks.' },
                  { n: 3, t: 'Resale Valuation', d: 'View fair market price benchmark, set asking price, and publish.' },
                ].map((step) => (
                  <div key={step.n} className="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 hover:bg-white/[0.07] transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-brand-gradient text-white font-bold text-xs flex items-center justify-center shadow-md shadow-brand-900/40">
                      {step.n}
                    </div>
                    <h4 className="text-sm font-bold text-white pt-1">{step.t}</h4>
                    <p className="text-2xs text-slate-400 leading-relaxed">{step.d}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onNavigate('create-listing')}
                className="h-12 px-6 rv-btn-primary font-bold text-sm rounded-2xl inline-flex items-center gap-2"
              >
                <span>Start Selling Your Phone</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white/[0.06] backdrop-blur rounded-3xl p-5 sm:p-7 border border-white/10 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Sparkles className="w-4 h-4 text-brand-300" />
                    <span>Quick Resale Estimate</span>
                  </div>
                  <span className="text-3xs text-slate-400">Algorithmic Benchmark</span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="teaser-brand" className="block text-2xs font-bold text-slate-300 mb-1.5">Select Brand</label>
                    <select
                      id="teaser-brand"
                      value={teaserBrand}
                      onChange={(e) => setTeaserBrand(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-900 border-white/10 border rounded-xl text-white font-medium outline-none"
                    >
                      <option value="Apple">Apple iPhone</option>
                      <option value="Samsung">Samsung Galaxy</option>
                      <option value="OnePlus">OnePlus</option>
                      <option value="Google">Google Pixel</option>
                      <option value="Xiaomi">Xiaomi</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-2xs font-bold text-slate-300 mb-1.5">Storage Tier</span>
                    <div className="grid grid-cols-3 gap-2">
                      {['64', '128', '256'].map((storage) => (
                        <button
                          key={storage}
                          type="button"
                          aria-pressed={teaserStorage === storage}
                          onClick={() => setTeaserStorage(storage)}
                          className={`h-11 text-xs font-semibold rounded-xl border transition-colors ${
                            teaserStorage === storage
                              ? 'bg-brand-500/25 border-brand-400 text-white'
                              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {storage} GB
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-2xs text-slate-400 leading-relaxed">
                    Secondary market pricing trained on tens of thousands of real smartphone transactions across India.
                  </p>

                  <button
                    type="button"
                    onClick={onOpenValuator}
                    className="w-full h-12 bg-white hover:bg-brand-50 text-brand-800 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Check Instant Resale Value</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SHOP BY CONDITION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">
        <SectionHead
          eyebrow="Condition tiers"
          title="Shop by Condition"
          subtitle="Transparent exterior condition tiers to match your expectations and budget."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {CONDITION_TIERS.map((tier) => (
            <button
              type="button"
              key={tier.id}
              onClick={() => onNavigate('marketplace', { condition: tier.id })}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-brand-300 hover:shadow-lg hover:-translate-y-0.5 text-left transition-all group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold uppercase tracking-wider border ${tier.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                  {tier.label}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">{tier.description}</p>
              </div>

              <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-700">
                <span>View Phones</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 6. HOW IT WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 scroll-mt-24">
        <div className="bg-white rounded-[2rem] p-6 sm:p-10 lg:p-12 border border-slate-200 shadow-sm">
          <div className="max-w-2xl">
            <span className="inline-flex px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-2xs font-bold uppercase tracking-wider">
              Transparent Marketplace Process
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              How Buying & Selling Works on ReValue
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Clear condition checks, fair market valuations, and protected delivery tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-10">
            {[
              { n: 1, icon: Search, t: 'Find or List Phones', d: 'Browse real phone listings with full hardware specs. Sellers run automated condition checks and view fair pricing benchmarks before publishing.' },
              { n: 2, icon: Handshake, t: 'Buy, Offer, or Bid', d: 'Buy immediately at the asking price, send private counteroffers with seller price floors, or join sealed-bid auctions with confidential reserve prices.' },
              { n: 3, icon: Package, t: 'Fulfillment & Delivery', d: "Track door-to-door courier delivery. Buyer payments are held securely until the shipment is received and verified against the seller's condition notes." },
            ].map(({ n, icon: Icon, t, d }) => (
              <div key={n} className="relative p-6 rounded-2xl bg-page-gradient border border-slate-200/80 space-y-3">
                <span className="absolute top-5 right-6 text-5xl font-extrabold text-brand-100 leading-none select-none" aria-hidden="true">{n}</span>
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-xs text-brand-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{t}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. RECOMMENDATIONS (WHEN AVAILABLE) */}
      {recommendations.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">
          <SectionHead
            eyebrow="For you"
            title="Recommended For You"
            subtitle="Matches based on secondary market pricing and hardware specs."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {recommendations.slice(0, 3).map((item) => (
              <button
                type="button"
                key={item.product_id}
                onClick={() => onNavigate('product-detail', { id: item.product_id })}
                className="text-left bg-white hover:border-brand-300 hover:shadow-lg border border-slate-200 rounded-2xl p-5 transition-all group"
              >
                <div className="text-3xs font-bold text-brand-600 uppercase tracking-wider mb-1.5">{item.recommendation_reason}</div>
                <div className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-brand-700">{item.title}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-extrabold text-slate-900">{formatCurrency(item.asking_price)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const SectionHead: React.FC<{
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
    <div className="min-w-0">
      {eyebrow && <p className="text-2xs font-bold uppercase tracking-[0.14em] text-brand-600 mb-1.5">{eyebrow}</p>}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-2xl">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0 max-w-full">{action}</div>}
  </div>
);
