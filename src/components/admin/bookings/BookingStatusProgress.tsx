import React from 'react';
import { BookingStatus } from '../../../types';
import { CheckCircle2, Clock, Key, Flag, XCircle, FileCheck2 } from 'lucide-react';

interface BookingStatusProgressProps {
  status: BookingStatus;
}

const LIFECYCLE_STEPS: {
  key: BookingStatus;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { key: 'new', label: 'طلب جديد', icon: Clock },
  { key: 'reviewing', label: 'قيد المراجعة', icon: FileCheck2 },
  { key: 'confirmed', label: 'مؤكد', icon: CheckCircle2 },
  { key: 'rented', label: 'جاري التأجير', icon: Key },
  { key: 'completed', label: 'مكتمل', icon: Flag },
];

const STEP_INDEX: Record<string, number> = {
  new: 0,
  reviewing: 1,
  confirmed: 2,
  rented: 3,
  completed: 4,
};

export const BookingStatusProgress: React.FC<BookingStatusProgressProps> = ({ status }) => {
  const isTerminated = status === 'cancelled' || status === 'rejected';
  const currentIdx = STEP_INDEX[status] ?? 0;

  if (isTerminated) {
    return (
      <div
        role="status"
        aria-label="حالة مسار الحجز"
        className="flex items-center gap-3 p-3.5 rounded-card bg-status-danger-bg border border-status-danger-border text-status-danger"
      >
        <XCircle className="w-5 h-5 text-status-danger-dot shrink-0" />
        <div className="text-xs sm:text-sm font-bold">
          {status === 'cancelled' ? 'تم إلغاء هذا الحجز' : 'تم رفض طلب الحجز'}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="مسار تقدم حالة الحجز"
      className="bg-brand-obsidian border border-brand-border rounded-card p-card shadow-card"
    >
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {LIFECYCLE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIdx || status === 'completed';
          const isCurrent = index === currentIdx && status !== 'completed';

          return (
            <div key={step.key} className="flex flex-col items-center text-center gap-1.5">
              <div className="w-full flex items-center">
                <div
                  className={`h-1 flex-1 rounded-full ${
                    index === 0
                      ? 'bg-transparent'
                      : index <= currentIdx
                      ? 'bg-brand-gold'
                      : 'bg-brand-elevated'
                  }`}
                />
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                    isCurrent
                      ? 'bg-brand-gold text-brand-obsidian border-brand-gold-light shadow-gold'
                      : isCompleted
                      ? 'bg-status-confirmed-bg text-status-confirmed border-status-confirmed-border'
                      : 'bg-brand-surface text-brand-muted border-brand-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div
                  className={`h-1 flex-1 rounded-full ${
                    index === LIFECYCLE_STEPS.length - 1
                      ? 'bg-transparent'
                      : index < currentIdx
                      ? 'bg-brand-gold'
                      : 'bg-brand-elevated'
                  }`}
                />
              </div>
              <span
                className={`text-xs sm:text-sm font-bold leading-tight ${
                  isCurrent
                    ? 'text-brand-gold-light'
                    : isCompleted
                    ? 'text-status-confirmed'
                    : 'text-brand-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
