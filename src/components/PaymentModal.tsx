import React, { useState } from 'react';
import { Booking, Payment } from '../types';
import { dataService } from '../services/dataService';
import { CreditCard, DollarSign, X, CheckCircle2, Calendar, AlertTriangle } from 'lucide-react';

interface PaymentModalProps {
  booking: Booking;
  onClose: () => void;
  onPaymentRecorded: (payment: Payment) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  booking,
  onClose,
  onPaymentRecorded,
}) => {
  const remaining = booking.remainingAmount ?? (booking.totalPrice - (booking.paidAmount || 0));
  const [amount, setAmount] = useState<number>(remaining > 0 ? remaining : booking.totalPrice);
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('دفعة تأجير نقداً في مكتب جرمانا');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (amount <= 0) {
      setErrorMessage('مبلغ الدفعة يجب أن يكون أكبر من صفر.');
      return;
    }

    if (amount > remaining && remaining > 0) {
      setErrorMessage(`مبلغ الدفعة ($${amount}) يتجاوز المبلغ المتبقي على الحجز ($${remaining}).`);
      return;
    }

    setIsSaving(true);
    try {
      const payment = await dataService.recordPayment({
        bookingId: booking.id,
        customerId: booking.customerId || booking.customerPhone,
        amount,
        method,
        paymentDate,
        notes,
      });
      onPaymentRecorded(payment);
      onClose();
    } catch (err: any) {
      console.error('Payment registration error:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء حفظ الدفعة في قاعدة البيانات السحابية.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto pt-4 sm:pt-6 pb-6 sm:pb-6">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto overflow-y-auto max-h-[90vh] max-h-[90dvh] overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">تسجيل سند قبض ودفع</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1 mb-4">
          <div className="flex justify-between text-slate-400">
            <span>الحجز:</span>
            <span className="text-white font-mono font-bold">{booking.bookingNumber}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>العميل:</span>
            <span className="text-white font-bold">{booking.customerName}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>المبلغ الإجمالي:</span>
            <span className="text-amber-400 font-bold">${booking.totalPrice}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>المبلغ المسدد مسبقاً:</span>
            <span className="text-emerald-400 font-bold">${booking.paidAmount || 0}</span>
          </div>
          <div className="flex justify-between text-slate-300 font-bold pt-1 border-t border-slate-800">
            <span>المبلغ المتبقي:</span>
            <span className={remaining > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>
              ${remaining}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">قيمة الدفعة المستلمة ($)</label>
            <input
              type="number"
              value={amount ?? 0}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              min={1}
              max={10000}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">طريقة الدفع</label>
            <select
              value={method || 'cash'}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="cash">نقداً (كاش بالدولار)</option>
              <option value="bank_transfer">حوالة مصرفية / مكتب صرافة</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">تاريخ الاستلام</label>
            <input
              type="date"
              value={paymentDate || ''}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">ملاحظات السند المالي</label>
            <input
              type="text"
              value={notes || ''}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ في Firestore...' : `تسجيل دفعة $${amount}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
