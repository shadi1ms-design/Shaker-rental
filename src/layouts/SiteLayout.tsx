import React from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { GlobalMenu } from '../components/GlobalMenu';
import { PageTopBar } from '../components/common/PageTopBar';
import { BackContext } from '../contexts/BackContext';
import { useAppData } from '../contexts/DataContext';
import { useBookFirstVehicle } from '../hooks/useBookFirstVehicle';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { goBack, getMenuSection, navigate, navigateToView, routes, type ResolvedRoute } from '../router';
import { getPageMeta } from '../routes/pageMeta';
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

/** Shared chrome of the public site: menu, header, booking banner, WhatsApp button and footer. */
export const SiteLayout: React.FC<SiteLayoutProps> = ({ route, children }) => {
  const { vehicles, lastCreatedBooking, dismissLastBooking } = useAppData();
  const bookFirstVehicle = useBookFirstVehicle();

  const routeVehicleId = route.params.id;
  const routeVehicle = routeVehicleId ? vehicles.find((v) => v.id === routeVehicleId) || null : null;
  const meta = getPageMeta(route.name, routeVehicle);
  useDocumentTitle(meta.docTitle);

  const isHome = route.name === 'home';
  const openAuth = (mode?: 'login' | 'register') => navigate(mode === 'register' ? routes.register : routes.login);
  const openProfile = () => navigate(routes.profile);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-cairo overflow-x-hidden">
      <BackContext.Provider value={isHome ? null : () => goBackFrom(route)}>
      {/* Global Slide-out Navigation Drawer (Controlled via MenuContext) */}
      <GlobalMenu
        currentView={getMenuSection(route.name)}
        onNavigate={navigateToView}
        onOpenBooking={bookFirstVehicle}
        onOpenAuth={openAuth}
        onOpenProfile={openProfile}
      />

      {/* Full Navbar ONLY on Home; minimal PageTopBar on every other page */}
      {isHome ? (
        <Navbar
          currentView="home"
          onNavigate={navigateToView}
          onOpenBooking={bookFirstVehicle}
          onOpenAuth={openAuth}
          onOpenProfile={openProfile}
        />
      ) : (
        <PageTopBar title={meta.topBarTitle} badge={meta.badge} showMenu={route.name === 'notFound'} onBack={route.name === 'notFound' ? () => goBackFrom(route) : undefined} />
      )}

      {/* Booking Status Alert Toast */}
      {lastCreatedBooking && (
        <div className="bg-amber-600/90 text-white px-4 py-3 text-xs sm:text-sm text-center flex items-center justify-center gap-2 sticky top-0 z-30 shadow-lg backdrop-blur-md">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>
            تم استلام طلب حجزك رقم <strong className="font-mono">{lastCreatedBooking.bookingNumber}</strong> وهو الآن بانتظار موافقة الإدارة.
          </span>
          <button onClick={dismissLastBooking} className="mr-3 text-xs underline font-bold cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Bottom padding avoids overlap with the floating WhatsApp button */}
      <main className="flex-1 pb-28 sm:pb-32">{children}</main>

      {/* Floating WhatsApp Action Button positioned at physical RIGHT at screen bottom */}
      <button
        type="button"
        onClick={() => openWhatsAppChat()}
        style={{
          bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          right: 'max(16px, env(safe-area-inset-right, 16px))',
        }}
        className="fixed z-40 p-3.5 sm:px-5 sm:py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center gap-2.5 shadow-2xl shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
        title="تواصل معنا فوراً على الواتساب"
        aria-label="تواصل واتساب مباشر"
      >
        <MessageCircle className="w-6 h-6 fill-current text-slate-950" />
        <span className="hidden sm:inline font-bold">تواصل واتساب مباشر</span>
      </button>

      {/* Footer (company info / "من نحن"): home page only. Reached from the ☰ menu via goToAboutUs() */}
      {isHome && <Footer onNavigate={navigateToView} />}
      </BackContext.Provider>
    </div>
  );
};
