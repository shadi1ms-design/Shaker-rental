import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const duration = toast.duration ?? 5000;
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const styleMap = {
    success: {
      bg: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    },
    error: {
      bg: 'bg-rose-950/95 border-rose-500/40 text-rose-300',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-950/95 border-amber-500/40 text-amber-300',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    },
    info: {
      bg: 'bg-blue-950/95 border-blue-500/40 text-blue-300',
      icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
    },
  };

  const current = styleMap[toast.type];

  return (
    <div className="fixed bottom-6 start-6 z-50 max-w-sm inset-x-4 sm:inset-x-auto sm:w-full animate-in slide-in-from-bottom-4 duration-200">
      <div
        className={`p-4 rounded-card border shadow-2xl backdrop-blur-md flex items-start gap-3 ${current.bg}`}
      >
        {current.icon}
        <div className="space-y-0.5 min-w-0 flex-1 text-sm">
          {toast.title && <h5 className="font-bold text-white text-sm">{toast.title}</h5>}
          <p className="leading-relaxed">{toast.message}</p>
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onClose();
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-colors cursor-pointer min-h-11 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors cursor-pointer min-h-11 min-w-11 inline-flex items-center justify-center"
          aria-label="إغلاق التنبيه"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
