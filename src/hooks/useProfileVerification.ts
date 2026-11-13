import { useState, useEffect } from 'react';
import { DocQualityMetric, IdentityDocChoice, VerificationRequest } from '../types';
import { dataService } from '../services/dataService';
import { functionsService } from '../services/functionsService';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

export interface UseProfileVerificationParams {
  isOpen: boolean;
  enabled: boolean;
  userId?: string;
}

export function useProfileVerification({
  isOpen,
  enabled,
  userId,
}: UseProfileVerificationParams) {
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [identityChoice, setIdentityChoice] = useState<IdentityDocChoice>('national_id');
  const [capturedDocs, setCapturedDocs] = useState<{
    driver_license?: { file: File; quality: DocQualityMetric; uploaded: boolean };
    identity?: { file: File; quality: DocQualityMetric; uploaded: boolean };
  }>({});
  const [activeCameraSlot, setActiveCameraSlot] = useState<'driver_license' | 'identity' | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccessNotice, setVerificationSuccessNotice] = useState<string | null>(null);
  const [isRestartingVerification, setIsRestartingVerification] = useState(false);

  // Real-time subscription to verificationRequest (only when enabled: customer role only)
  useEffect(() => {
    if (!isOpen || !enabled || !userId) return;
    const unsubscribe = dataService.subscribeToVerificationRequest(userId, (req) => {
      setVerificationRequest(req);
      setVerificationLoaded(true);
      if (req?.identityDocType) {
        setIdentityChoice(req.identityDocType);
      }
    });
    return () => {
      unsubscribe();
      setVerificationRequest(null);
      setVerificationLoaded(false);
    };
  }, [isOpen, enabled, userId]);

  const handleSlotCapture = async (file: File, quality: DocQualityMetric) => {
    const slot = activeCameraSlot;
    if (!userId || !slot) return;

    setIsUploadingDoc(true);
    setVerificationError(null);
    setVerificationSuccessNotice(null);

    try {
      const sessionRes = await functionsService.initiateVerificationSession();
      if (!sessionRes.success || !sessionRes.data) {
        throw new Error(sessionRes.error || 'تعذر بدء جلسة تصوير آمنة، يرجى المحاولة ثانية.');
      }
      const { sessionId, nonce } = sessionRes.data;

      const base64Data = await fileToBase64(file);

      const submitDocRes = await functionsService.submitVerificationDocument({
        sessionId,
        nonce,
        docKey: slot,
        base64Data,
        mimeType: 'image/jpeg',
        clientQuality: {
          width: quality.width,
          height: quality.height,
          blurScore: quality.blurScore,
          brightness: quality.brightness ?? 128,
        },
      });

      if (!submitDocRes.success) {
        throw new Error(submitDocRes.error || 'فشل فحص الوثيقة أو لم تطابق معايير الأمان.');
      }

      setCapturedDocs((prev) => ({
        ...prev,
        [slot]: { file, quality, uploaded: true },
      }));

      setVerificationSuccessNotice(
        slot === 'driver_license'
          ? 'تم التقاط وفحص وثيقة القيادة بنجاح.'
          : 'تم التقاط وفحص وثيقة إثبات الشخصية بنجاح.'
      );
    } catch (err: unknown) {
      console.error('Error submitting verification document:', err);
      setVerificationError(err instanceof Error ? err.message : 'تعذر رفع الوثيقة، يرجى إعادة المحاولة.');
    } finally {
      setIsUploadingDoc(false);
      setActiveCameraSlot(null);
    }
  };

  const handleFinalSubmit = async () => {
    if (!userId) return;
    setIsSubmittingRequest(true);
    setVerificationError(null);
    setVerificationSuccessNotice(null);

    try {
      const res = await functionsService.submitVerificationRequest({
        identityDocType: identityChoice,
      });

      if (!res.success) {
        throw new Error(res.error || 'تعذر إرسال طلب التوثيق للمراجعة.');
      }

      setIsRestartingVerification(false);
      setVerificationSuccessNotice('تم إرسال طلب التوثيق بنجاح، وهو الآن قيد التدقيق الإداري من قبل فريق العمل.');
    } catch (err: unknown) {
      console.error('Submit verification request error:', err);
      setVerificationError(err instanceof Error ? err.message : 'تعذر إرسال طلب التوثيق.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleRestartVerification = () => {
    setIsRestartingVerification(true);
    setCapturedDocs({});
    setVerificationError(null);
    setVerificationSuccessNotice(null);
  };

  return {
    verificationRequest,
    verificationLoaded,
    identityChoice,
    setIdentityChoice,
    capturedDocs,
    activeCameraSlot,
    setActiveCameraSlot,
    isUploadingDoc,
    isSubmittingRequest,
    verificationError,
    verificationSuccessNotice,
    isRestartingVerification,
    handleSlotCapture,
    handleFinalSubmit,
    handleRestartVerification,
  };
}
