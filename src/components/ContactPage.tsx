import React, { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, Send, CheckCircle2, ShieldCheck, Award, ThumbsUp, ExternalLink } from 'lucide-react';
import { getOfficialWhatsAppUrl, openWhatsAppChat } from '../services/whatsapp';
import { COMPANY_INFO } from '../constants/company';
import { PhoneInput } from './ui/PhoneInput';

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [fallbackWhatsappUrl, setFallbackWhatsappUrl] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    const whatsappMessage = `مرحباً شركة شاكر لتأجير السيارات،
أنا: *${name}*
رقم هاتفي: ${phone}

أود الاستفسار بخصوص:
${message}`;

    const url = getOfficialWhatsAppUrl(whatsappMessage);
    setFallbackWhatsappUrl(url);
    openWhatsAppChat(undefined, whatsappMessage);
    setSubmitted(true);
  };

  return (
    <div className="py-12 sm:py-16 bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* About Section */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-3">
            عن {COMPANY_INFO.name}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {COMPANY_INFO.name} السياحية
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {COMPANY_INFO.aboutDescription} تأسست لتقديم أرقى خدمات تأجير السيارات في دمشق وريفها، ونحرص على توفير تجربة قيادة آمنة ومريحة وبأسعار شفافة.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-card p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">أعلى معايير الأمان والفحص</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              فحص دوري مستمر لجميع أجهزة السلامة، الفرامل، الإطارات، وتبديل زيت المحرك بانتظام دون أي تهاون.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-card p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">أسطول حديث ومتنوع</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              تنوع كامل يلبي كل رغباتك: سيدان (اقتصادي)، سيدان، وSUV عائلية، بالإضافة لأحدث طرازات 2025.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-card p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
              <ThumbsUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">عقود رسمية وشفافية مطلقة</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              عقود نظامية واضحة تحفظ كامل حقوق المستأجر، مع إمكانية استرداد التأمين فور تسليم السيارة بكل سلاسة.
            </p>
          </div>
        </div>

        {/* Contact Details & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto pt-6">
          {/* Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-modal p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">تواصل معنا مباشرة</h3>
              <p className="text-sm text-slate-300">
                فريق خدمة العملاء متواجد لخدمتكم والإجابة على كافة الاستفسارات
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-card border border-slate-800">
                <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">موقع الشركة والمكتب الرئيسي:</span>
                  <span className="text-slate-300">{COMPANY_INFO.fullAddress}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-card border border-slate-800">
                <Phone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">الاتصال المباشر:</span>
                  <a href={`tel:${COMPANY_INFO.phoneRaw}`} className="min-h-11 inline-flex items-center text-slate-200 hover:text-amber-400 tabular-nums" dir="ltr">
                    {COMPANY_INFO.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-card border border-slate-800">
                <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">الواتساب المباشر:</span>
                  <button
                    type="button"
                    onClick={() => openWhatsAppChat()}
                    className="min-h-11 inline-flex items-center text-emerald-400 font-bold hover:underline tabular-nums cursor-pointer"
                    dir="ltr"
                  >
                    {COMPANY_INFO.whatsapp}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-card border border-slate-800">
                <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">ساعات العمل:</span>
                  <span className="text-slate-300">{COMPANY_INFO.workingHours} ({COMPANY_INFO.emergencyHours})</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openWhatsAppChat()}
              className="w-full min-h-11 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              <span>محادثة فورية على واتساب الشركة</span>
            </button>
          </div>

          {/* Contact Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-modal p-6 sm:p-8">
            <h3 className="text-xl font-bold text-white mb-2">أرسل لنا استفسارك</h3>
            <p className="text-sm text-slate-300 mb-6">
              سوف يقوم أحد موظفي شاكر بالرد عليك في أقرب وقت ممكن
            </p>

            {submitted ? (
              <div className="p-6 sm:p-8 text-center space-y-4 bg-slate-950 rounded-card border border-slate-800">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-base">تم تجهيز رسالتك — أكمل الإرسال من واتساب</h4>
                <p className="text-sm text-slate-300">
                  تم إعداد نص الاستفسار وفتح محادثة واتساب. إذا لم تفتح نافذة واتساب تلقائياً، يمكنك فتحها يدوياً من الزر أدناه.
                </p>
                {fallbackWhatsappUrl && (
                  <a
                    href={fallbackWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-11 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>فتح محادثة واتساب يدوياً</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="min-h-11 px-4 text-sm text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    إرسال رسالة أخرى
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div>
                  <label htmlFor="contact-name" className="block text-sm text-slate-200 mb-1.5 font-semibold cursor-pointer">الاسم الكريم</label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name || ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: يوسف العلي"
                    className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-sm text-slate-200 mb-1.5 font-semibold cursor-pointer">رقم الهاتف أو الواتساب</label>
                  <PhoneInput
                    id="contact-phone"
                    name="phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="9441234567"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm text-slate-200 mb-1.5 font-semibold cursor-pointer">نص الرسالة أو الاستفسار</label>
                  <textarea
                    id="contact-message"
                    value={message || ''}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="اكتب استفسارك عن السيارة أو المدة المطلوبة هنا..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-11 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال عبر واتساب</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
