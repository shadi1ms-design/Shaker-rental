/**
 * Global company constants for Shaker Car Rental.
 * Centralizing these values ensures consistency across the website, footer, and contact pages.
 */

export const COMPANY_INFO = {
  name: 'شركة شاكر لتأجير السيارات',
  nameEn: 'SHAKER CAR RENTAL',
  location: 'دمشق – جرمانا، شارع النسيم',
  fullAddress: 'الجمهورية العربية السورية – دمشق – جرمانا، شارع النسيم',
  city: 'دمشق',
  neighborhood: 'جرمانا',
  
  // Contacts
  phone: '+963 944 331 774',
  phoneRaw: '00963944331774',
  whatsapp: '00963944331774',
  
  // Working Hours
  workingHours: 'يومياً: 9:00 ص – 10:00 م',
  emergencyHours: 'طوارئ 24/7',
  
  // Labels
  aboutTitle: 'من نحن وشروط التأجير',
  aboutDescription: 'الخيار الأول في دمشق لتأجير السيارات الحديثة. نلتزم بأعلى معايير الأمان، الصيانة الدورية المنتظمة، الشفافية الكاملة في التسعير، والتأمين المسترد فور تسليم السيارة.',
} as const;

export const STARTING_DAILY_PRICE = 30;

// Mandatory email verification for customer accounts created on/after 2026-09-19
export const EMAIL_VERIFICATION_CUTOFF_DATE = new Date('2026-09-19T00:00:00.000Z').getTime();
