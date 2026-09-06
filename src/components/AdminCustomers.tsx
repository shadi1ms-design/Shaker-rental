import React, { useState } from 'react';
import { Customer, Booking } from '../types';
import { openWhatsAppChat } from '../services/whatsapp';
import {
  Users,
  Search,
  MessageCircle,
  Phone,
  DollarSign,
  Calendar,
  FileText,
  UserCheck,
  Edit2,
  CheckCircle2
} from 'lucide-react';

interface AdminCustomersProps {
  customers?: Customer[];
  bookings?: Booking[];
  onSelectCustomerBookings?: (phone: string) => void;
}

export const AdminCustomers: React.FC<AdminCustomersProps> = ({
  customers = [],
  bookings = [],
}) => {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const safeCustomers = customers || [];
  const safeBookings = bookings || [];

  const filtered = safeCustomers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.nationalId && c.nationalId.includes(q))
    );
  });

  const getCustomerBookings = (phone: string) => {
    return safeBookings.filter((b) => b.customerPhone === phone);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            سجل العملاء وإدارة العلاقات (Customer CRM)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            إجمالي العملاء المسجلين: {customers.length} عميل في قاعدة البيانات
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-white focus:outline-none focus:border-amber-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        </div>
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((customer) => {
          const custBookings = getCustomerBookings(customer.phone);
          const totalSpent = custBookings.reduce((acc, b) => acc + (b.paidAmount || 0), 0) || customer.totalSpending;

          return (
            <div
              key={customer.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 transition-all shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">{customer.fullName}</h4>
                  <span className="text-xs text-slate-400 font-mono" dir="ltr">{customer.phone}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {custBookings.length} حجوزات
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">إجمالي الإنفاق:</span>
                  <span className="text-emerald-400 font-bold font-mono">${totalSpent}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الهوية الوطنية:</span>
                  <span className="text-slate-300 font-mono truncate block">{customer.nationalId || 'غير مسجل'}</span>
                </div>
              </div>

              {/* Notes */}
              {customer.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 line-clamp-2">
                  {customer.notes}
                </p>
              )}

              {/* Direct Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <button
                  onClick={() => openWhatsAppChat(undefined, `مرحباً أستاذ ${customer.fullName}، نتواصل معك من شركة شاكر لتأجير السيارات.`)}
                  className="flex-1 py-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>مراسلة واتساب</span>
                </button>

                <button
                  onClick={() => setSelectedCustomer(customer)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  السجل
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h4 className="font-bold text-base text-white">سجل العميل: {selectedCustomer.fullName}</h4>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">رقم الهاتف:</span>
                <span className="font-mono text-white" dir="ltr">{selectedCustomer.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">الرقم الوطني / جواز السفر:</span>
                <span className="font-mono text-white">{selectedCustomer.nationalId || 'مُطابق'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">رقم رخصة القيادة:</span>
                <span className="font-mono text-white">{selectedCustomer.drivingLicense || 'سارية'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">العنوان:</span>
                <span className="text-white">{selectedCustomer.address || 'دمشق'}</span>
              </div>
            </div>

            <h5 className="font-bold text-xs text-amber-400 pt-2">سجل الحجوزات السابقة للعميل:</h5>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {getCustomerBookings(selectedCustomer.phone).map((b) => (
                <div key={b.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block">{b.vehicleName}</span>
                    <span className="text-[10px] text-slate-400">{b.pickupDate} إلى {b.returnDate}</span>
                  </div>
                  <div className="text-left">
                    <span className="font-black text-amber-400 block">${b.totalPrice}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">{b.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedCustomer(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
