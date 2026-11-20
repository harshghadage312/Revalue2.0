import React, { useState, useEffect } from 'react';
import {
  Search, Filter, X, Smartphone, ArrowUpDown, SlidersHorizontal, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useDialogA11y } from '../components/ui/useDialogA11y';
import { getConditionMeta } from '../utils/formatters';

interface MarketplacePageProps {
  onNavigate: (page: string, params?: any) => void;
  initialQuery?: string;
  initialBrand?: string;
  initialCondition?: string;
}

const BRANDS = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi',
  'Realme', 'Vivo', 'Motorola', 'Nothing', 'iQOO'
];

const PRICE_PRESETS = [
  { label: 'Under ₹15K', min: undefined, max: 15000 },
  { label: '₹15K - ₹35K', min: 15000, max: 35000 },
  { label: '₹35K - ₹60K', min: 35000, max: 60000 },
  { label: '₹60K+', min: 60000, max: undefined },
];

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onNavigate,
  initialQuery = '',
  initialBrand = '',
  initialCondition = '',
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [query, setQuery] = useState(initialQuery);
  const [brand, setBrand] = useState<string>(initialBrand);
  const [condition, setCondition] = useState<string>(initialCondition);
  const [sellingMethod, setSellingMethod] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Mobile drawer
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const filterSheetRef = useDialogA11y<HTMLDivElement>(mobileFilterOpen, () => setMobileFilterOpen(false));

  // Sync props if navigation triggers a parameter change
  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery);
    if (initialBrand !== undefined) setBrand(initialBrand);
    if (initialCondition !== undefined) setCondition(initialCondition);
  }, [initialQuery, initialBrand, initialCondition]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.listProducts({
        query: query.trim() || undefined,
        brand: brand || undefined,
        condition: condition || undefined,
        selling_method: sellingMethod || undefined,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        city: city || undefined,
        sort_by: sortBy,
        page,
        size: 12,
      });
      setProducts(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [brand, condition, sellingMethod, sortBy, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleResetFilters = () => {
    setQuery('');
    setBrand('');
    setCondition('');
    setSellingMethod('');
    setMinPrice('');
    setMaxPrice('');
    setCity('');
    setSortBy('newest');
    setPage(1);
  };

  const handlePresetPrice = (min?: number, max?: number) => {
    setMinPrice(min !== undefined ? String(min) : '');
    setMaxPrice(max !== undefined ? String(max) : '');
    setPage(1);
    fetchProducts();
  };

  const activeFilterCount = [
    brand,
    condition,
    sellingMethod,
    minPrice,
    maxPrice,
    city,
    query,
  ].filter(Boolean).length;

  const segCls = (active: boolean) =>
    `px-3.5 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
      active ? 'bg-white text-brand-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
    }`;
  const radioRowCls = (active: boolean) =>
    `flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
      active ? 'bg-brand-50 text-brand-800 font-bold' : 'text-slate-600 hover:bg-slate-50'
    }`;
  const fieldCls = 'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none';
  const chipCls = 'inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-white border border-brand-100 text-brand-800 font-semibold shadow-xs';
  const chipX = 'w-5 h-5 rounded-full flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 py-6 sm:py-10 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.14em] text-brand-600 mb-1.5">Marketplace</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Browse Smartphones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5" aria-live="polite">
            {loading ? 'Searching listings…' : <><span className="font-bold text-slate-800">{total}</span> {total === 1 ? 'phone' : 'phones'} available</>}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-80 xl:w-96" role="search">
            <label htmlFor="market-search" className="sr-only">Search brand or model</label>
            <input
              id="market-search"
              type="text"
              placeholder="Search brand, model..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none placeholder:text-slate-400 shadow-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </form>

          <button
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden h-[46px] px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shrink-0 shadow-xs"
            aria-haspopup="dialog"
          >
            <Filter className="w-4 h-4 text-brand-600" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="min-w-5 h-5 px-1 bg-brand-600 text-white rounded-full text-3xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Selling Method Tabs & Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto rv-no-scrollbar max-w-full text-xs font-semibold border border-slate-200" role="tablist" aria-label="Selling method">
          <button role="tab" aria-selected={sellingMethod === ''} onClick={() => { setSellingMethod(''); setPage(1); }} className={segCls(sellingMethod === '')}>
            All Phones
          </button>
          <button role="tab" aria-selected={sellingMethod === 'negotiation'} onClick={() => { setSellingMethod('negotiation'); setPage(1); }} className={segCls(sellingMethod === 'negotiation')}>
            Direct Buy / Offers
          </button>
          <button role="tab" aria-selected={sellingMethod === 'bidding'} onClick={() => { setSellingMethod('bidding'); setPage(1); }} className={segCls(sellingMethod === 'bidding')}>
            Sealed Auctions
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <label htmlFor="market-sort" className="font-medium">Sort by:</label>
          <select
            id="market-sort"
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="pl-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none hover:border-slate-300"
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs animate-in fade-in">
          <span className="font-semibold text-slate-400 mr-0.5">Filters:</span>

          {brand && (
            <span className={chipCls}>
              {brand}
              <button aria-label={`Remove ${brand} filter`} className={chipX} onClick={() => { setBrand(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}

          {condition && (
            <span className={chipCls}>
              {getConditionMeta(condition).label}
              <button aria-label="Remove condition filter" className={chipX} onClick={() => { setCondition(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}

          {(minPrice || maxPrice) && (
            <span className={chipCls}>
              ₹{minPrice || 0} - ₹{maxPrice || 'Any'}
              <button aria-label="Remove price filter" className={chipX} onClick={() => { setMinPrice(''); setMaxPrice(''); setPage(1); fetchProducts(); }}><X className="w-3 h-3" /></button>
            </span>
          )}

          {query && (
            <span className={chipCls}>
              "{query}"
              <button aria-label="Remove search filter" className={chipX} onClick={() => { setQuery(''); setPage(1); fetchProducts(); }}><X className="w-3 h-3" /></button>
            </span>
          )}

          <button
            onClick={handleResetFilters}
            className="text-brand-700 hover:text-brand-800 font-bold ml-1 px-2 py-1 rounded-lg hover:bg-brand-50"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Grid & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[19rem_minmax(0,1fr)] gap-6 xl:gap-8 items-start">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block sticky top-24 space-y-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-xs max-h-[calc(100vh-7rem)] overflow-y-auto" aria-label="Filters">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <SlidersHorizontal className="w-4 h-4 text-brand-600" /> Filters
            </span>
            {activeFilterCount > 0 && (
              <button onClick={handleResetFilters} className="text-brand-700 hover:underline font-semibold">
                Clear all
              </button>
            )}
          </div>

          <div>
            <span className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">Brand</span>
            <div className="space-y-0.5 max-h-60 overflow-y-auto pr-1">
              <label className={radioRowCls(brand === '')}>
                <span>All Brands</span>
                <input type="radio" name="brand" checked={brand === ''} onChange={() => { setBrand(''); setPage(1); }} className="accent-emerald-600 w-4 h-4" />
              </label>
              {BRANDS.map((b) => (
                <label key={b} className={radioRowCls(brand.toLowerCase() === b.toLowerCase())}>
                  <span>{b}</span>
                  <input type="radio" name="brand" checked={brand.toLowerCase() === b.toLowerCase()} onChange={() => { setBrand(b); setPage(1); }} className="accent-emerald-600 w-4 h-4" />
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label htmlFor="f-condition" className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">Condition</label>
            <select id="f-condition" value={condition} onChange={(e) => { setCondition(e.target.value); setPage(1); }} className={fieldCls}>
              <option value="">Any Condition</option>
              <option value="excellent">Like New</option>
              <option value="good">Good Condition</option>
              <option value="bad">Noticeable Wear</option>
              <option value="defective">Heavily Damaged</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <span className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">Price Range</span>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {PRICE_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => handlePresetPrice(p.min, p.max)}
                  className="px-2 py-2 text-2xs font-semibold rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 text-center transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <input type="number" inputMode="numeric" aria-label="Minimum price" placeholder="Min ₹" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={fieldCls} />
              <span className="text-slate-300">—</span>
              <input type="number" inputMode="numeric" aria-label="Maximum price" placeholder="Max ₹" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={fieldCls} />
            </div>
            <button
              onClick={() => { setPage(1); fetchProducts(); }}
              className="w-full mt-2.5 py-2.5 bg-slate-900 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Apply Price
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label htmlFor="f-city" className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">City Location</label>
            <input id="f-city" type="text" placeholder="e.g. Mumbai, Bengaluru" value={city} onChange={(e) => setCity(e.target.value)} className={fieldCls} />
          </div>
        </aside>

        {/* Product Grid Area */}
        <section className="min-w-0 space-y-8" aria-busy={loading}>
          {loading ? (
            <div role="status" aria-label="Loading phones" className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 px-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No phones match your filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5">
                Try widening your price range or clearing selected brands.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-6 h-11 px-6 rv-btn-primary text-xs font-bold rounded-xl"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-5">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={() => onNavigate('product-detail', { id: p.id })}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2 sm:gap-3 pt-8 border-t border-slate-200" aria-label="Pagination">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 hover:border-brand-300 hover:text-brand-700 transition-colors flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <span className="text-xs text-slate-500 font-medium px-3 py-2.5 rounded-xl bg-white border border-slate-200">
                    Page <span className="font-bold text-slate-900">{page}</span> of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 hover:border-brand-300 hover:text-brand-700 transition-colors flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {/* Mobile Filter Bottom Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-[60] flex items-end lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] rv-fade" onClick={() => setMobileFilterOpen(false)} aria-hidden="true" />
          <div
            ref={filterSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="relative w-full bg-white rounded-t-3xl max-h-[88dvh] flex flex-col shadow-2xl rv-sheet-up"
          >
            <div className="pt-3 shrink-0">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <span className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand-600" /> Filters
              </span>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs">
              <div>
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">Brand</span>
                <div className="flex flex-wrap gap-2">
                  <label className={`h-10 px-4 rounded-full border flex items-center cursor-pointer font-semibold transition-colors ${brand === '' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <input type="radio" name="m-brand" checked={brand === ''} onChange={() => { setBrand(''); setPage(1); }} className="sr-only" />
                    All Brands
                  </label>
                  {BRANDS.map((b) => {
                    const on = brand.toLowerCase() === b.toLowerCase();
                    return (
                      <label key={b} className={`h-10 px-4 rounded-full border flex items-center cursor-pointer font-semibold transition-colors ${on ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <input type="radio" name="m-brand" checked={on} onChange={() => { setBrand(b); setPage(1); }} className="sr-only" />
                        {b}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="m-condition" className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">Condition</label>
                <select id="m-condition" value={condition} onChange={(e) => { setCondition(e.target.value); setPage(1); }} className={fieldCls}>
                  <option value="">Any Condition</option>
                  <option value="excellent">Like New</option>
                  <option value="good">Good Condition</option>
                  <option value="bad">Noticeable Wear</option>
                  <option value="defective">Heavily Damaged</option>
                </select>
              </div>

              <div>
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">Price Range</span>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {PRICE_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => handlePresetPrice(p.min, p.max)}
                      className="h-11 px-2 text-2xs font-semibold rounded-xl bg-slate-100 text-slate-700 text-center active:bg-brand-50"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" aria-label="Minimum price" placeholder="Min ₹" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={fieldCls} />
                  <span className="text-slate-300">—</span>
                  <input type="number" inputMode="numeric" aria-label="Maximum price" placeholder="Max ₹" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={fieldCls} />
                </div>
              </div>

              <div>
                <label htmlFor="m-city" className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2">City</label>
                <input id="m-city" type="text" placeholder="e.g. Mumbai, Bengaluru" value={city} onChange={(e) => setCity(e.target.value)} className={fieldCls} />
              </div>
            </div>

            <div className="px-5 pt-3 border-t border-slate-100 flex gap-3 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              <button
                onClick={handleResetFilters}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset All
              </button>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-[1.4] h-12 rounded-xl rv-btn-primary text-sm font-bold"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
