import React, { useState, useMemo, useEffect } from 'react';
import { Vehicle, Booking } from '../types';
import { calculateRentalDays, calculateRentalPrice, DEFAULT_SETTINGS } from '../services/pricing';
import { dataService } from '../services/dataService';
import { bookingFormSchema } from '../services/validation';
import { openWhatsAppChat } from '../services/whatsapp';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Car,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface BookingModalProps {
  vehicles?: Vehicle[];
  selectedVehicle?: Vehicle | null;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onBookingCreated?: (booking: Booking) => void;
  onBookingComplete?: (booking: Booking) => void;
  initialDates?: { pickupDate: string; returnDate: string };
  initialStartDate?: string;
  initialEndDate?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  vehicles = [],
  selectedVehicle,
  vehicle,
  onClose,
  onBookingCreated,
  onBookingComplete,
  initialDates,
  initialStartDate,
  initialEndDate,
}) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 4);

  const activeInitialVehicle = selectedVehicle || vehicle || vehicles?.[0] || null;

  // Form State
  const [vehicleId, setVehicleId] = useState<string>(
    activeInitialVehicle?.id || (vehicles?.[0]?.id || '')
  );
  const [pickupDate, setPickupDate] = useState<string>(
    initialStartDate || initialDates?.pickupDate || tomorrow.toISOString().split('T')[0]
  );
  const [pickupTime, setPickupTime] = useState<string>('10:00');
  const [returnDate, setReturnDate] = useState<string>(
    initialEndDate || initialDates?.returnDate || nextWeek.toISOString().split('T')[0]
  );
  const [returnTime, setReturnTime] = useState<string>('10:00');

  // Customer Information
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerWhatsApp, setCustomerWhatsApp] = useState(user?.phone || '');
  const [customerNationalId, setCustomerNationalId] = useState('');
  const [customerNationality, setCustomerNationality] = useState('سوري');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerLicenseNumber, setCustomerLicenseNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) {
      if (!customerName && user.displayName) setCustomerName(user.displayName);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
      if (!customerWhatsApp && user.phone) setCustomerWhatsApp(user.phone);
    }
  }, [user]);

  // UI Flow State
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Vehicle & Dates, 2: Customer info & Review, 3: Success Voucher
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);

  // Target Vehicle
  const currentVehicle = useMemo(() => {
    return vehicles?.find((v) => v.id === vehicleId) || activeInitialVehicle || vehicles?.[0] || null;
  }, [vehicles, vehicleId, activeInitialVehicle]);

  // Live Pricing Calculation
  const rentalDays = useMemo(() => {
    return calculateRentalDays(pickupDate, returnDate);
  }, [pickupDate, returnDate]);

  const pricing = useMemo(() => {
    if (!currentVehicle) return null;
    return calculateRentalPrice(
      currentVehicle.category,
      currentVehicle.dailyPrice,
      rentalDays,
      DEFAULT_SETTINGS
    );
  }, [currentVehicle, rentalDays]);

  const validateDates = async () => {
    setErrorMessage(null);
    if (!pickupDate || !returnDate) {
      setErrorMessage('يرجى تحديد تاريخي الاستلام والتسليم');
      return false;
    }
    if (new Date(returnDate) < new Date(pickupDate)) {
      setErrorMessage('تاريخ التسليم يجب أن يكون بعد تاريخ الاستلام');
      return false;
    }

    // Double-booking check
    const availability = await dataService.checkAvailability(vehicleId, pickupDate, returnDate);
    if (!availability.available) {
      setErrorMessage(
        availability.conflictReason ||
        'عذراً، السيارة غير متاحة في الفترة المحددة. يرجى اختيار سيارة أو تاريخ آخر.'
      );
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const isValid = await validateDates();
      if (isValid) setStep(2);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Zod validation
    const validationResult = bookingFormSchema.safeParse({
      vehicleId,
      customerName,
      customerPhone,
      customerWhatsApp: customerWhatsApp || customerPhone,
      customerNationalId,
      customerAddress,
      customerLicenseNumber,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      notes,
    });

    if (!validationResult.success) {
      const firstError = (validationResult.error as any).issues?.[0]?.message || 'يرجى مراجعة البيانات المدخلة';
      setErrorMessage(firstError);
      return;
    }

    if (!pricing || !currentVehicle) return;

    setIsSubmitting(true);
    try {
      const newBooking = await dataService.createBooking({
        vehicleId,
        customerName,
        customerPhone,
        customerWhatsApp: customerWhatsApp || customerPhone,
        customerNationalId,
        customerAddress,
        customerLicenseNumber,
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        rentalDays: pricing.rentalDays,
        dailyPrice: pricing.dailyPrice,
        basePrice: pricing.basePrice,
        discountAmount: pricing.discountAmount,
        insuranceAmount: pricing.insuranceAmount,
        totalPrice: pricing.totalPrice,
        notes,
      });

      setCreatedBooking(newBooking);
      if (onBookingCreated) onBookingCreated(newBooking);
      if (onBookingComplete) onBookingComplete(newBooking);
      setStep(3); // Success Screen
    } catch (err: any) {
      setErrorMessage(
        err.message || 'عذراً، حدث خطأ أثناء إتمام الحجز. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-6 animate-in zoom-in-95 duration-200 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {step === 3 ? 'تم تأكيد طلب الحجز' : 'حجز سيارة عبر الإنترنت'}
              </h3>
              <span className="text-xs text-slate-400">شاكر لتأجير السيارات • دمشق – جرمانا</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicators (Step 1 & 2) */}
        {step !== 3 && (
          <div className="flex border-b border-slate-800/80 bg-slate-950/40 text-xs">
            <button
              onClick={() => setStep(1)}
              className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${
                step === 1 ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'
              }`}
            >
              1. اختيار السيارة والتواريخ
            </button>
            <button
              onClick={handleNextStep}
              className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${
                step === 2 ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'
              }`}
            >
              2. بيانات المستأجر وتأكيد السعر
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Vehicle & Dates Selection */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            {/* Vehicle Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                اختر السيارة من الأسطول
              </label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} ({v.year}) - {v.dailyPrice}$/يوم [{v.category === 'light' ? 'اقتصادي' : v.category === 'medium' ? 'متوسط' : 'جيب 7 ركاب'}]
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Vehicle Card Preview */}
            {currentVehicle && (
              <div className="flex gap-4 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                <img
                  src={currentVehicle.imageUrl}
                  alt={currentVehicle.model}
                  className="w-24 h-20 object-cover rounded-xl shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-white truncate">
                      {currentVehicle.brand} {currentVehicle.model}
                    </h4>
                    <span className="text-sm font-black text-amber-400">${currentVehicle.dailyPrice}/يوم</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    موديل {currentVehicle.year} • {currentVehicle.seats} مقاعد • {currentVehicle.color}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    متاحة للحجز في دمشق
                  </span>
                </div>
              </div>
            )}

            {/* Dates & Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pickup */}
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  موعد الاستلام
                </span>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">تاريخ الاستلام</label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">وقت الاستلام</label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Return */}
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  موعد الإعادة والتسليم
                </span>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">تاريخ الإعادة</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    min={pickupDate}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">وقت الإعادة</label>
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Quick Live Pricing Preview Bar */}
            {pricing && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-400 font-bold block">
                    المدة المحسوبة: {pricing.rentalDays} {pricing.rentalDays === 1 ? 'يوم' : pricing.rentalDays === 2 ? 'يومان' : 'أيام'}
                  </span>
                  <span className="text-[11px] text-slate-400">{pricing.explanation}</span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-400 block">الإجمالي المبدئي</span>
                  <span className="text-xl font-black text-white">${pricing.totalPrice}</span>
                </div>
              </div>
            )}

            {/* Next Step Button */}
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
            >
              <span>متابعة إدخال بيانات المستأجر</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Customer Information & Final Confirmation */}
        {step === 2 && (
          <form onSubmit={handleBookingSubmit} className="p-6 space-y-6">
            {/* Pricing Summary Card */}
            {pricing && currentVehicle && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300 font-bold border-b border-slate-800 pb-2">
                  <span>السيارة: {currentVehicle.brand} {currentVehicle.model}</span>
                  <span className="text-amber-400">{pricing.rentalDays} أيام</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>الأجرة الأساسية ({currentVehicle.dailyPrice}$ × {pricing.rentalDays}):</span>
                  <span>${pricing.basePrice}</span>
                </div>
                {pricing.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>الخصم الممنوح:</span>
                    <span>-${pricing.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>
                    التأمين المسترد ({pricing.rentalDays <= 2 ? 'حجز 1-2 يوم' : 'أكثر من يومين'}):
                  </span>
                  <span className="text-amber-300 font-semibold">${pricing.insuranceAmount}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-black text-white">
                  <span>المبلغ الإجمالي النهائي:</span>
                  <span className="text-xl text-amber-400">${pricing.totalPrice}</span>
                </div>
              </div>
            )}

            {/* Customer Inputs */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-400" />
                بيانات المستأجر (مطلوبة لعقد الإيجار)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الاسم الكامل الثلاثي *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="أحمد محمد العلي"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">رقم الهاتف الجوال *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0944123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">رقم الواتساب للتأكيد الفوري *</label>
                  <input
                    type="tel"
                    value={customerWhatsApp}
                    onChange={(e) => setCustomerWhatsApp(e.target.value)}
                    placeholder="0944123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                {/* National ID / Passport */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الرقم الوطني / جواز السفر</label>
                  <input
                    type="text"
                    value={customerNationalId}
                    onChange={(e) => setCustomerNationalId(e.target.value)}
                    placeholder="010200..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Driver License */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">رقم شهادة القيادة</label>
                  <input
                    type="text"
                    value={customerLicenseNumber}
                    onChange={(e) => setCustomerLicenseNumber(e.target.value)}
                    placeholder="DL-12345"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">عنوان الإقامة أو الفندق</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="دمشق، المزة / فندق الشام..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ملاحظات أو طلبات إضافية (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: طلب كرسي أطفال، تسليم بمطار دمشق، موعد وصول الطائرة..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                <span>رجوع</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الحجز الآن (${pricing?.totalPrice})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Booking Success Voucher */}
        {step === 3 && createdBooking && (
          <div className="p-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h4 className="text-xl font-black text-white">تم استلام طلب الحجز بنجاح!</h4>
              <p className="text-xs text-slate-400 mt-1">
                سيارتك جاهزة عندما تكون أنت جاهزاً • شركة شاكر لتأجير السيارات
              </p>
            </div>

            {/* Voucher Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 text-right space-y-3 max-w-lg mx-auto shadow-inner">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-400">رقم الحجز المرجعي:</span>
                <span className="text-base font-black text-amber-400 font-mono" dir="ltr">
                  {createdBooking.bookingNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">المستأجر:</span>
                  <span className="text-white font-bold">{createdBooking.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">السيارة:</span>
                  <span className="text-white font-bold">{createdBooking.vehicleName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">تاريخ الاستلام:</span>
                  <span className="text-slate-200">{createdBooking.pickupDate} ({createdBooking.pickupTime})</span>
                </div>
                <div>
                  <span className="text-slate-400 block">تاريخ الإعادة:</span>
                  <span className="text-slate-200">{createdBooking.returnDate} ({createdBooking.returnTime})</span>
                </div>
                <div>
                  <span className="text-slate-400 block">مدة التأجير:</span>
                  <span className="text-slate-200 font-bold">{createdBooking.rentalDays} أيام</span>
                </div>
                <div>
                  <span className="text-slate-400 block">المبلغ الإجمالي:</span>
                  <span className="text-amber-400 font-black text-sm">${createdBooking.totalPrice}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>حالة الطلب: قيد المراجعة الفورية من قبل الموظف المختص.</span>
              </div>
            </div>

            {/* WhatsApp Direct Action (Section 12 requirement) */}
            <div className="space-y-2 max-w-lg mx-auto">
              <button
                type="button"
                onClick={() => openWhatsAppChat(createdBooking)}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                id="booking-send-whatsapp-btn"
              >
                <MessageCircle className="w-5 h-5" />
                <span>إرسال تفاصيل الحجز فوراً عبر واتساب (00963944331774)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة قسيمة الحجز</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
