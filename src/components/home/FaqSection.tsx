import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { getItemVariants } from '../../constants/motion';
import { CollapsibleSection } from '../common/CollapsibleSection';

const FAQ_ITEMS = [
  {
    q: 'ما هي الأوراق المطلوبة لاستئجار سيارة في سوريا؟',
    a: 'يلزم توفر إثبات شخصية ساري المفعول للمواطنين والزوار، بالإضافة إلى مبلغ التأمين النقدي المسترد.'
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

/** FAQ accordion of the home page wrapped in CollapsibleSection. */
export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <motion.section variants={getItemVariants()}>
      <CollapsibleSection
        title="الأسئلة الشائعة"
        icon={<HelpCircle className="w-4 h-4 text-amber-400" />}
        defaultOpen={false}
      >
        <div className="space-y-3 pt-2">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            const contentId = `faq-answer-${idx}`;
            return (
              <div
                key={idx}
                className="rounded-card bg-slate-950/60 border border-slate-800/80 overflow-hidden transition-all duration-300"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full min-h-11 p-4 text-start flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
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
                  id={contentId}
                  className={`transition-all duration-300 ease-in-out px-4 overflow-hidden ${
                    isOpen ? 'max-h-96 pb-4 opacity-100' : 'max-h-0 pb-0 opacity-0'
                  }`}
                >
                  <p className="text-sm text-slate-300 leading-relaxed ps-6 border-t border-slate-800/60 pt-3">
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </motion.section>
  );
};
