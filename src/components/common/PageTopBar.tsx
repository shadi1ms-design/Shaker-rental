import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MenuButton } from '../MenuButton';

interface PageTopBarProps {
  title: string;
  onBack?: () => void;
  badge?: string;
}

/**
 * Non-sticky top bar for all sub-pages (Fleet, Car Details, Booking, Profile, Auth, Contact, Admin, etc.)
 * Contains:
 * - Unified MenuButton (☰) in the exact rightmost position matching Navbar.
 * - Back button (when onBack provided).
 * - Page title and optional badge.
 * - Clean layout without excessive lateral margins.
 */
export const PageTopBar: React.FC<PageTopBarProps> = ({ title, onBack, badge }) => {
  return (
    <header className="relative z-10 w-full bg-slate-950/95 border-b border-slate-800/80 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 sm:gap-4">
        {/* Right side in RTL: MenuButton + Back Button + Page Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <MenuButton />

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all text-xs font-bold shrink-0 shadow-sm active:scale-95 cursor-pointer"
              aria-label="رجوع إلى الصفحة السابقة"
              title="رجوع"
              id="topbar-back-btn"
            >
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden xs:inline">رجوع</span>
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-lg font-black text-white truncate tracking-tight">
              {title}
            </h1>
            {badge && (
              <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0">
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Brand hint on left */}
        <div className="hidden sm:flex items-center text-xs text-slate-400 font-medium shrink-0">
          <span>شاكر لتأجير السيارات • دمشق</span>
        </div>
      </div>
    </header>
  );
};
