import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Calendar, CheckCircle2, MessageCircle } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { GlobalMenu } from '../components/GlobalMenu';
import { BackContext } from '../contexts/BackContext';
import { useAppData } from '../contexts/DataContext';
import { useBrowseFleet } from '../hooks/useBrowseFleet';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  getCanonicalPath,
  getMenuSection,
  goBack,
  navigate,
  routes,
  useLocation,
  type ResolvedRoute,
} from '../router';
import { getPageMeta } from '../routes/pageMeta';
import { STARTING_DAILY_PRICE } from '../constants/company';
import { openWhatsAppChat } from '../services/whatsapp';

interface SiteLayoutProps {
  route: ResolvedRoute;
  children: React.ReactNode;
}

/** Where the top-bar back button goes, per page. */
function goBackFrom(route: ResolvedRoute): void {
  switch (route.name) {
    case 'book':
      goBack(routes.car(route.params.id));
      break;
    case 'car':
      goBack(routes.cars);
      break;
    case 'login':
    case 'register':
      goBack(routes.home);
      break;
    default:
      navigate(routes.home);
  }
}

/** Shared chrome of the public site: menu, AppHeader, booking banner, WhatsApp button and footer. */
export const SiteLayout: React.FC<SiteLayoutProps> = ({ route, children }) => {
  const { vehicles, vehiclesReady, lastCreatedBooking, dismissLastBooking } = useAppData();
  const browseFleet = useBrowseFleet();
  const { pathname } = useLocation();
  const mobileCtaBarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const prevPathnameRef = useRef<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const routeVehicleId = route.params.id;
  const routeVehicle = routeVehicleId ? vehicles.find((v) => v.id === routeVehicleId) || null : null;
  const isMissingVehicle = Boolean(routeVehicleId && vehiclesReady && !routeVehicle);
  const meta = getPageMeta(route.name, routeVehicle);
  const canonicalPath = isMissingVehicle ? routes.cars : getCanonicalPath(route);

  useDocumentTitle(meta.docTitle, meta.description, {
    canonicalPath,
    noindex: meta.noindex || isMissingVehicle,
  });

  // Move focus to #main-content and announce page title on pathname changes (not hash-only or query-only changes)
  useEffect(() => {
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname;
      return;
    }
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;

    const titleText =
      meta.docTitle === 'الرئيسية' ? 'الصفحة الرئيسية - شاكر لتأجير السيارات' : meta.docTitle;
    const rafId = window.requestAnimationFrame(() => {
      setLiveAnnouncement(`تم الانتقال إلى ${titleText}`);
      mainContentRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [pathname, meta.docTitle]);

  const isHome = route.name === 'home';
  const isBookPage = route.name === 'book';
  const showMobileBookBar = route.name === 'home' || route.name === 'cars';

  const getAuthTarget = (mode: 'login' | 'register' = 'login'): string => {
    const base = mode === 'register' ? routes.register : routes.login;
    if (typeof window === 'undefined') return base;
    if (route.name === 'login' || route.name === 'register') {
      return window.location.search ? `${base}${window.location.search}` : base;
    }
    if (route.name !== 'home' && route.name !== 'notFound') {
      const returnTo = window.location.pathname + window.location.search;
      return `${base}?redirect=${encodeURIComponent(returnTo)}`;
    }
    return base;
  };

  const openAuth = (mode: 'login' | 'register' = 'login') => {
    navigate(getAuthTarget(mode));
  };
  const openProfile = () => navigate(routes.profile);

  // Sync --bottom-bar-h when the mobile bottom CTA bar is active so the WhatsApp FAB never overlaps it
  useEffect(() => {
    if (!showMobileBookBar) return;
    const barEl = mobileCtaBarRef.current;
    if (!barEl) return;

    const updateHeight = () => {
      const h = Math.round(barEl.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--bottom-bar-h', `${h}px`);
    };

    updateHeight();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--bottom-bar-h', `${Math.round(h)}px`);
      }
    });
    observer.observe(barEl);

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--bottom-bar-h', '0px');
    };
  }, [showMobileBookBar]);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col font-cairo overflow-x-clip">
      {/* Polite live region for screen reader route announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-amber-500 focus:text-slate-950 font-bold"
      >
        تخطي إلى المحتوى
      </a>

      <BackContext.Provider value={isHome ? null : () => goBackFrom(route)}>
        {/* Global Slide-out Navigation Drawer (Controlled via MenuContext) */}
        <GlobalMenu
          currentView={getMenuSection(route.name)}
          onOpenBooking={browseFleet}
          onOpenAuth={openAuth}
          onOpenProfile={openProfile}
        />

        {/* Unified AppHeader */}
        <AppHeader
          route={route}
          vehicle={routeVehicle}
          loginHref={getAuthTarget('login')}
          registerHref={getAuthTarget('register')}
          onOpenBooking={browseFleet}
          onOpenProfile={openProfile}
        />

        {/* Booking Status Alert Banner */}
        {lastCreatedBooking && (
          <div className="bg-amber-500 text-slate-950 font-semibold px-4 py-2.5 text-sm text-center flex items-center justify-center gap-2 sticky top-16 z-30 shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              تم استلام طلب حجزك رقم <strong className="tabular-nums font-extrabold">{lastCreatedBooking.bookingNumber}</strong> وهو الآن بانتظار موافقة الإدارة.
            </span>
            <button
              type="button"
              onClick={dismissLastBooking}
              className="min-h-11 px-3 ms-2 text-sm underline font-bold cursor-pointer inline-flex items-center"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Bottom padding avoids overlap with fixed mobile bars & floating WhatsApp button */}
        <main
          ref={mainContentRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 pb-32 sm:pb-36 outline-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <React.Fragment key={`${route.name}:${route.params.id ?? ''}`}>
              {children}
            </React.Fragment>
          </AnimatePresence>
        </main>

        {/* Mobile Fixed Quick-Book Bottom Bar on public discovery pages */}
        {showMobileBookBar && (
          <div
            ref={mobileCtaBarRef}
            className="lg:hidden fixed bottom-0 start-0 end-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between gap-3 shadow-2xl"
          >
            <div className="min-w-0">
              <span className="text-xs text-slate-400 block">تأجير فوري في دمشق</span>
              <span className="text-sm font-bold text-amber-300 tabular-nums">من {STARTING_DAILY_PRICE}$ / اليوم</span>
            </div>
            <button
              type="button"
              onClick={browseFleet}
              className="min-h-11 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 shrink-0 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>احجز الآن</span>
            </button>
          </div>
        )}

        {/* Floating WhatsApp Action Button (Hidden on book page, raised above bottom bars) */}
        {!isBookPage && (
          <button
            type="button"
            onClick={() => openWhatsAppChat()}
            style={{
              bottom: 'calc(max(16px, env(safe-area-inset-bottom, 16px)) + var(--bottom-bar-h, 0px))',
              insetInlineStart: 'max(16px, env(safe-area-inset-right, 16px))',
            }}
            className={`fixed z-40 ${route.name === 'car' ? 'max-sm:hidden' : ''} min-w-11 min-h-11 p-3.5 sm:px-5 sm:py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2.5 shadow-2xl shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95 group cursor-pointer`}
            title="تواصل معنا فوراً على الواتساب"
            aria-label="تواصل واتساب مباشر"
          >
            <MessageCircle className="w-6 h-6 fill-current text-slate-950" />
            <span className="hidden sm:inline font-bold">تواصل واتساب مباشر</span>
          </button>
        )}

        {/* Footer: Full footer on Home, Mini footer on other public pages */}
        {isHome ? <Footer variant="full" /> : <Footer variant="mini" />}
      </BackContext.Provider>
    </div>
  );
};
