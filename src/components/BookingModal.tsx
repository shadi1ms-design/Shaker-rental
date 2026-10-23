import React, { useState, useMemo, useEffect } from 'react';
import { Vehicle, Booking, AppSettings } from '../types';
import { calculateRentalDays, calculateRentalPrice, DEFAULT_SETTINGS } from '../services/pricing';
import { dataService } from '../services/dataService';
import { functionsService } from '../services/functionsService';
import { bookingFormSchema } from '../services/validation';
import { openWhatsAppChat } from '../services/whatsapp';
import { useAuth } from '../contexts/AuthContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { addDaysISO, todayLocalISO } from '../utils/dateUtils';
import { normalizeDigits } from '../utils/phone';
import { isValidPhone } from '../utils/security';
import {
  X,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Lock,
  AlertCircle
} from 'lucide-react';

interface BookingModalProps {
  vehicles?: Vehicle[];
  selectedVehicle?: Vehicle | null;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
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
  onOpenAuth,
  onOpenProfile,
  onBookingCreated,
  onBookingComplete,
  initialDates,
  initialStartDate,
  initialEndDate,
}) => {
  const modalContainerRef = useFocusTrap({ isOpen: true, onClose, trapTab: false });
  const todayDamascus = todayLocalISO();
  // Defaults are computed from the Damascus calendar day (a UTC date is wrong between 00:00 and 03:00)
  const defaultPickupDate = addDaysISO(todayDamascus, 1);
  const defaultReturnDate = addDaysISO(todayDamascus, 4);

  const activeInitialVehicle = selectedVehicle || vehicle || vehicles?.[0] || null;

  // Form State
  const [vehicleId, setVehicleId] = useState<string>(
    activeInitialVehicle?.id || (vehicles?.[0]?.id || '')
  );
  const [pickupDate, setPickupDate] = useState<string>(
    initialStartDate || initialDates?.pickupDate || defaultPickupDate
  );
  const [pickupTime, setPickupTime] = useState<string>('10:00');
  const [returnDate, setReturnDate] = useState<string>(
    initialEndDate || initialDates?.returnDate || defaultReturnDate
  );
  const [returnTime, setReturnTime] = useState<string>('10:00');

  // Customer Information
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerWhatsApp, setCustomerWhatsApp] = useState(user?.phone || '');
  const [customerNationalId, setCustomerNationalId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerLicenseNumber, setCustomerLicenseNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isUserVerified, setIsUserVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setIsUserVerified(false);
      return;
    }
    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'employee') {
      setIsUserVerified(true);
      return;
    }
    dataService.getVerificationRequest(user.uid).then((req) => {
      setIsUserVerified(req?.status === 'verified');
    }).catch(() => {
      setIsUserVerified(user.verificationStatus === 'verified');
    });
  }, [user?.uid, user?.role, user?.verificationStatus]);

  useEffect(() => {
    if (user) {
      if (!customerName.trim() && user.displayName) setCustomerName(user.displayName);
      if (!customerPhone.trim() && user.phone) setCustomerPhone(user.phone);
      if (!customerWhatsApp.trim() && user.phone) setCustomerWhatsApp(user.phone);
    }
  }, [user?.phone, user?.displayName, user]);

  // Settings for dynamic discounts and rates
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    dataService.getSettings().then((s) => setAppSettings(s)).catch(() => {});
  }, []);

  // UI Flow State
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Vehicle & Dates, 2: Customer info & Review, 3: Success Voucher
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [technicalNotice, setTechnicalNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);

  const currentVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === vehicleId) || selectedVehicle || vehicle || vehicles?.[0] || null;
  }, [vehicles, vehicleId, selectedVehicle, vehicle]);

  const rentalDays = useMemo(() => {
    return calculateRentalDays(pickupDate, returnDate, pickupTime, returnTime);
  }, [pickupDate, returnDate, pickupTime, returnTime]);

  const pricing = useMemo(() => {
    if (!currentVehicle) return null;
    return calculateRentalPrice(
      currentVehicle.category,
      currentVehicle.dailyPrice,
      rentalDays,
      appSettings,
      { isUserLoggedIn: Boolean(user), vehicleId: currentVehicle.id }
    );
  }, [currentVehicle, rentalDays, appSettings, user]);

  // Real-time Vehicle Availability Check
  React.useEffect(() => {
    let isMounted = true;
    if (!vehicleId || !pickupDate || !returnDate) {
      setAvailabilityError(null);
      setTechnicalNotice(null);
      return;
    }

    const checkAvailability = async () => {
      setIsCheckingAvailability(true);
      setAvailabilityError(null);
      setTechnicalNotice(null);
      try {
        const res = await functionsService.getVehicleAvailability({
          vehicleId,
          from: pickupDate,
          to: returnDate,
          fromTime: pickupTime,
          toTime: returnTime,
        });

        if (!isMounted) return;

        if (!res.success) {
          // Technical failure (e.g. App Check / network error) - do not mark vehicle as unavailable
          setAvailabilityError(null);
          setTechnicalNotice('تعذر التحقق من التوفر حالياً، حاول مرة أخرى');
        } else if (res.data?.available === false) {
          // Function succeeded, vehicle is genuinely unavailable/conflicting
          const reason =
            res.data?.conflictReason ||
            'عذراً، السيارة غير متاحة في التواريخ والأوقات المحددة.';
          setAvailabilityError(reason);
          setTechnicalNotice(null);
        } else {
          // Available
          setAvailabilityError(null);
          setTechnicalNotice(null);
        }
      } catch {
        if (isMounted) {
          setAvailabilityError(null);
          setTechnicalNotice('تعذر التحقق من التوفر حالياً، حاول مرة أخرى');
        }
      } finally {
        if (isMounted) setIsCheckingAvailability(false);
      }
    };

    const timer = setTimeout(checkAvailability, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [vehicleId, pickupDate, returnDate, pickupTime, returnTime]);

  const validateDates = async () => {
    setErrorMessage(null);
    if (!pickupDate || !returnDate) {
      setErrorMessage('يرجى تحديد تاريخي الاستلام والتسليم');
      return false;
    }
    if (pickupDate < todayDamascus) {
      setErrorMessage('تاريخ الاستلام لا يمكن أن يكون في الماضي');
      return false;
    }
    if (new Date(returnDate) < new Date(pickupDate)) {
      setErrorMessage('تاريخ التسليم يجب أن يكون بعد تاريخ الاستلام');
      return false;
    }
    if (rentalDays === 0) {
      setErrorMessage('وقت التسليم يجب أن يكون بعد وقت الاستلام');
      return false;
    }
    if (currentVehicle && (currentVehicle.status === 'maintenance' || currentVehicle.status === 'inactive')) {
      setErrorMessage('السيارة المحددة في الصيانة الدورية أو خارج الخدمة حالياً، يرجى اختيار سيارة أخرى');
      return false;
    }

    if (isCheckingAvailability) {
      setErrorMessage('جاري التحقق من توفر السيارة، يرجى المحاولة بعد لحظات');
      return false;
    }

    if (availabilityError) {
      setErrorMessage(availabilityError);
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

    // Normalize Arabic-Indic digits so phones / IDs are stored consistently
    const phone = normalizeDigits(customerPhone).trim();
    const whatsapp = normalizeDigits(customerWhatsApp || customerPhone).trim();
    const nationalId = normalizeDigits(customerNationalId).trim();
    const licenseNumber = normalizeDigits(customerLicenseNumber).trim();

    if (!isValidPhone(phone)) {
      setErrorMessage('يرجى إدخال رقم هاتف صحيح (7 إلى 16 رقمًا، ويمكن أن يبدأ بـ +)');
      return;
    }
    if (!isValidPhone(whatsapp)) {
      setErrorMessage('يرجى إدخال رقم واتساب صحيح (7 إلى 16 رقمًا، ويمكن أن يبدأ بـ +)');
      return;
    }

    // Zod validation
    const validationResult = bookingFormSchema.safeParse({
      vehicleId,
      customerName,
      customerPhone: phone,
      customerWhatsApp: whatsapp,
      customerNationalId: nationalId,
      customerAddress,
      customerLicenseNumber: licenseNumber,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      notes,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues?.[0]?.message || 'يرجى مراجعة البيانات المدخلة';
      setErrorMessage(firstError);
      return;
    }

    if (!pricing || !currentVehicle) return;

    if (!user) {
      setErrorMessage('وفق سياسة أمان النظام، يجب تسجيل الدخول أو إنشاء حساب لإتمام الحجز.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await functionsService.createBookingSecure({
        vehicleId,
        customerId: user?.uid,
        customerEmail: user?.email,
        customerName,
        customerPhone: phone,
        customerWhatsApp: whatsapp,
        customerNationalId: nationalId,
        customerAddress,
        customerLicenseNumber: licenseNumber,
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        notes,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'عذراً، حدث خطأ أثناء إتمام الحجز. يرجى المحاولة مرة أخرى.');
      }

      const data = result.data as { booking?: Booking; bookingId?: string; bookingNumber?: string };
      const newBooking: Booking = data.booking || ({
        id: data.bookingId || '',
        bookingNumber: data.bookingNumber || '',
        vehicleId,
        vehicleName: `${currentVehicle.brand} ${currentVehicle.model} (${currentVehicle.year})`,
        vehicleCategory: currentVehicle.category,
        customerName,
        customerPhone: phone,
        customerWhatsApp: whatsapp,
        customerNationalId: nationalId,
        customerAddress: customerAddress || '',
        customerLicenseNumber: licenseNumber,
        customerId: (data.booking as Booking | undefined)?.customerId || user?.uid || '',
        customerEmail: (data.booking as Booking | undefined)?.customerEmail || user?.email || '',
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
        status: 'new',
        createdAt: new Date().toISOString(),
      } as Booking);

      setCreatedBooking(newBooking);
      if (onBookingCreated) onBookingCreated(newBooking);
      if (onBookingComplete) onBookingComplete(newBooking);
      setStep(3); // Success Screen
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'عذراً، حدث خطأ أثناء إتمام الحجز. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center p-3 sm:p-6 bg-slate-950">
      <div 
        ref={modalContainerRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="booking-modal-title"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl animate-in fade-in duration-200 text-slate-100 overflow-clip"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header - Fixed at top of modal */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="booking-modal-title" className="text-base sm:text-lg font-black text-white">
                {step === 3 ? 'تم تأكيد طلب الحجز' : 'حجز سيارة عبر الإنترنت'}
              </h3>
              <span className="text-xs text-slate-400">شاكر لتأجير السيارات • دمشق – جرمانا</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الحجز"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            id="close-booking-modal-btn"
            title="رجوع"
          >
            <X className="w-4 h-4" />
            <span>رجوع</span>
          </button>
        </div>

        {/* Progress indicators (Step 1 & 2) - Fixed below header */}
        {step !== 3 && (
          <div className="flex border-b border-slate-800/80 bg-slate-950/40 text-xs shrink-0">
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

        {/* Internal Scrollable Content Area */}
        <div 
          className=""
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Vehicle & Dates Selection */}
          {step === 1 && (
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            {/* Vehicle Selector */}
            <div>
              <label htmlFor="booking-vehicle-select" className="block text-xs font-semibold text-slate-300 mb-2">
                اختر السيارة من الأسطول
              </label>
              <select
                id="booking-vehicle-select"
                value={vehicleId || ''}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {vehicles.map((v) => {
                  const isRented = v.status === 'rented';
                  const isMaintenance = v.status === 'maintenance';
                  const statusNote = isRented ? ' [مؤجرة حالياً]' : isMaintenance ? ' [في الصيانة]' : '';
                  return (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.year}) - {v.dailyPrice}$/يوم [{v.category === 'light' ? 'اقتصادي' : v.category === 'medium' ? 'متوسط' : 'جيب 7 ركاب'}]{statusNote}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Vehicle Card Preview */}
            {currentVehicle && (
              <div className="flex gap-4 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                <img
                  src={currentVehicle.imageUrl}
                  alt={currentVehicle.model}
                  loading="lazy"
                  decoding="async"
                  width="96"
                  height="80"
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
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      currentVehicle.status === 'available'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : currentVehicle.status === 'rented'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {currentVehicle.status === 'available'
                      ? 'متاحة للحجز في دمشق'
                      : currentVehicle.status === 'rented'
                      ? 'مؤجرة حالياً (يمكن الحجز لتواريخ لاحقة)'
                      : 'في الصيانة الدورية'}
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
                  <label htmlFor="booking-pickup-date" className="block text-xs font-medium text-slate-300 mb-1">تاريخ الاستلام</label>
                  <div className="relative">
                    <input
                      id="booking-pickup-date"
                      type="date"
                      value={pickupDate || ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPickupDate(next);
                        // Keep the return date from ending up before the new pickup date
                        if (next && returnDate && returnDate < next) setReturnDate(next);
                      }}
                      min={todayDamascus}
                      className={`w-full min-h-[44px] bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 [color-scheme:dark] ${!pickupDate ? '[&::-webkit-datetime-edit]:opacity-0' : ''}`}
                      required
                    />
                    {!pickupDate && (
                      <div className="absolute inset-y-0 right-3 pointer-events-none flex items-center gap-1.5 text-slate-400 text-xs sm:text-sm">
                        <Calendar className="w-3.5 h-3.5 text-amber-400/70" />
                        <span>اختر التاريخ</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="booking-pickup-time" className="block text-xs font-medium text-slate-300 mb-1">وقت الاستلام</label>
                  <input
                    id="booking-pickup-time"
                    type="time"
                    value={pickupTime || ''}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 [color-scheme:dark]"
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
                  <label htmlFor="booking-return-date" className="block text-xs font-medium text-slate-300 mb-1">تاريخ الإعادة</label>
                  <div className="relative">
                    <input
                      id="booking-return-date"
                      type="date"
                      value={returnDate || ''}
                      onChange={(e) => setReturnDate(e.target.value)}
                      min={pickupDate || todayDamascus}
                      className={`w-full min-h-[44px] bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 [color-scheme:dark] ${!returnDate ? '[&::-webkit-datetime-edit]:opacity-0' : ''}`}
                      required
                    />
                    {!returnDate && (
                      <div className="absolute inset-y-0 right-3 pointer-events-none flex items-center gap-1.5 text-slate-400 text-xs sm:text-sm">
                        <Calendar className="w-3.5 h-3.5 text-amber-400/70" />
                        <span>اختر التاريخ</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="booking-return-time" className="block text-xs font-medium text-slate-300 mb-1">وقت الإعادة</label>
                  <input
                    id="booking-return-time"
                    type="time"
                    value={returnTime || ''}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Quick Live Pricing Preview Bar */}
            {pricing && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
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

                {/* Member Account Discount (Logged-in User) */}
                {pricing.memberDiscountApplied && pricing.memberDiscountAmount > 0 ? (
                  <div className="flex items-center justify-between text-xs text-emerald-400 font-bold bg-emerald-500/15 px-3 py-2 rounded-xl border border-emerald-500/25">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>خصم حساب العضو ({pricing.memberDiscountPercentage}%):</span>
                    </span>
                    <span className="font-mono font-black">-${pricing.memberDiscountAmount}</span>
                  </div>
                ) : !user && (appSettings.discountConfig?.enabled ?? true) ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/15 px-3 py-2 rounded-xl border border-amber-500/25">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>💡 نصيحة: سجّل دخولك بحسابك لتفعيل خصم العضوية بنسبة {pricing.memberDiscountPercentage || appSettings.discountConfig?.percentage || 10}% فوراً!</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Availability Warning */}
            {availabilityError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{availabilityError}</span>
              </div>
            )}

            {/* Technical Notice (Non-blocking) */}
            {technicalNotice && !availabilityError && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{technicalNotice}</span>
              </div>
            )}

            {/* Action: Next Step */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={isCheckingAvailability || Boolean(availabilityError)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                id="booking-step1-next-btn"
              >
                <span>
                  {isCheckingAvailability
                    ? 'جاري التحقق من توفر السيارة...'
                    : availabilityError
                    ? 'السيارة غير متاحة في الفترة المحددة'
                    : 'متابعة إدخال بيانات المستأجر'}
                </span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Customer Information & Final Confirmation */}
        {step === 2 && (
          <form onSubmit={handleBookingSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
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
                {/* Member Account Discount */}
                {pricing.memberDiscountApplied && pricing.memberDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>خصم حساب العضو المسجل ({pricing.memberDiscountPercentage}%):</span>
                    </span>
                    <span className="font-mono font-bold">-${pricing.memberDiscountAmount}</span>
                  </div>
                )}

                {!user && (appSettings.discountConfig?.enabled ?? true) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>سجّل دخولك بحسابك للاستفادة من خصم إضافي حتى {pricing.memberDiscountPercentage || appSettings.discountConfig?.percentage || 10}%</span>
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

            {/* Authentication Required Notice if guest */}
            {!user && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-amber-300">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>وفق سياسة أمان النظام، يتطلب تأكيد الحجز تسجيل الدخول بحسابك.</span>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 shrink-0"
                  >
                    تسجيل الدخول / إنشاء حساب
                  </button>
                )}
              </div>
            )}

            {/* Account Verification Required Notice if logged-in customer is unverified */}
            {user && isUserVerified === false && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-amber-300">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block text-xs">يتطلب تأكيد الحجز توثيق حسابك</span>
                    <span className="text-[11px] text-amber-300/90">
                      وفق سياسة الشركة، يلزم تصوير رخصة القيادة والبطاقة الشخصية للتحقق منها قبل إتمام الحجز.
                    </span>
                  </div>
                </div>
                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProfile();
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 shrink-0 flex items-center gap-1.5"
                  >
                    <span>توثيق الحساب الآن</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
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
                  <label htmlFor="booking-customer-name" className="block text-xs font-semibold text-slate-300 mb-1">الاسم الكامل الثلاثي *</label>
                  <input
                    id="booking-customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerName || ''}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="أحمد محمد العلي"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="booking-customer-phone" className="block text-xs font-semibold text-slate-300 mb-1">رقم الهاتف الجوال *</label>
                  <input
                    id="booking-customer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    value={customerPhone || ''}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0944123456"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-right"
                    required
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label htmlFor="booking-customer-whatsapp" className="block text-xs font-semibold text-slate-300 mb-1">رقم الواتساب للتأكيد الفوري *</label>
                  <input
                    id="booking-customer-whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    value={customerWhatsApp || ''}
                    onChange={(e) => setCustomerWhatsApp(e.target.value)}
                    placeholder="0944123456"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-right"
                    required
                  />
                </div>

                {/* National ID / Passport */}
                <div>
                  <label htmlFor="booking-customer-nid" className="block text-xs font-semibold text-slate-300 mb-1">الرقم الوطني / جواز السفر</label>
                  <input
                    id="booking-customer-nid"
                    type="text"
                    value={customerNationalId || ''}
                    onChange={(e) => setCustomerNationalId(e.target.value)}
                    placeholder="010200..."
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                </div>

                {/* Driver License */}
                <div>
                  <label htmlFor="booking-customer-license" className="block text-xs font-semibold text-slate-300 mb-1">رقم شهادة القيادة</label>
                  <input
                    id="booking-customer-license"
                    type="text"
                    value={customerLicenseNumber || ''}
                    onChange={(e) => setCustomerLicenseNumber(e.target.value)}
                    placeholder="DL-12345"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="booking-customer-address" className="block text-xs font-semibold text-slate-300 mb-1">عنوان الإقامة أو الفندق</label>
                  <input
                    id="booking-customer-address"
                    type="text"
                    autoComplete="street-address"
                    value={customerAddress || ''}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="دمشق، المزة / فندق الشام..."
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label htmlFor="booking-customer-notes" className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات أو طلبات إضافية (اختياري)</label>
                <textarea
                  id="booking-customer-notes"
                  value={notes || ''}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: طلب كرسي أطفال، تسليم بمطار دمشق، موعد وصول الطائرة..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[44px] px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700/60 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <ChevronRight className="w-4 h-4" />
                <span>رجوع</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !user || isUserVerified === false}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                id="booking-step2-submit-btn"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : !user ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>سجّل الدخول أولاً لتأكيد الحجز</span>
                  </>
                ) : isUserVerified === false ? (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>يلزم توثيق الحساب للمتابعة</span>
                  </>
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

        {/* Step 3: Booking Success Voucher / سند تأكيد الحجز */}
        {step === 3 && createdBooking && (
          <div className="p-6 text-center space-y-6" id="booking-success-step3-container">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h4 className="text-xl sm:text-2xl font-black text-white">تم استلام طلب الحجز بنجاح</h4>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-semibold">
                طلبك الآن بانتظار موافقة الإدارة، وسنتواصل معك لتأكيده
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                إيصال استلام طلب حجز (غير مؤكد)
              </p>
            </div>

            {/* Comprehensive Voucher Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 text-right space-y-4 max-w-xl mx-auto shadow-2xl print:border-black print:text-black">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 gap-3">
                <div>
                  <span className="text-xs text-slate-400 block">رقم الحجز المرجعي:</span>
                  <span className="text-base sm:text-lg font-black text-amber-400 font-mono tracking-wider" dir="ltr">
                    {createdBooking.bookingNumber}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    يمكنك الاطلاع على حالة حجزك دائماً من ملفك الشخصي ← حجوزاتي
                  </p>
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenProfile();
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>عرض حجوزاتي</span>
                    </button>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <span className="text-xs text-slate-400 block">حالة الحجز:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    بانتظار الموافقة
                  </span>
                </div>
              </div>

              {/* Customer and Vehicle Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-b border-slate-800/80 pb-3">
                <div className="space-y-1">
                  <span className="text-slate-400 block">اسم المستأجر:</span>
                  <span className="text-white font-bold text-sm">{createdBooking.customerName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">رقم الهاتف / الواتساب:</span>
                  <span className="text-slate-200 font-mono font-bold" dir="ltr">{createdBooking.customerPhone}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">السيارة المختارة:</span>
                  <span className="text-white font-bold text-sm">{createdBooking.vehicleName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">مدة الإيجار:</span>
                  <span className="text-amber-400 font-bold">{createdBooking.rentalDays} أيام</span>
                </div>
              </div>

              {/* Rental Dates & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-2xl border border-slate-800/60">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block">موعد الاستلام:</span>
                    <span className="text-slate-100 font-semibold">{createdBooking.pickupDate}</span>
                    <span className="text-slate-400 text-[11px] block">الساعة: {createdBooking.pickupTime}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block">موعد الإعادة:</span>
                    <span className="text-slate-100 font-semibold">{createdBooking.returnDate}</span>
                    <span className="text-slate-400 text-[11px] block">الساعة: {createdBooking.returnTime}</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-1.5 text-xs bg-slate-900/40 p-3 rounded-2xl border border-slate-800/50">
                <div className="flex justify-between text-slate-300">
                  <span>الأجرة اليومية الأساسية:</span>
                  <span className="font-mono font-semibold">${createdBooking.dailyPrice} × {createdBooking.rentalDays} أيام = ${createdBooking.basePrice || (createdBooking.dailyPrice * createdBooking.rentalDays)}</span>
                </div>
                {createdBooking.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>خصم الأعضاء المطبق:</span>
                    <span className="font-mono font-bold">-${createdBooking.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-300">
                  <span>مبلغ التأمين المسترد (يدفع عند الاستلام):</span>
                  <span className="font-mono font-semibold">${createdBooking.insuranceAmount || (createdBooking.rentalDays <= 2 ? 500 : 300)}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-black">
                  <span className="text-white">المبلغ الإجمالي الشامل:</span>
                  <span className="text-amber-400 font-mono text-base sm:text-lg font-black">${createdBooking.totalPrice}</span>
                </div>
              </div>

              {/* Note */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>سيقوم الموظف المختص بالتواصل معك هاتفياً أو عبر الواتساب لتأكيد مكان التسليم.</span>
              </div>
            </div>

            {/* Actions: WhatsApp Direct Sharing */}
            <div className="space-y-3 max-w-xl mx-auto">
              <button
                type="button"
                onClick={() => openWhatsAppChat(createdBooking)}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                id="booking-send-whatsapp-btn"
              >
                <MessageCircle className="w-5 h-5" />
                <span>إرسال تفاصيل وسند الحجز عبر واتساب فوراً (00963944331774)</span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
