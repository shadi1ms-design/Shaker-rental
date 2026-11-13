import React from 'react';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';

export interface BookingsBatchBarProps {
  selectedCount: number;
  isBatchProcessing: boolean;
  canDeleteBookings: boolean;
  onBatchConfirm: () => void;
  onBatchReject: () => void;
  onOpenBatchDelete: () => void;
  onClearSelection: () => void;
}

export const BookingsBatchBar: React.FC<BookingsBatchBarProps> = ({
  selectedCount,
  isBatchProcessing,
  canDeleteBookings,
  onBatchConfirm,
  onBatchReject,
  onOpenBatchDelete,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-gold-bg border border-brand-gold-border px-4 py-3 rounded-card shadow-card">
      <div className="flex items-center gap-2 text-xs font-bold text-status-new">
        <span>تم تحديد {selectedCount} حجز</span>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-brand-text hover:text-brand-gold-light underline ms-2 cursor-pointer"
        >
          إلغاء التحديد
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isBatchProcessing}
          onClick={onBatchConfirm}
          className="px-3 py-1.5 rounded-card bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>تأكيد المحدد</span>
        </button>
        <button
          type="button"
          disabled={isBatchProcessing}
          onClick={onBatchReject}
          className="px-3 py-1.5 rounded-card bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text border border-status-danger-border text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>رفض المحدد</span>
        </button>
        {canDeleteBookings && (
          <button
            type="button"
            disabled={isBatchProcessing}
            onClick={onOpenBatchDelete}
            className="px-3 py-1.5 rounded-card bg-status-danger-solid hover:opacity-90 text-brand-text text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-card"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف نهائي للمحدد ({selectedCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
