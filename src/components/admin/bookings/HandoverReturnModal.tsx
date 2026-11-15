import React, { useState } from 'react';
import { Booking, Vehicle } from '../../../types';
import { functionsService } from '../../../services/functionsService';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { Key, CheckCircle2, Gauge, X, AlertCircle } from 'lucide-react';

export interface HandoverReturnModalProps {
  mode: 'handover' | 'return';
  booking: Booking;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onSuccess: (updated: {
    bookingId: string;
    nextStatus: 'rented' | 'completed';
    mileageAtPickup?: number;
    mileageAtReturn?: number;
    returnCondition?: string;
    extraCharges?: number;
  }) => void;
}

export const HandoverReturnModal: React.FC<HandoverReturnModalProps> = ({
  mode,
  booking,
  vehicle,
  onClose,
  onSuccess,
}) => {
  const modalRef = useFocusTrap({ isOpen: true, onClose, lockScroll: true });

  const minAllowedMileage = Math.max(
    Number(vehicle?.currentMileage || 0),
    Number(booking.mileageAtPickup || 0)
  );

  const [odometerInput, setOdometerInput] = useState<string>(() =>
    String(minAllowedMileage > 0 ? minAllowedMileage : 0)
  );
  const [returnCondition, setReturnCondition] = useState<string>(booking.returnCondition || '');
  const [extraChargesInput, setExtraChargesInput] = useState<string>(
    booking.extraCharges ? String(booking.extraCharges) : '0'
  );
  const [reasonNote, setReasonNote] = useState<string>('');
  const [confirmOilOverdue, setConfirmOilOverdue] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isHandover = mode === 'handover';
  const nextStatus = isHandover ? 'rented' : 'completed';

  const lastOilMileage = Number(vehicle?.lastOilChangeMileage || 0);
  const oilInterval = Number(vehicle?.oilChangeIntervalKm || 5000);
  const enteredMileage = Number(odometerInput || minAllowedMileage);
  const effectiveMileage = Math.max(minAllowedMileage, Number.isFinite(enteredMileage) ? enteredMileage : minAllowedMileage);
  const isOilOverdue = isHandover && lastOilMileage > 0 && oilInterval > 0 && (effectiveMileage - lastOilMileage >= oilInterval);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedMileage = Number(odometerInput);
    if (!Number.isFinite(parsedMileage) || parsedMileage < 0) {
      setErrorMsg('يرجى إدخال قراءة عداد كيلومترات صحيحة (رقم موجب).');
      return;
    }

    if (parsedMileage < minAllowedMileage) {
      setErrorMsg(
        `قراءة العداد المُدخلة (${parsedMileage.toLocaleString('en-US')} كم) لا يمكن أن تكون أقل من القراءة السابقة للمركبة (${minAllowedMileage.toLocaleString('en-US')} كم).`
      );
      return;
    }

    if (isOilOverdue && !confirmOilOverdue) {
      setErrorMsg('المركبة تجاوزت موعد تغيير الزيت الدوري. يرجى تأكيد إجراء الفحص أو التغيير والمتابعة بالتعليم على المربع المخصص.');
      return;
    }

    const parsedExtraCharges = Number(extraChargesInput || 0);
    if (!isHandover && (!Number.isFinite(parsedExtraCharges) || parsedExtraCharges < 0)) {
      setErrorMsg('يرجى إدخال قيمة صحيحة للرسوم الإضافية.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await functionsService.updateBookingStatusSecure({
        bookingId: booking.id,
        nextStatus,
        ...(isHandover
          ? {
              mileageAtPickup: parsedMileage,
              currentMileage: parsedMileage,
              confirmOilOverdue: isOilOverdue ? confirmOilOverdue : undefined,
            }
          : {
              mileageAtReturn: parsedMileage,
              currentMileage: parsedMileage,
              returnCondition: returnCondition.trim() || undefined,
              extraCharges: parsedExtraCharges > 0 ? parsedExtraCharges : undefined,
            }),
        reason:
          reasonNote.trim() ||
          (isHandover
            ? `تسليم المركبة للعميل عند قراءة عداد ${parsedMileage} كم`
            : `استلام المركبة من العميل وإتمام الحجز عند قراءة عداد ${parsedMileage} كم`),
      });

      if (!res.success) {
        setErrorMsg(res.error || 'تعذر تحديث حالة الحجز والعداد. يرجى المحاولة مرة أخرى.');
        return;
      }

      onSuccess({
        bookingId: booking.id,
        nextStatus,
        ...(isHandover
          ? { mileageAtPickup: parsedMileage }
          : {
              mileageAtReturn: parsedMileage,
              returnCondition: returnCondition.trim() || undefined,
              extraCharges: parsedExtraCharges > 0 ? parsedExtraCharges : undefined,
            }),
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الحفظ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-obsidian/80 backdrop-blur-md flex items-center justify-center p-4"
      dir="rtl"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-return-modal-title"
        className="bg-brand-surface border border-brand-border rounded-modal max-w-md w-full p-section space-y-5 shadow-card"
      >
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-card flex items-center justify-center border ${
                isHandover
                  ? 'bg-status-rented-bg text-status-rented border-status-rented-border'
                  : 'bg-status-confirmed-bg text-status-confirmed border-status-confirmed-border'
              }`}
            >
              {isHandover ? <Key className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="handover-return-modal-title" className="text-base font-extrabold text-brand-text">
                {isHandover ? 'تسليم السيارة للعميل' : 'استلام السيارة من العميل'}
              </h3>
              <p className="text-sm text-brand-muted">
                {booking.vehicleName} • #{booking.bookingNumber || booking.id.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text transition-colors cursor-pointer border border-brand-border"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-card bg-status-danger-bg border border-status-danger-border text-status-danger text-sm font-bold flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-status-danger-dot shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-brand-obsidian border border-brand-border rounded-card p-3.5 flex items-center justify-between text-sm">
            <span className="text-brand-muted font-bold flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-brand-gold-light" />
              العداد السابق المسجل:
            </span>
            <span className="font-mono font-extrabold text-brand-gold-light text-sm" dir="ltr">
              {minAllowedMileage.toLocaleString('en-US')} km
            </span>
          </div>

          <div>
            <label
              htmlFor="handover-odometer-input"
              className="block text-sm font-bold text-brand-text mb-1.5"
            >
              {isHandover
                ? 'قراءة عداد الكيلومترات عند التسليم (كم) *'
                : 'قراءة عداد الكيلومترات عند الاستلام (كم) *'}
            </label>
            <input
              id="handover-odometer-input"
              type="number"
              min={minAllowedMileage}
              step={1}
              required
              dir="ltr"
              value={odometerInput}
              onChange={(e) => setOdometerInput(e.target.value)}
              className="w-full min-h-11 bg-brand-obsidian border border-brand-border focus:border-brand-gold rounded-card px-3.5 py-2.5 text-base sm:text-sm text-brand-text font-mono focus:outline-none"
            />
            <p className="text-xs text-brand-muted mt-1">
              يجب ألا تقل القراءة عن {minAllowedMileage.toLocaleString('en-US')} كم. سيتم تحديث عداد المركبة والعقد تلقائياً.
            </p>
          </div>

          {isOilOverdue && (
            <div
              role="alert"
              className="p-3.5 rounded-card bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300 block">تنبيه: استحقاق تغيير الزيت الدوري للمركبة!</span>
                  <p className="text-xs text-amber-200/85 mt-0.5 leading-relaxed">
                    آخر تغيير مسجل كان عند {lastOilMileage.toLocaleString('en-US')} كم (الفارق بعد القراءة الحالية:{' '}
                    {(effectiveMileage - lastOilMileage).toLocaleString('en-US')} كم / الفاصل الدوري: {oilInterval.toLocaleString('en-US')} كم).
                  </p>
                </div>
              </div>
              <label className="min-h-11 flex items-center gap-2 cursor-pointer pt-1 border-t border-amber-500/20 text-sm font-bold text-amber-200 select-none">
                <input
                  type="checkbox"
                  id="confirm-oil-overdue-checkbox"
                  checked={confirmOilOverdue}
                  onChange={(e) => setConfirmOilOverdue(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold bg-brand-obsidian border-brand-border cursor-pointer"
                />
                <span>أؤكد فحص/تغيير الزيت ومتابعة إجراءات تسليم السيارة</span>
              </label>
            </div>
          )}

          {!isHandover && (
            <>
              <div>
                <label
                  htmlFor="return-condition-input"
                  className="block text-sm font-bold text-brand-text mb-1.5"
                >
                  حالة المركبة عند الإرجاع (اختياري)
                </label>
                <input
                  id="return-condition-input"
                  type="text"
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  placeholder="مثال: سليمة ونظيفة، كامل الملحقات موجودة"
                  className="w-full min-h-11 bg-brand-obsidian border border-brand-border focus:border-brand-gold rounded-card px-3.5 py-2.5 text-base sm:text-sm text-brand-text placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="return-extra-charges-input"
                  className="block text-sm font-bold text-brand-text mb-1.5"
                >
                  رسوم إضافية عند الإرجاع (اختياري - $)
                </label>
                <input
                  id="return-extra-charges-input"
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  value={extraChargesInput}
                  onChange={(e) => setExtraChargesInput(e.target.value)}
                  className="w-full min-h-11 bg-brand-obsidian border border-brand-border focus:border-brand-gold rounded-card px-3.5 py-2.5 text-base sm:text-sm text-brand-text font-mono focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="handover-reason-note"
              className="block text-sm font-bold text-brand-text mb-1.5"
            >
              ملاحظة السجل الإداري (اختياري)
            </label>
            <textarea
              id="handover-reason-note"
              rows={2}
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder={
                isHandover
                  ? 'ملاحظات إضافية عند تسليم المركبة...'
                  : 'ملاحظات إضافية عند استلام المركبة...'
              }
              className="w-full bg-brand-obsidian border border-brand-border focus:border-brand-gold rounded-card px-3.5 py-2.5 text-base sm:text-sm text-brand-text placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 min-h-11 py-2.5 rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text font-bold text-sm transition-colors cursor-pointer border border-brand-border"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 min-h-11 py-2.5 rounded-card font-extrabold text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                isHandover
                  ? 'bg-status-rented-solid hover:opacity-90 text-brand-obsidian'
                  : 'bg-status-confirmed-solid hover:opacity-90 text-brand-obsidian'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : isHandover ? (
                <>
                  <Key className="w-4 h-4" />
                  <span>تأكيد تسليم السيارة</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد استلام السيارة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
