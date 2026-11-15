import React from 'react';
import { AlertCircle, Car, Home, MessageCircle, Phone } from 'lucide-react';
import { PageTransition } from '../components/routing/PageTransition';
import { navigate, routes } from '../router';
import { openWhatsAppChat } from '../services/whatsapp';

/** Any URL that matches no route. */
export const NotFoundPage: React.FC = () => (
  <PageTransition className="min-h-[55dvh] flex items-center justify-center text-center px-4 py-12">
    <div className="max-w-md w-full bg-slate-900/70 border border-slate-800 rounded-card p-6 sm:p-8 space-y-5 shadow-xl">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
        <AlertCircle className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <p className="text-5xl font-extrabold text-amber-400 tabular-nums">404</p>
        <h2 className="text-lg font-extrabold text-white">الصفحة غير موجودة</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          الرابط الذي حاولت فتحه غير متاح أو ربما تم نقله. يمكنك العودة أو تصفح الأسطول مباشرة.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => navigate(routes.cars)}
          className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold active:scale-[0.97] transition-transform cursor-pointer"
        >
          <Car className="w-4 h-4" />
          <span>تصفح الأسطول</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(routes.home, { replace: true })}
          className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold active:scale-[0.97] transition-transform cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => navigate(routes.contact)}
          className="min-h-11 px-3 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-amber-300 font-bold cursor-pointer"
        >
          <Phone className="w-4 h-4" />
          <span>تواصل معنا</span>
        </button>
        <button
          type="button"
          onClick={() => openWhatsAppChat()}
          className="min-h-11 px-3 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span>واتساب مباشر</span>
        </button>
      </div>
    </div>
  </PageTransition>
);

