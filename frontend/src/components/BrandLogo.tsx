import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  showTagline?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'light',
  showTagline = false,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-8 h-8 p-1.5 rounded-[10px]',
    md: 'w-9 h-9 p-2 sm:w-10 sm:h-10 rounded-xl',
    lg: 'w-12 h-12 p-2.5 rounded-2xl',
  }[size];

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-[1.4rem]',
    lg: 'text-3xl',
  }[size];

  const textColorRe = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const textColorValue = variant === 'dark' ? 'text-brand-300' : 'text-brand-600';
  const taglineColor = variant === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Emblem */}
      <div
        className={`${iconDimensions} bg-brand-gradient flex items-center justify-center shrink-0 shadow-md shadow-brand-700/25 ring-1 ring-inset ring-white/15`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="3.2" stroke="#ffffff" strokeWidth="1.9" />
          <path d="M10 5H14" stroke="#d9cefc" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8.5 13.5L12 10L15.5 13.5" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 10V16.5" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </div>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline">
          <span className={`${textSizes} font-extrabold tracking-[-0.03em] ${textColorRe}`}>Re</span>
          <span className={`${textSizes} font-extrabold tracking-[-0.03em] ${textColorValue}`}>Value</span>
        </div>
        {showTagline && (
          <span className={`text-2xs font-medium tracking-tight mt-1 ${taglineColor}`}>Every phone has more value</span>
        )}
      </div>
    </div>
  );
};
