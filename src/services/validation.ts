import { z } from 'zod';
import { todayLocalISO } from '../utils/dateUtils';

export const bookingFormSchema = z.object({
  vehicleId: z.string().min(1, 'يرجى اختيار السيارة المطلوبة'),
  customerName: z.string().trim().min(3, 'يرجى إدخال الاسم الثلاثي بشكل صحيح'),
  customerPhone: z.string().trim().min(9, 'يرجى إدخال رقم هاتف صالح لا يقل عن 9 أرقام'),
  customerWhatsApp: z.string().trim().min(9, 'يرجى إدخال رقم واتساب للتواصل'),
  customerNationalId: z.string().trim().min(6, 'يرجى إدخال رقم الهوية أو جواز السفر').optional().or(z.literal('')),
  customerAddress: z.string().trim().min(3, 'يرجى إدخال عنوان الإقامة أو الفندق').optional().or(z.literal('')),
  customerLicenseNumber: z.string().trim().min(4, 'يرجى إدخال رقم شهادة القيادة').optional().or(z.literal('')),
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

export const vehicleFormSchema = z.object({
  brand: z.string().trim().min(2, 'يرجى إدخال الشركة المصنعة'),
  model: z.string().trim().min(2, 'يرجى إدخال طراز السيارة'),
  year: z.number().int().min(1995, 'سنة الصنع يجب أن تكون بعد 1995').max(2030, 'سنة الصنع غير صالحة'),
  color: z.string().trim().min(2, 'يرجى إدخال لون السيارة'),
  category: z.enum(['light', 'medium', 'jeep_7seats']),
  seats: z.number().int().min(2, 'عدد المقاعد لا يقل عن 2').max(15, 'عدد المقاعد لا يتجاوز 15'),
  transmission: z.enum(['automatic', 'manual']),
  fuelType: z.enum(['petrol', 'diesel', 'hybrid', 'electric']),
  dailyPrice: z.number().min(10, 'السعر اليومي يجب ألا يقل عن 10$'),
  plateNumber: z.string().trim().min(3, 'يرجى إدخال رقم اللوحة'),
  currentMileage: z.number().min(0, 'عداد الكيلومترات يجب ألا يكون سالباً'),
  status: z.enum(['available', 'reserved', 'rented', 'maintenance', 'inactive']),
  imageUrl: z.string().trim().refine((val) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
    return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:image/') || lower.startsWith('/');
  }, { message: 'يرجى إدخال رابط صورة صالح وآمن' }),
  images: z.array(z.string()).optional(),
  description: z.string().max(1000).optional().or(z.literal('')),
});

export const customerFormSchema = z.object({
  fullName: z.string().trim().min(3, 'اسم العميل لا يقل عن 3 أحرف'),
  phone: z.string().trim().min(8, 'رقم الهاتف غير صالح'),
  whatsapp: z.string().trim().optional().or(z.literal('')),
  nationalId: z.string().trim().optional().or(z.literal('')),
  drivingLicense: z.string().trim().optional().or(z.literal('')),
  nationality: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
