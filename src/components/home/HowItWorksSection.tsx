import React from 'react';
import { motion } from 'motion/react';
import { Calendar, UserCheck, KeyRound, ShieldCheck, FileCheck2, Truck, Sparkles } from 'lucide-react';
import { getItemVariants } from '../../constants/motion';
import { CollapsibleSection } from '../common/CollapsibleSection';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      icon: <Calendar className="w-5 h-5 text-amber-400" />,
      step: '1',
      title: 'اختر سيارتك وتواريخ الاستلام',
      description: 'تصفح أسطولنا الحديث، حدد تواريخ الاستلام والإرجاع، واختر السيارة التي تلبي تطلعاتك.',
    },
    {
      icon: <UserCheck className="w-5 h-5 text-amber-400" />,
      step: '2',
      title: 'أكمل بيانات الحساب والهوية',
      description: 'سجل دخولك أو أنشئ حساباً بسرعة، وأكمل بيانات ملفك الشخصي للحصول على خصم الأعضاء فوراً.',
    },
    {
      icon: <KeyRound className="w-5 h-5 text-amber-400" />,
      step: '3',
      title: 'استلم سيارتك بدمشق أو جرمانا',
      description: 'تأكيد فوري لطلبك وتواصل معنا لاستلام السيارة في مقرنا بـجرمانا أو عبر خدمة التوصيل للمطار والموقع.',
    },
  ];

  return (
    <motion.section variants={getItemVariants()}>
      <CollapsibleSection
        title="كيف يعمل حجز سيارتك"
        icon={<Sparkles className="w-4 h-4 text-amber-400" />}
        defaultOpen={false}
      >
        <div className="space-y-6 pt-2">
          {/* Compact Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950/40 border border-slate-800/60 rounded-card p-4 relative flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/25 tabular-nums">
                    {item.step}
                  </div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Trust points inside */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-800/60">
            <div className="flex items-center gap-2.5 p-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-sm text-slate-300 font-bold">تأمين نقدي مسترد</div>
            </div>
            <div className="flex items-center gap-2.5 p-2">
              <FileCheck2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-sm text-slate-300 font-bold">عقد رسمي معتمد</div>
            </div>
            <div className="flex items-center gap-2.5 p-2">
              <Truck className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-sm text-slate-300 font-bold">تسليم فوري ومباشر</div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </motion.section>
  );
};
