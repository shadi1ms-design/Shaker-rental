import React, { useState, useMemo, useEffect } from 'react';
import { Vehicle, Booking } from '../types';
import { calculateRentalDays, calculateRentalPrice } from '../services/pricing';
import { functionsService } from '../services/functionsService';
import { bookingFormSchema } from '../services/validation';
import { openWhatsAppChat } from '../services/whatsapp';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/DataContext';
import { addDaysISO, todayLocalISO } from '../utils/dateUtils';
import { normalizeDigits, isValidPhone } from '../utils/phone';
import { formatMoney } from '../utils/format';
import { PhoneInput } from './ui/PhoneInput';
import { DateField } from './ui/DateField';
import { useVehicleAvailability } from '../utils/vehicleAvailability';
import { getVehicleCategoryLabel } from '../constants/vehicleCategories';
import { COMPANY_INFO } from '../constants/company';
import { useSearchParams } from '../router';
import { isValidIsoDateParam } from '../utils/catalogQuery';
import {
  Check,
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
  AlertCircle,
  Copy,
} from 'lucide-react';

export interface BookingViewProps {
  vehicles?: Vehicle[];
  vehicle?: Vehicle | null;
  onOpenAuth?: () => void;
  onBookingCreated?: (booking: Booking) => void;
  initialDates?: { pickupDate: string; returnDate: string };
}

export const BookingView: React.FC<BookingViewProps> = ({
  vehicles = [],
  vehicle,
  onOpenAuth,
  onBookingCreated,
  initialDates,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const todayDamascus = todayLocalISO();
  const defaultPickupDate = addDaysISO(todayDamascus, 1);
  const defaultReturnDate = addDaysISO(todayDamascus, 4);

  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');
  const hasValidUrlDates = Boolean(
    isValidIsoDateParam(urlFrom) && isValidIsoDateParam(urlTo) && urlTo >= urlFrom
  );

  const activeInitialVehicle = vehicle || vehicles?.[0] || null;

  const [vehicleId, setVehicleId] = useState<string>(
    activeInitialVehicle?.id || (vehicles?.[0]?.id || '')
  );
  const [pickupDate, setPickupDate] = useState<string>(
    initialDates?.pickupDate || (hasValidUrlDates ? urlFrom! : defaultPickupDate)
  );
  const [pickupTime, setPickupTime] = useState<string>('10:00');
  const [returnDate, setReturnDate] = useState<string>(
    initialDates?.returnDate || (hasValidUrlDates ? urlTo! : defaultReturnDate)
  );
  const [returnTime, setReturnTime] = useState<string>('10:00');

  const syncDatesToUrl = (nextPickup: string, nextReturn: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (isValidIsoDateParam(nextPickup) && isValidIsoDateParam(nextReturn) && nextReturn >= nextPickup) {
          next.set('from', nextPickup);
          next.set('to', nextReturn);
        } else {
          next.delete('from');
          next.delete('to');
        }
        return next;
      },
      { replace: true, scroll: false }
    );
  };

  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerWhatsApp, setCustomerWhatsApp] = useState(user?.phone || '');
  const [samePhoneWhatsApp, setSamePhoneWhatsApp] = useState(true);
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Field error state for validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (user) {
      setTimeout(() => {
        if (!customerName.trim() && user.displayName) setCustomerName(user.displayName);
        if (!customerPhone.trim() && user.phone) {
          setCustomerPhone(user.phone);
          if (samePhoneWhatsApp) setCustomerWhatsApp(user.phone);
        }
        if (!customerAddress.trim() && user.address) {
          setCustomerAddress(user.address);
        }
      }, 0);
    }
  }, [user?.phone, user?.displayName, user?.address, user, samePhoneWhatsApp, customerName, customerPhone, customerAddress]);

  const { settings, settingsReady } = useAppData();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [technicalNotice, setTechnicalNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);

  const currentVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === vehicleId) || vehicle || vehicles?.[0] || null;
  }, [vehicles, vehicleId, vehicle]);

  const { nextAvailableDate } = useVehicleAvailability(currentVehicle);

  // Auto-adjust default pickup date if vehicle is reserved and starts after default date
  useEffect(() => {
    if (nextAvailableDate && !initialDates?.pickupDate && !hasValidUrlDates) {
      if (pickupDate < nextAvailableDate) {
        setTimeout(() => {
          setPickupDate(nextAvailableDate);
          setReturnDate(addDaysISO(nextAvailableDate, 3));
        }, 0);
      }
    }
  }, [nextAvailableDate, initialDates?.pickupDate, hasValidUrlDates, pickupDate]);

  const rentalDays = useMemo(() => {
    return calculateRentalDays(pickupDate, returnDate, pickupTime, returnTime);
  }, [pickupDate, returnDate, pickupTime, returnTime]);

  const pricing = useMemo(() => {
    if (!currentVehicle) return null;
    const effectiveSettings = settingsReady
      ? settings
      : { ...settings, discountConfig: { enabled: false, percentage: 0, scope: 'all' as const, vehicleIds: [] } };
    return calculateRentalPrice(
      currentVehicle.category,
      currentVehicle.dailyPrice,
      rentalDays,
      effectiveSettings,
      {
        isUserLoggedIn: Boolean(user),
        vehicleId: currentVehicle.id,
        vehicleDocId: currentVehicle.docId ?? currentVehicle.id,
        vehicleDataId: currentVehicle.dataId ?? currentVehicle.id,
      }
    );
  }, [currentVehicle, rentalDays, settings, settingsReady, user]);

  React.useEffect(() => {
    let isMounted = true;
    if (!vehicleId || !pickupDate || !returnDate) {
      setTimeout(() => {
        setAvailabilityError(null);
        setTechnicalNotice(null);
      }, 0);
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
          setAvailabilityError(null);
          setTechnicalNotice('تعذر التحقق من التوفر حالياً، حاول مرة أخرى');
        } else if (res.data?.available === false) {
          const reason =
            res.data?.conflictReason ||
            'عذراً، السيارة غير متاحة في التواريخ والأوقات المحددة.';
          setAvailabilityError(reason);
          setTechnicalNotice(null);
        } else {
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
    setFieldErrors({});

    const phone = normalizeDigits(customerPhone).trim();
    const whatsapp = samePhoneWhatsApp ? phone : normalizeDigits(customerWhatsApp).trim();
    const address = customerAddress.trim();

    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.name = 'يرجى إدخال الاسم الكامل';
    if (!isValidPhone(phone)) errors.phone = 'رقم الهاتف غير صحيح';
    if (!isValidPhone(whatsapp)) errors.whatsapp = 'رقم الواتساب غير صحيح';
    if (!address) {
      errors.customerAddress = 'يرجى إدخال عنوان الإقامة أو الفندق بالتفصيل';
    } else if (address.length < 20) {
      errors.customerAddress = 'يرجى إدخال العنوان بالتفصيل (20 حرفاً على الأقل)';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const count = Object.keys(errors).length;
      setErrorMessage(`يرجى تصحيح الأخطاء الـ ${count} المطلوبة في الحقول أدناه`);
      setTimeout(() => {
        const el = document.querySelector('[aria-invalid="true"]');
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.focus();
        }
      }, 50);
      return;
    }

    const validationResult = bookingFormSchema.safeParse({
      vehicleId,
      customerName,
      customerPhone: phone,
      customerWhatsApp: whatsapp,
      customerAddress: address,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      notes,
    });

    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      const errorMap: Record<string, string> = {};
      issues.forEach((issue) => {
        const path = issue.path[0]?.toString();
        if (path) errorMap[path] = issue.message;
      });
      setFieldErrors(errorMap);
      const count = Object.keys(errorMap).length || 1;
      setErrorMessage(`يرجى تصحيح ${count} خطأ في الحقول المطلوبة`);
      setTimeout(() => {
        const el = document.querySelector('[aria-invalid="true"]');
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.focus();
        }
      }, 50);
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
        customerAddress: address,
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        notes,
        deliveryLocation,
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
        customerAddress: address,
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
        discountPercentage: pricing.memberDiscountApplied ? pricing.memberDiscountPercentage : 0,
        discountBase: pricing.basePrice,
        insuranceAmount: pricing.insuranceAmount,
        driverFee: pricing.driverFee ?? 0,
        totalPrice: pricing.totalPrice,
        notes,
        status: 'new',
        createdAt: new Date().toISOString(),
      } as Booking);

      setCreatedBooking(newBooking);
      if (onBookingCreated) onBookingCreated(newBooking);
      setStep(3);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'عذراً، حدث خطأ أثناء إتمام الحجز. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBookingNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <section className="flex items-start justify-center p-3 sm:p-6 bg-slate-950" aria-labelledby="booking-modal-title">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-card sm:rounded-modal shadow-2xl animate-in fade-in duration-200 text-slate-100 overflow-hidden">
        {/* Header - Simplified */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <h2 id="booking-modal-title" className="text-base sm:text-lg font-extrabold text-white">
              {step === 3 ? 'تم تأكيد طلب الحجز' : 'حجز سيارة عبر الإنترنت'}
            </h2>
          </div>
        </div>

        {/* Progress indicator (Step 1 & 2) */}
        {step !== 3 && (
          <nav aria-label="خطوات الحجز" className="px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
            <ol className="flex items-center gap-2">
              <li className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  aria-current={step === 1 ? 'step' : undefined}
                  className="min-h-11 flex items-center gap-2 min-w-0 cursor-pointer"
                >
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold tabular-nums ${
                      step === 1 ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {step === 1 ? '1' : <Check className="w-4 h-4" />}
                  </span>
                  <span className={`text-sm font-bold truncate ${step === 1 ? 'text-amber-400' : 'text-slate-300'}`}>
                    السيارة والتواريخ
                  </span>
                </button>
              </li>
              <li aria-hidden="true" className={`flex-1 h-0.5 rounded-full ${step === 2 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              <li className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleNextStep}
                  aria-current={step === 2 ? 'step' : undefined}
                  className="min-h-11 flex items-center gap-2 min-w-0 cursor-pointer"
                >
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold tabular-nums ${
                      step === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    2
                  </span>
                  <span className={`text-sm font-bold truncate ${step === 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                    بيانات المستأجر والتأكيد
                  </span>
                </button>
              </li>
            </ol>
          </nav>
        )}

        <div>
          {/* Error Alert */}
          {errorMessage && (
            <div role="alert" aria-live="assertive" className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-card bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Vehicle & Dates Selection */}
          {step === 1 && (
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 text-sm">
            <div>
              <label htmlFor="booking-vehicle-select" className="block text-sm font-semibold text-slate-200 mb-2 cursor-pointer">
                اختر السيارة من الأسطول
              </label>
              <select
                id="booking-vehicle-select"
                value={vehicleId || ''}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {vehicles.map((v) => {
                  const isRented = v.status === 'rented';
                  const isMaintenance = v.status === 'maintenance';
                  const statusNote = isRented ? ' [مؤجرة حالياً]' : isMaintenance ? ' [في الصيانة]' : '';
                  return (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.year}) - {formatMoney(v.dailyPrice)}/يوم [{getVehicleCategoryLabel(v.category)}]{statusNote}
                    </option>
                  );
                })}
              </select>
            </div>

            {currentVehicle && (
              <div className="flex gap-4 p-3.5 bg-slate-950/80 rounded-card border border-slate-800">
                <img
                  src={currentVehicle.imageUrl}
                  alt={`${currentVehicle.brand} ${currentVehicle.model}`}
                  loading="lazy"
                  decoding="async"
                  width="96"
                  height="80"
                  className="w-24 h-20 object-cover rounded-xl shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-bold text-white truncate">
                      {currentVehicle.brand} {currentVehicle.model}
                    </h3>
                    <span className="text-sm font-extrabold text-amber-400 tabular-nums shrink-0">{formatMoney(currentVehicle.dailyPrice)}/يوم</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 tabular-nums">
                    موديل {currentVehicle.year} • {currentVehicle.seats} مقاعد • {currentVehicle.color}
                  </p>
                  <span
                    className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      currentVehicle.status === 'available'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : currentVehicle.status === 'rented'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {currentVehicle.status === 'available'
                      ? 'متاحة للحجز في دمشق'
                      : currentVehicle.status === 'rented' || currentVehicle.status === 'reserved'
                      ? nextAvailableDate
                        ? `متاحة بدءاً من ${nextAvailableDate} (يمكنك اختيار تواريخ لاحقة)`
                        : 'محجوزة حالياً (يمكنك اختيار تواريخ لاحقة)'
                      : 'في الصيانة الدورية'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-card border border-slate-800 space-y-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  موعد الاستلام
                </span>
                <div>
                  <label htmlFor="booking-pickup-date" className="text-sm font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5 cursor-pointer">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>تاريخ الاستلام</span>
                  </label>
                  <DateField
                    id="booking-pickup-date"
                    value={pickupDate || ''}
                    onChange={(next) => {
                      const nextReturn = next && returnDate && returnDate < next ? next : returnDate;
                      setPickupDate(next);
                      if (nextReturn !== returnDate) setReturnDate(nextReturn);
                      syncDatesToUrl(next, nextReturn);
                    }}
                    min={todayDamascus}
                    required
                    ariaLabel="تاريخ الاستلام"
                  />
                </div>
                <div>
                  <label htmlFor="booking-pickup-time" className="block text-sm font-medium text-slate-200 mb-1 cursor-pointer">الوقت</label>
                  <input
                    id="booking-pickup-time"
                    type="time"
                    value={pickupTime || ''}
                    onChange={(e) => setPickupTime(e.target.value)}
                    dir="ltr"
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 [color-scheme:dark] cursor-pointer font-mono text-start tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-card border border-slate-800 space-y-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  موعد الإعادة والتسليم
                </span>
                <div>
                  <label htmlFor="booking-return-date" className="text-sm font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5 cursor-pointer">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>تاريخ الإرجاع</span>
                  </label>
                  <DateField
                    id="booking-return-date"
                    value={returnDate || ''}
                    onChange={(next) => {
                      setReturnDate(next);
                      syncDatesToUrl(pickupDate, next);
                    }}
                    min={pickupDate || todayDamascus}
                    required
                    ariaLabel="تاريخ الإرجاع"
                  />
                </div>
                <div>
                  <label htmlFor="booking-return-time" className="block text-sm font-medium text-slate-200 mb-1 cursor-pointer">الوقت</label>
                  <input
                    id="booking-return-time"
                    type="time"
                    value={returnTime || ''}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 [color-scheme:dark] cursor-pointer tabular-nums"
                    required
                  />
                </div>
              </div>
            </div>

            {pricing && (
              <div className="p-4 rounded-card bg-amber-500/10 border border-amber-500/20 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm text-amber-400 font-bold block tabular-nums">
                      المدة المحسوبة: {pricing.rentalDays} {pricing.rentalDays === 1 ? 'يوم' : pricing.rentalDays === 2 ? 'يومان' : 'أيام'}
                    </span>
                    <span className="text-sm text-slate-300">{pricing.explanation}</span>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="text-sm text-slate-300 block">الإجمالي المبدئي</span>
                    <span className="text-xl font-extrabold text-white tabular-nums">{formatMoney(pricing.totalPrice)}</span>
                  </div>
                </div>

                {pricing.memberDiscountApplied && pricing.memberDiscountAmount > 0 ? (
                  <div className="flex items-center justify-between text-sm text-emerald-400 font-bold bg-emerald-500/15 px-3 py-2 rounded-xl border border-emerald-500/25">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>خصم حساب العضو ({pricing.memberDiscountPercentage}%):</span>
                    </span>
                    <span className="tabular-nums font-extrabold">-{formatMoney(pricing.memberDiscountAmount)}</span>
                  </div>
                ) : null}
              </div>
            )}

            {!user && (
              <div className="p-4 rounded-card bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
                <div className="flex items-start gap-2.5 text-amber-200">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">سجّل الدخول لتأكيد الحجز لاحقاً</span>
                    <span className="text-slate-300">
                      {settingsReady && pricing?.memberDiscountEligible && pricing.memberDiscountPercentage > 0
                        ? `يمكنك استعراض السعر الآن، وعند تسجيل الدخول سيتفعّل خصم الأعضاء (${pricing.memberDiscountPercentage}%) ويتاح تأكيد الطلب.`
                        : 'يمكنك حساب التكلفة الآن، ويتطلب إرسال وتأكيد الحجز تسجيل الدخول بحسابك.'}
                    </span>
                  </div>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="min-h-11 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold shrink-0 cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                )}
              </div>
            )}

            {availabilityError && (
              <div className="p-3.5 rounded-card bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{availabilityError}</span>
              </div>
            )}

            {technicalNotice && !availabilityError && (
              <div className="p-3.5 rounded-card bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{technicalNotice}</span>
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={isCheckingAvailability || Boolean(availabilityError)}
                className="w-full min-h-11 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          <form onSubmit={handleBookingSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6 text-sm">
            {pricing && currentVehicle && (
              <div className="bg-slate-950 border border-slate-800 rounded-card p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center text-slate-200 font-bold border-b border-slate-800 pb-2">
                  <span>السيارة: {currentVehicle.brand} {currentVehicle.model}</span>
                  <span className="text-amber-400 tabular-nums">{pricing.rentalDays} أيام</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>الأجرة الأساسية ({formatMoney(currentVehicle.dailyPrice)} × {pricing.rentalDays}):</span>
                  <span className="tabular-nums">{formatMoney(pricing.basePrice)}</span>
                </div>
                {pricing.memberDiscountApplied && pricing.memberDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      <span>خصم حساب العضو المسجل ({pricing.memberDiscountPercentage}%):</span>
                    </span>
                    <span className="tabular-nums font-bold">-{formatMoney(pricing.memberDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-300">
                  <span>التأمين المسترد:</span>
                  <span className="text-amber-300 font-semibold tabular-nums">{formatMoney(pricing.insuranceAmount)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-extrabold text-white">
                  <span>المبلغ الإجمالي النهائي:</span>
                  <span className="text-xl text-amber-400 tabular-nums">{formatMoney(pricing.totalPrice)}</span>
                </div>
              </div>
            )}

            {!user && (
              <div className="p-4 rounded-card bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 text-amber-300">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>وفق سياسة أمان النظام، يتطلب تأكيد الحجز تسجيل الدخول بحسابك.</span>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="min-h-11 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold shrink-0 cursor-pointer"
                  >
                    تسجيل الدخول / إنشاء حساب
                  </button>
                )}
              </div>
            )}

            {/* Group 1: بياناتك الأساسية */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-card p-4 sm:p-5 space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>بياناتك الأساسية للتواصل</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="booking-customer-name" className="block text-sm font-semibold text-slate-200 mb-1 cursor-pointer">الاسم الكامل الثلاثي *</label>
                  <input
                    id="booking-customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerName || ''}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="أحمد محمد العلي"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'error-name' : undefined}
                    className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                  {fieldErrors.name && <p id="error-name" className="text-sm text-rose-400 mt-1">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label htmlFor="booking-customer-phone" className="block text-sm font-semibold text-slate-200 mb-1 cursor-pointer">رقم الهاتف الجوال *</label>
                  <PhoneInput
                    id="booking-customer-phone"
                    name="customerPhone"
                    value={customerPhone}
                    onChange={(val) => {
                      setCustomerPhone(val);
                      if (samePhoneWhatsApp) setCustomerWhatsApp(val);
                    }}
                    placeholder="9441234567"
                    required
                    error={fieldErrors.phone}
                    aria-describedby={fieldErrors.phone ? 'error-phone' : undefined}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label htmlFor="booking-customer-whatsapp" className="block text-sm font-semibold text-slate-200 cursor-pointer">رقم الواتساب للتأكيد الفوري *</label>
                  <label className="min-h-11 inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={samePhoneWhatsApp}
                      onChange={(e) => {
                        setSamePhoneWhatsApp(e.target.checked);
                        if (e.target.checked) setCustomerWhatsApp(customerPhone);
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span>نفس رقم الهاتف</span>
                  </label>
                </div>
                <PhoneInput
                  id="booking-customer-whatsapp"
                  name="customerWhatsApp"
                  disabled={samePhoneWhatsApp}
                  value={samePhoneWhatsApp ? customerPhone : customerWhatsApp}
                  onChange={setCustomerWhatsApp}
                  placeholder="9441234567"
                  required
                  error={fieldErrors.whatsapp}
                  aria-describedby={fieldErrors.whatsapp ? 'error-whatsapp' : undefined}
                />
              </div>
            </div>

            {/* Group 2: عنوان الإقامة أو الفندق (إجباري) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-card p-4 sm:p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="booking-customer-address" className="block text-sm font-semibold text-slate-200 cursor-pointer">
                    عنوان الإقامة أو الفندق بالتفصيل <span className="text-amber-500 font-bold">*</span>
                  </label>
                  <span className={`text-xs font-mono tabular-nums ${customerAddress.trim().length >= 20 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {customerAddress.trim().length} / 300 حرف
                  </span>
                </div>
                <input
                  id="booking-customer-address"
                  type="text"
                  maxLength={300}
                  autoComplete="street-address"
                  value={customerAddress || ''}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="مثال: دمشق - المزة فيلات غربية - جانب حديقة الجلاء - بناء رقم 14"
                  aria-invalid={Boolean(fieldErrors.customerAddress || (customerAddress.trim().length > 0 && customerAddress.trim().length < 20))}
                  className={`w-full min-h-[44px] bg-slate-900 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${
                    fieldErrors.customerAddress ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                  }`}
                  required
                />
                {fieldErrors.customerAddress ? (
                  <p className="text-rose-400 text-sm mt-1 font-semibold">{fieldErrors.customerAddress}</p>
                ) : customerAddress.trim().length < 20 ? (
                  <p className="text-amber-300 text-sm mt-1">يرجى إدخال العنوان بالتفصيل (20 حرفاً على الأقل)</p>
                ) : null}
              </div>

                  <div>
                    <label htmlFor="booking-customer-notes" className="block text-sm font-semibold text-slate-200 mb-1 cursor-pointer">ملاحظات أو طلبات إضافية (اختياري)</label>
                    <textarea
                      id="booking-customer-notes"
                      value={notes || ''}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثال: طلب كرسي أطفال، تسليم بمطار دمشق..."
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-delivery-location" className="block text-sm font-semibold text-slate-200 mb-1 cursor-pointer">
                      مكان التسليم (أينما كنت)
                    </label>
                    <input
                      id="booking-delivery-location"
                      type="text"
                      value={deliveryLocation || ''}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="عنوان محدد للتسليم..."
                      className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[44px] px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-bold transition-colors flex items-center gap-1.5 border border-slate-700/60 shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>رجوع</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !user}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                id="booking-step2-submit-btn"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : !user ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>سجّل الدخول أولاً لتأكيد الحجز</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الحجز الآن ({formatMoney(pricing?.totalPrice || 0)})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Screen */}
        {step === 3 && createdBooking && (
          <div className="p-6 text-center space-y-6" id="booking-success-step3-container">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">تم استلام طلب الحجز بنجاح</h3>
              <p className="text-sm text-slate-200 mt-1 font-semibold">
                طلبك الآن بانتظار موافقة الإدارة، وسنتواصل معك لتأكيده
              </p>
              <p className="text-sm text-amber-300 mt-2 font-semibold bg-amber-500/10 py-2 px-4 rounded-xl border border-amber-500/20 inline-block">
                ما التالي؟ سيقوم فريقنا بمراجعة الحجز والاتصال بك هاتفياً أو عبر الواتساب لتأكيد الموعد واستلام السيارة.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-modal p-5 sm:p-6 text-start space-y-4 max-w-xl mx-auto shadow-2xl">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 gap-3">
                <div>
                  <span className="text-sm text-slate-300 block">رقم الحجز المرجعي:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base sm:text-lg font-extrabold text-amber-400 tabular-nums tracking-wider" dir="ltr">
                      {createdBooking.bookingNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyBookingNumber(createdBooking.bookingNumber)}
                      className="min-h-11 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="نسخ رقم الحجز"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>{copiedCode ? 'تم النسخ!' : 'نسخ'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    يمكنك متابعة حالة حجزك من ملفك الشخصي ← حجوزاتي
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <span className="text-sm text-slate-300 block mb-1">حالة الحجز:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    بانتظار الموافقة
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-b border-slate-800/80 pb-3">
                <div className="space-y-1">
                  <span className="text-slate-400 block text-sm">اسم المستأجر:</span>
                  <span className="text-white font-bold">{createdBooking.customerName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-sm">رقم الهاتف:</span>
                  <span className="text-slate-200 tabular-nums font-bold" dir="ltr">{createdBooking.customerPhone}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-sm">السيارة المختارة:</span>
                  <span className="text-white font-bold">{createdBooking.vehicleName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-sm">مدة الإيجار:</span>
                  <span className="text-amber-400 font-bold tabular-nums">{createdBooking.rentalDays} أيام</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-extrabold pt-1">
                <span className="text-white">المبلغ الإجمالي الشامل:</span>
                <span className="text-amber-400 tabular-nums text-lg">{formatMoney(createdBooking.totalPrice)}</span>
              </div>
            </div>

            <div className="space-y-3 max-w-xl mx-auto">
              <button
                type="button"
                onClick={() => openWhatsAppChat(createdBooking)}
                className="w-full min-h-11 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                id="booking-send-whatsapp-btn"
              >
                <MessageCircle className="w-5 h-5" />
                <span>تواصل واتساب بالحجز (<span dir="ltr" className="tabular-nums">{COMPANY_INFO.phone}</span>)</span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </section>
  );
};

export default BookingView;
