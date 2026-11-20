import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PageLoader, FullScreenLoader } from './components/ui/Loader';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { AiPriceValuatorModal } from './components/AiPriceValuatorModal';
import { AuthModal } from './components/AuthModal';
const MarketplacePage = lazy(() => import('./pages/MarketplacePage').then((m) => ({ default: m.MarketplacePage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const CreateListingPage = lazy(() => import('./pages/CreateListingPage').then((m) => ({ default: m.CreateListingPage })));
const BuyerDashboard = lazy(() => import('./pages/BuyerDashboard').then((m) => ({ default: m.BuyerDashboard })));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard').then((m) => ({ default: m.SellerDashboard })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const DeliveryTrackingPage = lazy(() => import('./pages/DeliveryTrackingPage').then((m) => ({ default: m.DeliveryTrackingPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const DeliveryPartnerSignupPage = lazy(() => import('./pages/DeliveryPartnerSignupPage').then((m) => ({ default: m.DeliveryPartnerSignupPage })));
const DeliveryPartnerApplicationStatusPage = lazy(() => import('./pages/DeliveryPartnerApplicationStatusPage').then((m) => ({ default: m.DeliveryPartnerApplicationStatusPage })));
const RiderDashboard = lazy(() => import('./pages/RiderDashboard').then((m) => ({ default: m.RiderDashboard })));
const RiderJobsPage = lazy(() => import('./pages/RiderJobsPage').then((m) => ({ default: m.RiderJobsPage })));
const RiderJobDetailPage = lazy(() => import('./pages/RiderJobDetailPage').then((m) => ({ default: m.RiderJobDetailPage })));
const RiderEarningsPage = lazy(() => import('./pages/RiderEarningsPage').then((m) => ({ default: m.RiderEarningsPage })));
const RiderProfilePage = lazy(() => import('./pages/RiderProfilePage').then((m) => ({ default: m.RiderProfilePage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

const getInitialPage = () => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '') || '';
    if (hash) return hash.split('?')[0];
    const path = window.location.pathname.replace(/^\//, '') || '';
    if (path) return path.split('?')[0];
  }
  return 'landing';
};

const getInitialParams = () => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '') || '';
    const parts = hash.split('?');
    if (parts[1]) {
      return Object.fromEntries(new URLSearchParams(parts[1]));
    }
    const search = window.location.search;
    if (search) {
      return Object.fromEntries(new URLSearchParams(search));
    }
  }
  return {};
};

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>(getInitialPage);
  const [pageParams, setPageParams] = useState<any>(getInitialParams);
  const [showValuator, setShowValuator] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isLoading: authLoading } = useAuth();
  // Only show the boot splash when a stored session is actually being restored
  const [restoringSession] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('revalue_token'));

  // Sync with browser hash if present
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') || 'landing';
      const [page, queryString] = hash.split('?');
      setCurrentPage(page);
      if (queryString) {
        const params = Object.fromEntries(new URLSearchParams(queryString));
        setPageParams(params);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (page: string, params: any = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    const query = new URLSearchParams(params).toString();
    window.location.hash = query ? `${page}?${query}` : page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {restoringSession && authLoading && <FullScreenLoader label="Restoring your session…" />}

      <Navbar
        onNavigate={navigate}
        currentPage={currentPage}
        onOpenValuator={() => setShowValuator(true)}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      <main className="flex-1 min-w-0">
        <Suspense fallback={<PageLoader label="Loading page…" />}>
        <div key={currentPage} className="rv-page-enter">
        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={navigate}
            onOpenValuator={() => setShowValuator(true)}
          />
        )}

        {currentPage === 'marketplace' && (
          <MarketplacePage
            onNavigate={navigate}
            initialQuery={pageParams.query || ''}
            initialBrand={pageParams.brand || ''}
            initialCondition={pageParams.condition || ''}
          />
        )}

        {currentPage === 'product-detail' && (
          <ProductDetailPage
            productId={pageParams.id}
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenValuator={() => setShowValuator(true)}
          />
        )}

        {currentPage === 'create-listing' && (
          <CreateListingPage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {currentPage === 'buyer-dashboard' && (
          <BuyerDashboard
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {currentPage === 'seller-dashboard' && (
          <SellerDashboard
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {currentPage === 'checkout' && (
          <CheckoutPage
            productId={pageParams.productId}
            source={pageParams.source}
            offerId={pageParams.offerId}
            auctionId={pageParams.auctionId}
            orderId={pageParams.orderId}
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'delivery-tracking' || currentPage === 'tracking') && (
          <DeliveryTrackingPage
            orderId={pageParams.orderId}
            onNavigate={navigate}
          />
        )}

        {currentPage === 'admin-dashboard' && (
          <AdminDashboard
            onNavigate={navigate}
          />
        )}

        {(currentPage === 'forgot-password' || currentPage === 'forgot') && (
          <ForgotPasswordPage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'reset-password' || currentPage === 'reset') && (
          <ResetPasswordPage
            token={pageParams.token}
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'delivery-partner-signup' || currentPage === 'delivery-partner/signup') && (
          <DeliveryPartnerSignupPage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'delivery-partner-application' || currentPage === 'delivery-partner/application') && (
          <DeliveryPartnerApplicationStatusPage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'rider-dashboard' || currentPage === 'rider/dashboard' || currentPage === 'rider') && (
          <RiderDashboard
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'rider-jobs' || currentPage === 'rider/jobs') && (
          <RiderJobsPage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'rider-job-detail' || currentPage === 'rider/job') && (
          <RiderJobDetailPage
            jobId={pageParams.jobId}
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'rider-earnings' || currentPage === 'rider/earnings') && (
          <RiderEarningsPage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {(currentPage === 'rider-profile' || currentPage === 'rider/profile') && (
          <RiderProfilePage
            onNavigate={navigate}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}
        </div>
        </Suspense>
      </main>

      <Footer
        onNavigate={navigate}
        onOpenValuator={() => setShowValuator(true)}
      />

      {/* Global Modals */}
      <AiPriceValuatorModal
        isOpen={showValuator}
        onClose={() => setShowValuator(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onNavigate={navigate}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
