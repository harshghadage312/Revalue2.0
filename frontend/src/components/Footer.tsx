import React from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface FooterProps {
  onNavigate?: (page: string, params?: any) => void;
  onOpenValuator?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenValuator }) => {
  const handleNav = (page: string, params: any = {}) => {
    if (onNavigate) {
      onNavigate(page, params);
    } else {
      const query = new URLSearchParams(params).toString();
      window.location.hash = query ? `${page}?${query}` : page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollToHowItWorks = () => {
    if (window.location.hash !== '#landing' && window.location.hash !== '' && window.location.hash !== '#') {
      handleNav('landing');
      setTimeout(() => {
        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const linkCls = 'text-slate-400 hover:text-white transition-colors text-left py-1';

  return (
    <footer className="relative bg-slate-950 text-slate-400 text-xs pt-14 sm:pt-16 pb-8 overflow-hidden">
      {/* soft brand glow */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[60rem] h-80 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-5 lg:col-span-4 space-y-4">
            <button
              type="button"
              onClick={() => handleNav('landing')}
              className="text-left rounded-xl"
              aria-label="ReValue home"
            >
              <BrandLogo size="md" variant="dark" showTagline={true} />
            </button>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Every phone has more value. A straightforward marketplace to buy and sell pre-owned smartphones with clear condition checks and fair resale estimates.
            </p>
            <button
              type="button"
              onClick={() => {
                if (onOpenValuator) onOpenValuator();
                else handleNav('marketplace');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              Get an instant resale estimate
              <ChevronRight className="w-3.5 h-3.5 text-brand-300" />
            </button>
          </div>

          {/* Shop */}
          <div className="md:col-span-2 lg:col-span-2 lg:col-start-6 space-y-3">
            <h4 className="text-2xs font-bold text-white uppercase tracking-[0.14em]">Shop Phones</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button type="button" onClick={() => handleNav('marketplace')} className={linkCls}>All Phones</button></li>
              <li><button type="button" onClick={() => handleNav('marketplace', { brand: 'Apple' })} className={linkCls}>Apple iPhones</button></li>
              <li><button type="button" onClick={() => handleNav('marketplace', { brand: 'Samsung' })} className={linkCls}>Samsung Galaxy</button></li>
              <li><button type="button" onClick={() => handleNav('marketplace', { brand: 'OnePlus' })} className={linkCls}>OnePlus</button></li>
            </ul>
          </div>

          {/* Sell */}
          <div className="md:col-span-2 lg:col-span-2 space-y-3">
            <h4 className="text-2xs font-bold text-white uppercase tracking-[0.14em]">Sell & Estimate</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button type="button" onClick={() => handleNav('create-listing')} className={linkCls}>Sell Your Phone</button></li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenValuator) onOpenValuator();
                    else handleNav('marketplace');
                  }}
                  className={linkCls}
                >
                  Instant Resale Estimate
                </button>
              </li>
              <li><button type="button" onClick={handleScrollToHowItWorks} className={linkCls}>How ReValue Works</button></li>
            </ul>
          </div>

          {/* Account */}
          <div className="col-span-2 md:col-span-3 lg:col-span-3 space-y-3">
            <h4 className="text-2xs font-bold text-white uppercase tracking-[0.14em]">Account</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button type="button" onClick={() => handleNav('buyer-dashboard')} className={linkCls}>My Orders & Offers</button></li>
              <li><button type="button" onClick={() => handleNav('seller-dashboard')} className={linkCls}>Seller Dashboard</button></li>
              <li>
                <button type="button" onClick={() => handleNav('delivery-partner-signup')} className="text-brand-300 hover:text-white transition-colors font-semibold text-left py-1">
                  Become a Delivery Partner
                </button>
              </li>
              <li><button type="button" onClick={() => handleNav('rider-dashboard')} className={linkCls}>Partner Dashboard</button></li>
              <li className="pt-1">
                <span className="text-slate-500">Local Verified Couriers & Payout Protection</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-2xs text-slate-500 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} ReValue. All rights reserved.
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-brand-300 shrink-0" />
            <span>Fulfillment Tracking & Buyer Payout Protection • Indian Rupee (₹)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
