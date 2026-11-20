import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Heart, Bell, PlusCircle,
  LogOut, ChevronDown, Package, Handshake,
  Menu, X, ArrowRight, ShieldCheck, Sparkles, User as UserIcon, Bike,
  Home, Smartphone, LayoutGrid, BellOff, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Notification } from '../types';
import { BrandLogo } from './BrandLogo';
import { useDialogA11y } from './ui/useDialogA11y';

interface NavbarProps {
  onNavigate: (page: string, params?: any) => void;
  currentPage: string;
  onOpenValuator: () => void;
  onOpenAuth: () => void;
}

/** Closes a popover on outside pointer-down or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const isRiderPage = (p: string) => p === 'rider' || p.startsWith('rider-') || p.startsWith('rider/');

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  currentPage,
  onOpenValuator,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [wishlistCount, setWishlistCount] = useState<number>(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const closeNotifs = React.useCallback(() => setShowNotifs(false), []);
  const closeUserMenu = React.useCallback(() => setShowUserMenu(false), []);
  const closeMobile = React.useCallback(() => setMobileMenuOpen(false), []);
  const notifsRef = useDismiss(showNotifs, closeNotifs);
  const userMenuRef = useDismiss(showUserMenu, closeUserMenu);
  const drawerRef = useDialogA11y<HTMLDivElement>(mobileMenuOpen, closeMobile);

  useEffect(() => {
    if (isAuthenticated) {
      api.getNotifications()
        .then(setNotifications)
        .catch(() => {});
      api.getWishlist()
        .then(items => setWishlistCount(items.length))
        .catch(() => {});
    } else {
      setWishlistCount(0);
      setNotifications([]);
    }
  }, [isAuthenticated]);

  // Subtle elevation once the page scrolls
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close popovers on route change
  useEffect(() => {
    setShowNotifs(false);
    setShowUserMenu(false);
    setMobileMenuOpen(false);
  }, [currentPage]);

  // Mobile bottom navigation is shown everywhere except rider pages (they ship their own)
  const showBottomNav = !isRiderPage(currentPage);
  useEffect(() => {
    document.body.classList.toggle('rv-has-bottom-nav', showBottomNav);
    return () => document.body.classList.remove('rv-has-bottom-nav');
  }, [showBottomNav]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('marketplace', { query: searchQuery.trim() });
      setMobileMenuOpen(false);
    }
  };

  const handleHowItWorksClick = () => {
    if (currentPage !== 'landing') {
      onNavigate('landing');
      setTimeout(() => {
        const el = document.getElementById('how-it-works');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      const el = document.getElementById('how-it-works');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const navLinkClass = (active: boolean) =>
    `relative px-3.5 py-2 rounded-xl transition-colors ${
      active
        ? 'text-brand-700 bg-brand-50'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const searchInputClass =
    'w-full pl-10 pr-4 py-2.5 bg-slate-100/70 hover:bg-slate-100 focus:bg-white text-xs font-medium rounded-xl border border-transparent outline-none transition-all placeholder:text-slate-400';

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b transition-shadow duration-200 ${
          scrolled ? 'border-slate-200 shadow-[0_4px_20px_-12px_rgb(53_20_127/0.18)]' : 'border-slate-200/70'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3 lg:gap-6">
            {/* Left: Mobile Menu Toggle & Brand Logo */}
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden w-10 h-10 -ml-2 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => { onNavigate('landing'); setMobileMenuOpen(false); }}
                className="flex items-center cursor-pointer select-none rounded-xl"
                aria-label="ReValue Home"
              >
                <BrandLogo size="md" />
              </button>
            </div>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold" aria-label="Primary">
              <button onClick={() => onNavigate('marketplace')} className={navLinkClass(currentPage === 'marketplace')} aria-current={currentPage === 'marketplace' ? 'page' : undefined}>
                Buy Phones
              </button>
              <button onClick={() => onNavigate('create-listing')} className={navLinkClass(currentPage === 'create-listing')} aria-current={currentPage === 'create-listing' ? 'page' : undefined}>
                Sell Your Phone
              </button>
              <button onClick={handleHowItWorksClick} className={navLinkClass(false)}>
                How It Works
              </button>
            </nav>

            {/* Desktop Search Bar (Center) */}
            <form onSubmit={handleSearchSubmit} className="hidden md:flex lg:hidden xl:flex flex-1 max-w-xl relative" role="search">
              <label htmlFor="nav-search-desktop" className="sr-only">Search phones</label>
              <input
                id="nav-search-desktop"
                type="text"
                placeholder="Search phones by brand or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={searchInputClass}
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </form>

            {/* Right: actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={onOpenValuator}
                className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 transition-colors mr-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                <span>Estimate Value</span>
              </button>

              {/* Wishlist Link */}
              {isAuthenticated && (
                <button
                  onClick={() => onNavigate('buyer-dashboard')}
                  className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl relative transition-colors"
                  title="Saved Phones"
                  aria-label={`Saved Phones${wishlistCount ? ` (${wishlistCount})` : ''}`}
                >
                  <Heart className="w-[18px] h-[18px]" />
                  {wishlistCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-brand-600 text-white text-3xs font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                      {wishlistCount}
                    </span>
                  )}
                </button>
              )}

              {/* Notifications */}
              {isAuthenticated && (
                <div className="relative" ref={notifsRef}>
                  <button
                    onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl relative transition-colors ${
                      showNotifs ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Notifications"
                    aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                    aria-expanded={showNotifs}
                    aria-haspopup="true"
                  >
                    <Bell className="w-[18px] h-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-3xs font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifs && (
                    <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-[3.75rem] sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <span className="text-sm font-bold text-slate-900">
                          Notifications <span className="text-slate-400 font-semibold">({notifications.length})</span>
                        </span>
                        {unreadCount > 0 && (
                          <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold">
                            {unreadCount} unread
                          </span>
                        )}
                      </div>
                      <div className="max-h-[22rem] overflow-y-auto p-2 space-y-1">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center text-center py-10 px-6">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                              <BellOff className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                            <p className="text-2xs text-slate-400 mt-0.5">Offer, order and auction updates will appear here.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n._id}
                              className={`flex gap-3 px-3 py-2.5 rounded-xl text-xs ${
                                n.is_read ? 'text-slate-600 hover:bg-slate-50' : 'bg-brand-50/70 text-slate-900 font-semibold'
                              }`}
                            >
                              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-slate-300' : 'bg-brand-500'}`} />
                              <p className="line-clamp-3 leading-relaxed">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Account / Sign In */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
                    className={`flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-2.5 rounded-xl border transition-colors ${
                      showUserMenu ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                    aria-expanded={showUserMenu}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                  >
                    <span className="w-8 h-8 rounded-[10px] bg-brand-gradient text-white text-2xs font-bold flex items-center justify-center">
                      {initials}
                    </span>
                    <span className="hidden sm:block max-w-[120px] truncate text-xs font-semibold text-slate-800">{user?.name || 'Account'}</span>
                    <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showUserMenu && (
                    <div role="menu" className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-3 px-3 py-3 mb-1 rounded-xl bg-page-gradient">
                        <span className="w-10 h-10 rounded-xl bg-brand-gradient text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate text-sm">{user?.name}</span>
                          <span className="text-2xs text-slate-500 block truncate">{user?.email}</span>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-white text-brand-700 border border-brand-100">
                            {user?.role}
                          </span>
                        </div>
                      </div>

                      <MenuItem icon={Package} onClick={() => { onNavigate('buyer-dashboard'); setShowUserMenu(false); }}>
                        My Purchases & Offers
                      </MenuItem>
                      <MenuItem icon={Handshake} onClick={() => { onNavigate('seller-dashboard'); setShowUserMenu(false); }}>
                        Seller Dashboard
                      </MenuItem>

                      {user?.role === 'rider' && (
                        <MenuItem icon={Bike} highlight onClick={() => { onNavigate('rider-dashboard'); setShowUserMenu(false); }}>
                          Rider Dashboard
                        </MenuItem>
                      )}

                      {user?.role === 'admin' && (
                        <MenuItem icon={ShieldCheck} iconClass="text-amber-500" onClick={() => { onNavigate('admin-dashboard'); setShowUserMenu(false); }}>
                          Admin Dashboard
                        </MenuItem>
                      )}

                      {user?.role !== 'rider' && (
                        <MenuItem icon={Bike} onClick={() => { onNavigate('delivery-partner-signup'); setShowUserMenu(false); }}>
                          Become a Delivery Partner
                        </MenuItem>
                      )}

                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          role="menuitem"
                          onClick={() => { logout(); setShowUserMenu(false); }}
                          className="w-full text-left px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-semibold"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="ml-1 px-4 sm:px-5 h-10 rv-btn-primary font-bold text-xs rounded-xl"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile Search Field (Persistent below header on mobile) */}
          {!isRiderPage(currentPage) && (
            <div className="md:hidden pb-3">
              <form onSubmit={handleSearchSubmit} className="relative" role="search">
                <label htmlFor="nav-search-mobile" className="sr-only">Search phones</label>
                <input
                  id="nav-search-mobile"
                  type="search"
                  enterKeyHint="search"
                  placeholder="Search phones by brand or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={searchInputClass}
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] rv-fade" onClick={closeMobile} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 w-[86%] max-w-sm bg-white shadow-2xl flex flex-col rv-drawer-left"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 shrink-0">
              <BrandLogo size="sm" />
              <button onClick={closeMobile} className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-sm font-semibold text-slate-800" aria-label="Mobile">
              <DrawerItem icon={Smartphone} active={currentPage === 'marketplace'} onClick={() => { onNavigate('marketplace'); setMobileMenuOpen(false); }}>
                Buy Phones
              </DrawerItem>
              <DrawerItem icon={PlusCircle} active={currentPage === 'create-listing'} onClick={() => { onNavigate('create-listing'); setMobileMenuOpen(false); }}>
                Sell Your Phone
              </DrawerItem>
              <DrawerItem icon={HelpCircle} onClick={handleHowItWorksClick}>
                How It Works
              </DrawerItem>
              <DrawerItem icon={Sparkles} accent onClick={() => { onOpenValuator(); setMobileMenuOpen(false); }}>
                Estimate Phone Value
              </DrawerItem>

              {isAuthenticated ? (
                <>
                  <p className="px-3 pt-5 pb-1.5 text-3xs font-bold uppercase tracking-wider text-slate-400">Your account</p>
                  <DrawerItem icon={Package} active={currentPage === 'buyer-dashboard'} onClick={() => { onNavigate('buyer-dashboard'); setMobileMenuOpen(false); }}>
                    My Orders & Offers
                  </DrawerItem>
                  <DrawerItem icon={Handshake} active={currentPage === 'seller-dashboard'} onClick={() => { onNavigate('seller-dashboard'); setMobileMenuOpen(false); }}>
                    Seller Dashboard
                  </DrawerItem>
                  {user?.role === 'admin' && (
                    <DrawerItem icon={ShieldCheck} active={currentPage === 'admin-dashboard'} onClick={() => { onNavigate('admin-dashboard'); setMobileMenuOpen(false); }}>
                      Admin Dashboard
                    </DrawerItem>
                  )}
                  {user?.role === 'rider' ? (
                    <DrawerItem icon={Bike} accent onClick={() => { onNavigate('rider-dashboard'); setMobileMenuOpen(false); }}>
                      Rider Dashboard
                    </DrawerItem>
                  ) : (
                    <DrawerItem icon={Bike} onClick={() => { onNavigate('delivery-partner-signup'); setMobileMenuOpen(false); }}>
                      Become a Delivery Partner
                    </DrawerItem>
                  )}
                </>
              ) : null}
            </nav>

            <div className="p-4 border-t border-slate-100 shrink-0">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-1">
                    <span className="w-10 h-10 rounded-xl bg-brand-gradient text-white text-xs font-bold flex items-center justify-center shrink-0">{initials}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                      <p className="text-2xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="w-full h-11 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-50"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}
                  className="w-full h-12 rv-btn-primary font-bold text-sm rounded-xl text-center"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      {showBottomNav && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/92 backdrop-blur-xl border-t border-slate-200 shadow-[0_-8px_24px_-16px_rgb(53_20_127/0.25)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="Quick navigation"
        >
          <div className="grid grid-cols-5 h-16 max-w-xl mx-auto">
            <BottomItem icon={Home} label="Home" active={currentPage === 'landing'} onClick={() => onNavigate('landing')} />
            <BottomItem icon={Smartphone} label="Buy" active={currentPage === 'marketplace' || currentPage === 'product-detail'} onClick={() => onNavigate('marketplace')} />
            <div className="flex items-center justify-center">
              <button
                onClick={() => onNavigate('create-listing')}
                aria-label="Sell your phone"
                aria-current={currentPage === 'create-listing' ? 'page' : undefined}
                className="-mt-6 w-14 h-14 rounded-2xl rv-btn-primary flex items-center justify-center ring-4 ring-white"
              >
                <PlusCircle className="w-6 h-6" />
              </button>
            </div>
            <BottomItem icon={Sparkles} label="Estimate" onClick={onOpenValuator} />
            {isAuthenticated ? (
              <BottomItem
                icon={LayoutGrid}
                label="Account"
                active={['buyer-dashboard', 'seller-dashboard', 'admin-dashboard'].includes(currentPage)}
                onClick={() => onNavigate(user?.role === 'admin' ? 'admin-dashboard' : 'buyer-dashboard')}
              />
            ) : (
              <BottomItem icon={UserIcon} label="Sign In" onClick={onOpenAuth} />
            )}
          </div>
        </nav>
      )}
    </>
  );
};

/* -------------------------------------------------------------------- */

const MenuItem: React.FC<{
  icon: React.ElementType;
  onClick: () => void;
  children: React.ReactNode;
  highlight?: boolean;
  iconClass?: string;
}> = ({ icon: Icon, onClick, children, highlight, iconClass }) => (
  <button
    role="menuitem"
    onClick={onClick}
    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors ${
      highlight ? 'text-brand-700 bg-brand-50 hover:bg-brand-100 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
    }`}
  >
    <Icon className={`w-4 h-4 ${iconClass || (highlight ? 'text-brand-600' : 'text-slate-400')}`} />
    <span>{children}</span>
  </button>
);

const DrawerItem: React.FC<{
  icon: React.ElementType;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  accent?: boolean;
}> = ({ icon: Icon, onClick, children, active, accent }) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`w-full text-left px-3 h-12 rounded-xl flex items-center justify-between transition-colors ${
      active ? 'bg-brand-50 text-brand-700' : accent ? 'text-brand-700 hover:bg-brand-50' : 'hover:bg-slate-50'
    }`}
  >
    <span className="flex items-center gap-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active || accent ? 'bg-white text-brand-600 shadow-xs' : 'bg-slate-100 text-slate-500'}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span>{children}</span>
    </span>
    <ArrowRight className={`w-4 h-4 ${active || accent ? 'text-brand-500' : 'text-slate-300'}`} />
  </button>
);

const BottomItem: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; active?: boolean }> = ({
  icon: Icon,
  label,
  onClick,
  active,
}) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`relative flex flex-col items-center justify-center gap-1 text-3xs font-bold transition-colors ${
      active ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand-gradient" />}
    <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.3 : 1.9} />
    <span>{label}</span>
  </button>
);
