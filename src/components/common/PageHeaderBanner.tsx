import React from 'react';
import { getPageTheme, PageTheme } from '../../constants/pageThemes';
import { motion } from 'motion/react';
import { getItemVariants } from '../../constants/motion';

interface PageHeaderBannerProps {
  themeKey: string;
  customTitle?: string;
  customSubtitle?: string;
  customBadge?: string;
  children?: React.ReactNode;
}

/**
 * Visual identity hero banner for sub-pages.
 * Displays page-specific icon, title, description, and themed accent glow
 * adhering to the unified dark + amber/gold/orange color palette.
 */
export const PageHeaderBanner: React.FC<PageHeaderBannerProps> = ({
  themeKey,
  customTitle,
  customSubtitle,
  customBadge,
  children,
}) => {
  const theme: PageTheme = getPageTheme(themeKey, {
    title: customTitle,
    subtitle: customSubtitle,
    badge: customBadge,
  });

  const IconComponent = theme.icon;

  return (
    <motion.div
      variants={getItemVariants()}
      className="relative overflow-hidden bg-gradient-to-b from-slate-900/90 via-slate-900/50 to-slate-950 border-b border-slate-800/80 pt-8 pb-10 sm:pt-10 sm:pb-12"
    >
      {/* Ambient background glow matching page accent */}
      <div
        className={`absolute top-0 right-1/4 w-96 h-96 ${theme.glowColor} blur-[120px] rounded-full pointer-events-none opacity-40`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            {/* Themed Icon Box */}
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${theme.iconBg} ${theme.iconBorder} border flex items-center justify-center shrink-0 shadow-lg shadow-black/40`}
            >
              <IconComponent className={`w-7 h-7 sm:w-8 sm:h-8 ${theme.iconText} stroke-[2.2]`} />
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText} inline-block`}
                >
                  {theme.badge}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {theme.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
                {theme.subtitle}
              </p>
            </div>
          </div>

          {/* Optional Action / Children Slot */}
          {children && <div className="shrink-0">{children}</div>}
        </div>
      </div>
    </motion.div>
  );
};
