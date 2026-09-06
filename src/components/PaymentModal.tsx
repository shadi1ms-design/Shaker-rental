import React, { useState } from 'react';
import { Booking, Payment } from '../types';
import { dataService } from '../services/dataService';
import { CreditCard, DollarSign, X, CheckCircle2, Calendar } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setIsSaving(true);
    try {
      const payment = await dataService.recordPayment({
        bookingId: booking.id,
        amount,
        method,
        paymentDate,
        notes,
      });
      onPaymentRecorded(payment);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">تسجيل دفعة مالية</h3>
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
            <span className="text-rose-400 font-black">${remaining}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">قيمة الدفعة المستلمة ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
              max={10000}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">طريقة الدفع</label>
            <select
              value={method}
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
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">ملاحظات السند المالي</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'جاري التسجيل...' : `تسجيل دفعة $${amount}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
