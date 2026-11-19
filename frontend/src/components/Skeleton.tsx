import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col gap-3 shadow-xs">
      <Skeleton className="w-full aspect-[4/3] rounded-xl" />
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-4 w-3/5 rounded-md" />
      </div>
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-auto">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
};

export const MarketplaceGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center justify-between shadow-xs">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="w-12 h-12 rounded-xl" />
    </div>
  );
};

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <Skeleton className="h-6 w-32 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="w-full aspect-[4/3] rounded-2xl" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-20 h-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
            <Skeleton className="h-9 w-4/5 rounded-lg" />
            <Skeleton className="h-5 w-3/5 rounded-md" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
