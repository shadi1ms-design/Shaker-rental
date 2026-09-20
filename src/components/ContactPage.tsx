import React, { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, Send, CheckCircle2, ShieldCheck, Award, ThumbsUp } from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsapp';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setSubmitted(true);
  };

  return (
    <div className="py-12 sm:py-16 bg-slate-950 text-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* About Section */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-3">
            عن شركة شاكر
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            شركة شاكر لتأجير السيارات السياحية
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            تأسست شركة شاكر لتكون الوجهة الرائدة في تقديم أرقى خدمات تأجير السيارات في دمشق وريفها. نحرص على تقديم تجربة قيادة آمنة، مريحة، وبأسعار شفافة تناسب الأفراد، العائلات، ورجال الأعمال.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-base">أعلى معايير الأمان والفحص</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              فحص دوري مستمر لجميع أجهزة السلامة، الفرامل، الإطارات، وتبديل زيت المحرك بانتظام كل 5000 كم دون أي تهاون.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-base">أسطول حديث ومتنوع</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              تنوع كامل يلبي كل رغباتك: سيارات اقتصادية، سيدان متوسطة، وجيب عائلي 7 ركاب، بالإضافة لأحدث طرازات الهايبرد 2025.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
              <ThumbsUp className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-base">عقود رسمية وشفافية مطلقة</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              عقود نظامية واضحة تحفظ كامل حقوق المستأجر، مع إمكانية استرداد التأمين فور تسليم السيارة بكل سلاسة ويسر.
            </p>
          </div>
        </div>

        {/* Contact Details & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto pt-6">
          {/* Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">تواصل معنا مباشرة</h3>
              <p className="text-xs text-slate-400">
                فريق خدمة العملاء متواجد على مدار الساعة لخدمتكم والإجابة على كافة الاستفسارات
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">موقع الشركة والمكتب الرئيسي:</span>
                  <span className="text-slate-300">الجمهورية العربية السورية – دمشق – جرمانا، شارع النسيم</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <Phone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">الاتصال المباشر:</span>
                  <a href="tel:00963944331774" className="text-slate-300 hover:text-amber-400 font-mono" dir="ltr">
                    00963 944 331 774
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">الواتساب المباشر:</span>
                  <a
                    href="https://wa.me/963944331774"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 font-bold hover:underline font-mono"
                    dir="ltr"
                  >
                    00963 944 331 774
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">ساعات العمل:</span>
                  <span className="text-slate-300">يومياً من الساعة 9:00 صباحاً حتى 10:00 مساءً (الاستجابة للحالات الطارئة 24/7)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => openWhatsAppChat()}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              <span>محادثة فورية على واتساب الشركة</span>
            </button>
          </div>

          {/* Contact Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-white mb-2">أرسل لنا استفسارك</h3>
            <p className="text-xs text-slate-400 mb-6">
              سوف يقوم أحد موظفي شاكر بالرد عليك خلال دقائق معدودة
            </p>

            {submitted ? (
              <div className="p-8 text-center space-y-3 bg-slate-950 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-base">تم إرسال رسالتك بنجاح!</h4>
                <p className="text-xs text-slate-400">شكراً لتواصلك مع شركة شاكر، سنتواصل معك قريباً.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-2 text-xs text-amber-400 hover:underline"
                >
                  إرسال رسالة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">الاسم الكريم</label>
                  <input
                    type="text"
                    value={name || ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: يوسف العلي"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">رقم الهاتف أو الواتساب</label>
                  <input
                    type="tel"
                    value={phone || ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0944123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">نص الرسالة أو الاستفسار</label>
                  <textarea
                    value={message || ''}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="اكتب استفسارك عن السيارة أو المدة المطلوبة هنا..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال الرسالة</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
