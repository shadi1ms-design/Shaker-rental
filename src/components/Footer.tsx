import React from 'react';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck, Heart } from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsapp';

interface FooterProps {
  onNavigate: (view: 'home' | 'catalog' | 'about' | 'admin') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand & Bio */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                ش
              </div>
              <div>
                <span className="font-black text-white text-base tracking-tight block">
                  شركة شاكر لتأجير السيارات
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  SHAKER CAR RENTAL • DAMASCUS
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              الخيار الأول في دمشق لتأجير السيارات الحديثة. نلتزم بأعلى معايير الأمان، الصيانة الدورية المنتظمة، الشفافية الكاملة في التسعير، والتأمين المسترد فور تسليم السيارة.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => openWhatsAppChat()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب: 00963944331774</span>
              </button>

              <a
                href="tel:00963944331774"
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                dir="ltr"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>+963 944 331 774</span>
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">روابط سريعة</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-amber-400 transition-colors"
                >
                  الرئيسية
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog')}
                  className="hover:text-amber-400 transition-colors"
                >
                  أسطول السيارات المتوفر
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-amber-400 transition-colors"
                >
                  من نحن وشروط التأجير
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-amber-400/80 hover:text-amber-400 transition-colors flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>بوابة الموظفين والإدارة</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Location and Hours */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">المقر وساعات العمل</h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>الجمهورية العربية السورية – دمشق – جرمانا</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>يومياً: 9:00 صباحاً – 10:00 مساءً</span>
              </div>
              <p className="text-[11px] text-slate-500">
                * خدمة الدعم والمساعدة على الطريق 24 ساعة لجميع سياراتنا المستأجرة.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-10 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} شركة شاكر لتأجير السيارات. جميع الحقوق محفوظة.</p>
          <p className="flex items-center gap-1">
            صمم بأعلى معايير الجودة والفخامة • دمشق، سوريا
          </p>
        </div>
      </div>
    </footer>
  );
};
