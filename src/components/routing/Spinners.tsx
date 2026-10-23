import React from 'react';

/** Small centered spinner, used as the React.Suspense fallback of lazy pages. */
export const SuspenseFallback: React.FC = () => (
  <div className="min-h-[40vh] flex items-center justify-center p-6">
    <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Larger spinner shown while a route is waiting for auth / a redirect. */
export const PageSpinner: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);
