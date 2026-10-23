import React from 'react';
import { PageTransition } from '../components/routing/PageTransition';
import { navigate, routes } from '../router';

/** Any URL that matches no route. */
export const NotFoundPage: React.FC = () => (
  <PageTransition className="min-h-[50vh] flex items-center justify-center text-center p-6">
    <div className="space-y-4">
      <p className="text-6xl font-black text-amber-400 font-mono">404</p>
      <p className="text-slate-300 font-bold">الصفحة التي تبحث عنها غير موجودة.</p>
      <button
        type="button"
        onClick={() => navigate(routes.home, { replace: true })}
        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black active:scale-[0.97] transition-transform"
      >
        العودة إلى الرئيسية
      </button>
    </div>
  </PageTransition>
);
