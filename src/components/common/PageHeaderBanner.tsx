import React from 'react';
import { getPageTheme, PageTheme } from '../../constants/pageThemes';
import { motion } from 'motion/react';
import { getItemVariants } from '../../constants/motion';

interface PageIntroProps {
  themeKey: string;
  customSubtitle?: string;
  customBadge?: string;
}

/**
 * Optional page intro banner displaying badge and subtitle only on sm+ screens.
 * No menu button, no back button, no h1.
 */
export const PageIntro: React.FC<PageIntroProps> = ({
  themeKey,
  customSubtitle,
  customBadge,
}) => {
  const theme: PageTheme = getPageTheme(themeKey, {
    subtitle: customSubtitle,
    badge: customBadge,
  });

  return (
    <motion.div
      variants={getItemVariants()}
      className="hidden sm:block relative overflow-hidden bg-gradient-to-b from-slate-900/90 via-slate-900/50 to-slate-950 border-b border-slate-800/80 pt-4 pb-5 sm:pt-6 sm:pb-6"
    >
      <div
        className={`absolute top-0 start-1/4 w-96 h-96 ${theme.glowColor} blur-[120px] rounded-full pointer-events-none opacity-40`}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-2">
        {theme.badge && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText} inline-block`}
            >
              {theme.badge}
            </span>
          </div>
        )}
        {theme.subtitle && (
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
            {theme.subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export const PageHeaderBanner = PageIntro;
