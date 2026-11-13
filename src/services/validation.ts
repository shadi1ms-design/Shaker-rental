import { z } from 'zod';
import { todayLocalISO } from '../utils/dateUtils';
import { isValidPhone } from '../utils/phone';

export const phoneSchema = z
  .string()
  .trim()
  .refine((val) => isValidPhone(val), {
    message: 'رقم الهاتف يجب ألا يقل عن 9 أرقام',
  });

export const bookingFormSchema = z.object({
  vehicleId: z.string().min(1, 'يرجى اختيار السيارة المطلوبة'),
  customerName: z.string().trim().min(3, 'يرجى إدخال الاسم الثلاثي بشكل صحيح'),
  customerPhone: phoneSchema,
  customerWhatsApp: phoneSchema,
  customerAddress: z.string().trim().min(20, 'يرجى إدخال العنوان بالتفصيل (20 حرفاً على الأقل)').max(300, 'العنوان يجب ألا يتجاوز 300 حرف'),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'يرجى اختيار تاريخ استلام صالح'),
  pickupTime: z.string().min(1, 'يرجى اختيار وقت الاستلام'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'يرجى اختيار تاريخ تسليم صالح'),
  returnTime: z.string().min(1, 'يرجى اختيار وقت التسليم'),
  notes: z.string().max(1000, 'الملاحظات يجب ألا تتجاوز 1000 حرف').optional().or(z.literal('')),
  deliveryLocation: z.string().max(200, 'موقع التسليم يجب ألا يتجاوز 200 حرف').optional().or(z.literal('')),
}).refine((data) => {
  if (!data.pickupDate) return true;
  const today = todayLocalISO();
  return data.pickupDate >= today;
}, {
  message: 'تاريخ الاستلام لا يمكن أن يكون في الماضي',
  path: ['pickupDate'],
}).refine((data) => {
  if (!data.pickupDate || !data.returnDate) return true;
  return new Date(data.returnDate) >= new Date(data.pickupDate);
}, {
  message: 'تاريخ التسليم يجب أن يكون مساوياً أو بعد تاريخ الاستلام',
  path: ['returnDate'],
});

export function isSafeImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (lower.startsWith('//')) {
    return false;
  }
  return lower.startsWith('http://') || lower.startsWith('https://') || (lower.startsWith('/') && !lower.startsWith('//'));
}

export const vehicleFormSchema = z.object({
  brand: z.string().trim().min(2, 'يرجى إدخال الشركة المصنعة (حرفين على الأقل)'),
  model: z.string().trim().min(2, 'يرجى إدخال طراز السيارة (حرفين على الأقل)'),
  year: z.number().int().min(1995, 'سنة الصنع يجب أن تكون بين 1995 و 2030').max(2030, 'سنة الصنع يجب أن تكون بين 1995 و 2030'),
  color: z.string().trim().min(2, 'يرجى إدخال لون السيارة'),
  category: z.enum(['light', 'medium', 'jeep_7seats']),
  seats: z.number().int().min(2, 'عدد المقاعد يجب أن يكون بين 2 و 15 مقعداً').max(15, 'عدد المقاعد يجب أن يكون بين 2 و 15 مقعداً'),
  transmission: z.enum(['automatic', 'manual']),
  fuelType: z.enum(['petrol', 'diesel', 'hybrid', 'electric']),
  dailyPrice: z.number().min(10, 'السعر اليومي يجب ألا يقل عن 10$'),
  plateNumber: z.string().trim().min(3, 'يرجى إدخال رقم اللوحة (3 أحرف على الأقل)'),
  currentMileage: z.number().min(0, 'عداد الكيلومترات يجب ألا يكون سالباً'),
  lastOilChangeMileage: z.number().min(0, 'عداد آخر تغيير زيت يجب ألا يكون سالباً').optional(),
  oilChangeIntervalKm: z.number().min(500, 'دورة تغيير الزيت يجب ألا تقل عن 500 كم').max(50000, 'دورة تغيير الزيت يجب ألا تتجاوز 50,000 كم').optional(),
  status: z.enum(['available', 'reserved', 'rented', 'maintenance', 'inactive']),
  imageUrl: z.string().trim().refine(isSafeImageUrl, { message: 'أضف صورة واحدة على الأقل' }),
  images: z.array(
    z.string().trim().refine(isSafeImageUrl, { message: 'يحتوي ألبوم الصور على رابط غير صالح أو غير آمن' })
  ).max(15, 'الحد الأقصى للصور الإضافية هو 15 صورة').optional(),
  description: z.string().max(1000, 'الوصف يجب ألا يتجاوز 1000 حرف').optional().or(z.literal('')),
}).refine((data) => {
  if (data.category === 'jeep_7seats') {
    return data.seats >= 7;
  }
  return true;
}, {
  message: 'فئة SUV تتطلب 7 مقاعد على الأقل',
  path: ['seats'],
});

export const customerFormSchema = z.object({
  fullName: z.string().trim().min(3, 'اسم العميل لا يقل عن 3 أحرف'),
  phone: phoneSchema,
  whatsapp: z.string().trim().refine((val) => !val || isValidPhone(val), { message: 'رقم الواتساب غير صالح' }).optional().or(z.literal('')),
  nationalId: z.string().trim().optional().or(z.literal('')),
  drivingLicense: z.string().trim().optional().or(z.literal('')),
  nationality: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
