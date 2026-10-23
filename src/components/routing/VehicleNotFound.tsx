import React from 'react';
import { useAppData } from '../../contexts/DataContext';
import { navigate, routes } from '../../router';
import { PageTransition } from './PageTransition';

/** Shown on /cars/:id pages while the vehicle is loading, or when no such vehicle exists. */
export const VehicleNotFound: React.FC = () => {
  const { vehiclesReady } = useAppData();

  return (
    <PageTransition className="min-h-[50vh] flex items-center justify-center text-center p-6">
      {vehiclesReady ? (
        <div className="space-y-4">
          <p className="text-slate-300 font-bold">لم يتم العثور على هذه السيارة.</p>
          <button
            type="button"
            onClick={() => navigate(routes.cars)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black active:scale-[0.97] transition-transform"
          >
            العودة إلى الأسطول
          </button>
        </div>
      ) : (
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      )}
    </PageTransition>
  );
};
