import React from 'react';
import { Heart, Gavel, ArrowRight, Smartphone } from 'lucide-react';
import { Product } from '../types';
import { resolveMediaUrl } from '../services/api';
import { formatCurrency, getConditionMeta } from '../utils/formatters';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (e: React.MouseEvent) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  isWishlisted = false,
  onToggleWishlist,
}) => {
  const conditionMeta = getConditionMeta(product.condition);

  const hasImage = Boolean(product.images && product.images.length > 0 && product.images[0]);
  const isBidding = product.selling_method === 'bidding';
  const displayedPrice = isBidding
    ? (product.starting_bid ?? product.auction_info?.starting_bid ?? product.asking_price)
    : product.asking_price;

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onClick();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`${product.title}, ${formatCurrency(displayedPrice)}`}
      className="group bg-white rounded-2xl border border-slate-200 hover:border-brand-200 flex flex-col overflow-hidden cursor-pointer relative product-card-hover h-full"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-50 to-brand-50/60 flex items-center justify-center p-4 sm:p-5 overflow-hidden">
        {hasImage ? (
          <img
            src={resolveMediaUrl(product.images[0])}
            alt={`${product.brand} ${product.model}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain drop-shadow-[0_10px_18px_rgb(23_20_43/0.14)] group-hover:scale-[1.06] transition-transform duration-500 ease-out"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-2 text-slate-300 group-hover:text-brand-400 transition-colors">
            <Smartphone className="w-12 h-12 stroke-[1.4]" />
            <span className="text-3xs font-bold text-slate-400 mt-1.5 uppercase tracking-wider">
              {product.brand}
            </span>
          </div>
        )}

        {/* Condition Badge (Top Left) */}
        <div className="absolute top-2.5 left-2.5 z-10 max-w-[calc(100%-3.5rem)]">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-3xs font-bold uppercase tracking-wide border shadow-xs ${conditionMeta.badgeClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conditionMeta.dotColor}`} />
            <span className="truncate">{conditionMeta.shortLabel}</span>
          </span>
        </div>

        {/* Wishlist Button (Top Right) */}
        {onToggleWishlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(e);
            }}
            className={`absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-white/95 shadow-sm transition-all z-10 active:scale-90 ${
              isWishlisted ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'
            }`}
            aria-label={isWishlisted ? "Remove from saved phones" : "Save phone to wishlist"}
            aria-pressed={isWishlisted}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500' : ''}`} />
          </button>
        )}

        {/* Auction Flag (Bottom Right) */}
        {isBidding && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-3xs font-bold bg-amber-500 text-white shadow-sm">
              <Gavel className="w-3 h-3" />
              Sealed Auction
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2.5 border-t border-slate-100">
        <div className="min-w-0">
          {/* Brand & City */}
          <div className="flex items-center justify-between gap-2 text-3xs font-semibold mb-1">
            <span className="uppercase tracking-wider text-brand-600 font-bold truncate">{product.brand}</span>
            {product.location_city && (
              <span className="truncate max-w-[50%] text-slate-400">{product.location_city}</span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-2 sm:line-clamp-1 text-xs sm:text-sm leading-snug">
            {product.title}
          </h3>

          {/* Hardware Specs line */}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {product.specs?.storage_gb && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-3xs sm:text-2xs font-semibold text-slate-600">{product.specs.storage_gb} GB</span>
            )}
            {product.specs?.ram_gb && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-3xs sm:text-2xs font-semibold text-slate-600">{product.specs.ram_gb} GB RAM</span>
            )}
            {product.specs?.battery_health_percent && (
              <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-3xs sm:text-2xs font-semibold text-green-700">{product.specs.battery_health_percent}% Bat</span>
            )}
          </div>
        </div>

        {/* Price & Action Footer */}
        <div className="pt-2.5 border-t border-slate-100 flex items-end justify-between gap-2 mt-auto">
          <div className="min-w-0">
            <div className="text-3xs uppercase font-bold text-slate-400 tracking-wider">
              {isBidding ? 'Starting Bid' : 'Price'}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight tracking-tight truncate">
              {formatCurrency(displayedPrice)}
            </div>
          </div>

          <span
            aria-hidden="true"
            className="hidden sm:inline-flex px-3 py-2 bg-slate-900 group-hover:bg-brand-600 text-white text-2xs font-bold rounded-xl transition-colors items-center gap-1 shrink-0"
          >
            <span>View</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
          <span aria-hidden="true" className="sm:hidden w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
};
