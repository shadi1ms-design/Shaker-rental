import React from 'react';
import { Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsapp';
import { COMPANY_INFO } from '../constants/company';
import { Link } from './routing/Link';
import { routes } from '../router';

interface FooterProps {
  variant?: 'full' | 'mini';
}

export const Footer: React.FC<FooterProps> = ({ variant = 'full' }) => {
  if (variant === 'mini') {
    return (
      <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-300 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div>
                <span className="font-extrabold text-white text-base block">
                  {COMPANY_INFO.name}
                </span>
                <span className="text-sm text-amber-400">{COMPANY_INFO.location}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{COMPANY_INFO.workingHours.replace(': 9:00 صباحاً – 10:00 مساءً', ': 9 ص – 10 م')}</span>
              </div>
              <button
                type="button"
                onClick={() => openWhatsAppChat()}
                className="min-h-11 px-2 flex items-center gap-1.5 text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب</span>
              </button>
              <a
                href={`tel:${COMPANY_INFO.phoneRaw}`}
                className="min-h-11 px-2 flex items-center gap-1.5 text-slate-200 hover:text-amber-400 font-semibold tabular-nums"
                dir="ltr"
              >
                <Phone className="w-4 h-4 text-amber-400" />
                <span>{COMPANY_INFO.phone}</span>
              </a>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-900 text-center text-slate-400 text-sm">
            <p>© {new Date().getFullYear()} {COMPANY_INFO.name}. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-300 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Col 1: Brand info & contact */}
          <div className="space-y-4">
            <div>
              <span className="font-extrabold text-white text-base block">
                {COMPANY_INFO.name}
              </span>
              <span className="text-xs text-amber-400 tabular-nums">
                {COMPANY_INFO.nameEn} • {COMPANY_INFO.city.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => openWhatsAppChat()}
                className="min-h-11 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب</span>
              </button>

              <a
                href={`tel:${COMPANY_INFO.phoneRaw}`}
                className="min-h-11 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-sm flex items-center gap-1.5 transition-colors tabular-nums"
                dir="ltr"
              >
                <Phone className="w-4 h-4 text-amber-400" />
                <span>{COMPANY_INFO.phone}</span>
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h3 className="font-bold text-white text-base">روابط سريعة</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  to={routes.home}
                  className="min-h-11 inline-flex items-center hover:text-amber-400 transition-colors cursor-pointer"
                >
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link
                  to={routes.cars}
                  prefetch
                  className="min-h-11 inline-flex items-center hover:text-amber-400 transition-colors cursor-pointer"
                >
                  أسطول السيارات المتوفر
                </Link>
              </li>
              <li>
                <Link
                  to={routes.contact}
                  className="min-h-11 inline-flex items-center hover:text-amber-400 transition-colors cursor-pointer"
                >
                  تواصل معنا
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Location and Hours */}
          <div className="space-y-3">
            <h3 className="font-bold text-white text-base">المقر وساعات العمل</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{COMPANY_INFO.fullAddress}</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{COMPANY_INFO.workingHours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-10 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <p>© {new Date().getFullYear()} {COMPANY_INFO.name}. جميع الحقوق محفوظة.</p>
          <p className="flex items-center gap-1">
            صمم بأعلى معايير الجودة والفخامة • {COMPANY_INFO.city}، سوريا
          </p>
        </div>
      </div>
    </footer>
  );
};
