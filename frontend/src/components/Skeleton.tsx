import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return <div className={`rv-skeleton rounded-md ${className}`} aria-hidden="true" />;
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-xs">
      <Skeleton className="w-full aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-3.5 w-3/5 rounded-md" />
      </div>
      <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-12 rounded" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
    </div>
  );
};

export const MarketplaceGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div
      role="status"
      aria-label="Loading phones"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-xs">
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="w-12 h-12 rounded-xl" />
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div role="status" aria-label="Loading records" className="divide-y divide-slate-100">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 px-5 py-4">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        {Array.from({ length: cols - 1 }).map((__, c) => (
          <Skeleton key={c} className={`h-3.5 rounded ${c === 0 ? 'flex-[2]' : 'flex-1'}`} />
        ))}
      </div>
    ))}
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div role="status" aria-label="Loading" className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl hidden sm:block" />
      </div>
    ))}
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading dashboard" className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      {[1, 2, 3, 4].map((i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
    <ListSkeleton rows={4} />
  </div>
);

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading phone details" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12 py-6 sm:py-10 space-y-8">
      <Skeleton className="h-5 w-40 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="w-full aspect-[4/3] rounded-3xl" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-20 h-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-10 w-4/5 rounded-lg" />
            <Skeleton className="h-5 w-3/5 rounded-md" />
          </div>
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
};
