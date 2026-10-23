import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { analyzeCanvasQuality } from '../utils/imageQuality';
import { DocQualityMetric } from '../types';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the captured JPEG file and its validated quality metric */
  onCapture: (file: File, quality: DocQualityMetric) => void;
  title?: string;
  docLabel?: string;
}

/**
 * CameraCapture:
 * Hardware camera-only document scanner (getUserMedia).
 * - Enforces in-browser canvas JPEG capture (no file picker fallback).
 * - Visual Card Guide frame overlay (aspect ratio 1.58:1).
 * - Live/post-capture Laplacian blur, luminance, and resolution checks.
 * - Arabic checklist of compliance rules.
 */
export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
  title,
  docLabel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{
    blob: Blob;
    url: string;
    quality: DocQualityMetric;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  };

  const startStream = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('المتصفح لا يدعم الوصول المباشر إلى الكاميرا، أو أن الاتصال غير آمن (يلزم HTTPS).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('تم رفض إذن الكاميرا. يرجى السماح للتطبيق باستخدام الكاميرا من إعدادات المتصفح ثم أعد المحاولة.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('لم يتم العثور على كاميرا تدعم الدقة المطلوبة (1280×720 على الأقل).');
      } else {
        setError('تعذر تشغيل الكاميرا. يرجى إغلاق أي تطبيقات أخرى تستخدم الكاميرا والمحاولة مجدداً.');
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setPreview(null);
    startStream();
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  if (!isOpen) return null;

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      // Ensure high capture resolution up to 1920
      const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('تعذر معالجة إطار الكاميرا.');
        setIsProcessing(false);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Analyze image quality (Laplacian variance, brightness, resolution)
      const quality = analyzeCanvasQuality(canvas);

      canvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (!blob) {
            setError('تعذر حفظ الصورة، يرجى إعادة المحاولة.');
            return;
          }
          setPreview({
            blob,
            url: URL.createObjectURL(blob),
            quality,
          });
          stopStream();
        },
        'image/jpeg',
        0.9
      );
    } catch (err) {
      setIsProcessing(false);
      setError('حدث خطأ أثناء التقاط الصورة.');
      console.error(err);
    }
  };

  const retake = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
    startStream();
  };

  const confirm = () => {
    if (!preview) return;
    if (!preview.quality.passed) {
      setError(preview.quality.message || 'الصورة لا تلبي معايير الجودة المطلوبة.');
      return;
    }

    const file = new File([preview.blob], `doc_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file, preview.quality);
    stopStream();
    onClose();
  };

  const close = () => {
    stopStream();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'التقاط صورة الوثيقة'}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {title || 'التقاط صورة الوثيقة'}
              </h3>
              {docLabel && <p className="text-[11px] text-amber-400 font-medium">{docLabel}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Live Stream Area */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview.url} alt="معاينة الوثيقة" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Card Guide Overlay Frame (Aspect ratio 1.58:1) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-md aspect-[1.58/1] border-2 border-dashed border-amber-400/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Corner accents */}
                  <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-md" />
                  <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-md" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-md" />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-md" />

                  <div className="absolute top-2 inset-x-0 flex items-center justify-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-black/70 text-[10px] text-amber-300 font-semibold backdrop-blur-sm border border-amber-500/30">
                      ضع البطاقة بالكامل داخل هذا الإطار
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {!preview && !ready && !error && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <span className="text-xs text-slate-300">جاري فتح الكاميرا وتجهيز العدسة...</span>
            </div>
          )}
        </div>

        {/* Quality feedback & alerts */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 space-y-2">
          {preview ? (
            preview.quality.passed ? (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <div className="font-bold">جودة الصورة ممتازة ومعتمدة</div>
                  <div className="text-[11px] text-emerald-400/80">
                    الدقة: {preview.quality.width}×{preview.quality.height} • حدة المعالم: {preview.quality.blurScore}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1">
                  <div className="font-bold">الصورة غير مقبولة: يرجى إعادة التصوير</div>
                  <div className="text-[11px] text-rose-300/90 mt-0.5">{preview.quality.message}</div>
                </div>
              </div>
            )
          ) : (
            /* Checklist of Rules before capture */
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1 text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                شروط قبول وثائق التوثيق:
              </div>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-400 list-disc list-inside">
                <li>الوثيقة كاملة داخل الإطار</li>
                <li>تجنب لمعان وانعكاس الفلاش</li>
                <li>جميع البيانات واضحة ومقروءة</li>
                <li>الوثيقة الأصلية (ليست صورة شاشة)</li>
              </ul>
            </div>
          )}

          {error && (
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-3">
          {preview ? (
            <>
              <button
                type="button"
                onClick={retake}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" /> إعادة الالتقاط
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!preview.quality.passed}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center gap-2 hover:bg-amber-400 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
              >
                <Check className="w-4 h-4" /> اعتماد الوثيقة
              </button>
            </>
          ) : error ? (
            <button
              type="button"
              onClick={startStream}
              className="w-full px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> إعادة تشغيل الكاميرا
            </button>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={takePhoto}
                disabled={!ready || isProcessing}
                className="px-8 py-3 rounded-2xl bg-amber-500 text-slate-950 text-sm font-black flex items-center gap-2 hover:bg-amber-400 transition disabled:opacity-50 shadow-lg shadow-amber-500/25 active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الفحص...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    التقاط الصورة
                  </>
                )}
              </button>
              <div className="w-12" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
