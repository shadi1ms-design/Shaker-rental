import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { getItemVariants } from '../../constants/motion';

const FAQ_ITEMS = [
  {
    q: 'ما هي الأوراق المطلوبة لاستئجار سيارة في سوريا؟',
    a: 'يلزم توفر الهوية الشخصية (أو جواز السفر الساري للمغتربين والزوار)، ورخصة قيادة سارية المفعول، بالإضافة إلى مبلغ التأمين النقدي المسترد.'
  },
  {
    q: 'كيف يمكنني الاستفادة من خصومات التأجير؟',
    a: 'بمجرد تسجيل الدخول بحسابك في موقعنا، يتم تطبيق خصم الأعضاء الحصري تلقائياً على قيمة الحجز لجميع السيارات المشمولة بالعرض بنسبة الخصم المعتمدة.'
  },
  {
    q: 'هل يتوفر استلام وتسليم في مطار دمشق الدولي أو مواقع أخرى؟',
    a: 'نعم، نوفر خدمة تسليم واستلام السيارات في مطار دمشق الدولي، بالإضافة إلى تسليم السيارة مباشرة في موقعك أو فندقك في دمشق وريفها بالتنسيق المسبق.'
  },
  {
    q: 'ما هي شروط وسياسة الكيلومترات والوقود؟',
    a: 'يتم تسليم السيارة بحالة وقود محددة ونظيفة، ويُطلب إعادتها بنفس المستوى، مع عداد كيلومترات يومي رحب ومناسب لجميع تنقلاتك داخل وخارج المدينة.'
  }
];

/** FAQ accordion of the home page. */
export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <motion.section variants={getItemVariants()} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div className="text-center mb-10">
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-3">
          الأسئلة الشائعة
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          كل ما تود معرفته عن استئجار سيارة
        </h2>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-5 text-right flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors cursor-pointer"
                aria-expanded={isOpen}
              >
                <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{item.q}</span>
                </h3>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </button>

              <div
                className={`transition-all duration-300 ease-in-out px-5 overflow-hidden ${
                  isOpen ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 pb-0 opacity-0'
                }`}
              >
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pr-6 border-t border-slate-800/60 pt-3">
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
};
