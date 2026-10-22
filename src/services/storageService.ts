import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../firebase/config';
import { getArabicErrorMessage } from '../utils/firebaseErrorHandler';
import { validateUploadedFile } from '../utils/security';

export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Utility to convert file to base64 DataURL (used as resilient fallback)
 */
export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Sanitize filename to avoid problematic characters in Firebase Storage paths
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Compresses an image file before upload using browser Canvas API
 * Resizes down large dimensions to max 1600px and optimizes quality to ~0.85
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // If already small (< 700KB), return as-is
  if (file.size < 700 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
          } else {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

/**
 * Firebase Storage Service for Shaker Car Rental
 */
export const storageService = {
  /**
   * Checks if Firebase Storage is connected and available
   */
  isAvailable(): boolean {
    return Boolean(isFirebaseConfigured && storage);
  },

  /**
   * Uploads an arbitrary file or blob to Firebase Storage with progress tracking
   */
  async uploadFile({
    file,
    storagePath,
    onProgress,
  }: {
    file: File | Blob;
    storagePath: string;
    onProgress?: (progressPercent: number) => void;
  }): Promise<{ downloadUrl: string; storagePath: string }> {
    // 1. Explicit Local / Demo Mode Fallback (ONLY when Firebase is completely unconfigured)
    if (!this.isAvailable() || !storage) {
      console.warn('Firebase Storage is not initialized, using local DataURL payload (Demo/Development mode).');
      const dataUrl = await readFileAsDataURL(file);
      onProgress?.(100);
      return { downloadUrl: dataUrl, storagePath };
    }

    // 2. Connected Firebase Storage Mode - Strictly enforce Cloud storage and fail fast on errors
    try {
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: (file as File).type || 'application/octet-stream',
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      return await new Promise<{ downloadUrl: string; storagePath: string }>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              onProgress?.(progress);
            }
          },
          (error) => {
            console.error('Firebase Storage upload error during transfer:', error);
            const userFriendlyMessage = getArabicErrorMessage(error) || 'فشل رفع الملف إلى الخادم السحابي. يرجى المحاولة مجدداً أو التواصل مع الدعم الفني إن استمرت المشكلة.';
            reject(new Error(userFriendlyMessage));
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              onProgress?.(100);
              resolve({
                downloadUrl,
                storagePath: uploadTask.snapshot.ref.fullPath,
              });
            } catch (urlErr) {
              console.error('Failed to get download URL from Firebase Storage snapshot:', urlErr);
              reject(new Error('فشل استخراج رابط تحميل الملف من الخادم السحابي. يرجى المحاولة مجدداً أو التواصل مع الدعم الفني إن استمرت المشكلة.'));
            }
          }
        );
      });
    } catch (err: any) {
      console.error('Firebase Storage upload error:', err);
      throw new Error(
        err?.message || 'فشل رفع الملف إلى الخادم السحابي. يرجى المحاولة مجدداً أو التواصل مع الدعم الفني إن استمرت المشكلة.'
      );
    }
  },

  /**
   * Uploads a customer identification document (driving license, ID, passport)
   */
  async uploadUserDocument(
    file: File,
    userId: string,
    category: string,
    onProgress?: (percent: number) => void
  ): Promise<StorageUploadResult> {
    // Validate file security (forbidden extensions, traversal, size)
    const validation = validateUploadedFile(file.name, file.size, file.type, 'document');
    if (!validation.valid) {
      throw new Error(validation.error || 'الملف غير صالح للرفع.');
    }

    const cleanName = sanitizeFileName(file.name);
    const timestamp = Date.now();
    const storagePath = `users/${userId}/documents/${timestamp}_${cleanName}`;

    const { downloadUrl, storagePath: finalPath } = await this.uploadFile({
      file,
      storagePath,
      onProgress,
    });

    return {
      downloadUrl,
      storagePath: finalPath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
    };
  },

  /**
   * Uploads a contract attachment (legal documents, scanned forms)
   */
  async uploadContractAttachment(
    file: File,
    contractId: string,
    onProgress?: (percent: number) => void
  ): Promise<StorageUploadResult> {
    const validation = validateUploadedFile(file.name, file.size, file.type, 'document');
    if (!validation.valid) {
      throw new Error(validation.error || 'الملف غير صالح للرفع.');
    }

    const cleanName = sanitizeFileName(file.name);
    const timestamp = Date.now();
    const storagePath = `contracts/${contractId}/attachments/${timestamp}_${cleanName}`;

    const { downloadUrl, storagePath: finalPath } = await this.uploadFile({
      file,
      storagePath,
      onProgress,
    });

    return {
      downloadUrl,
      storagePath: finalPath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
    };
  },

  /**
   * Uploads a vehicle handover inspection video
   */
  async uploadContractVideo(
    file: File,
    contractId: string,
    onProgress?: (percent: number) => void
  ): Promise<StorageUploadResult> {
    const validation = validateUploadedFile(file.name, file.size, file.type, 'video');
    if (!validation.valid) {
      throw new Error(validation.error || 'مقطع الفيديو غير صالح للرفع.');
    }

    const cleanName = sanitizeFileName(file.name);
    const timestamp = Date.now();
    const storagePath = `contracts/${contractId}/videos/${timestamp}_${cleanName}`;

    const { downloadUrl, storagePath: finalPath } = await this.uploadFile({
      file,
      storagePath,
      onProgress,
    });

    return {
      downloadUrl,
      storagePath: finalPath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'video/mp4',
    };
  },

  /**
   * Uploads a vehicle image (primary photo or gallery) to Firebase Storage
   * Resizes large images automatically for optimal speed and reliability
   */
  async uploadVehicleImage(
    file: File,
    vehicleId?: string,
    onProgress?: (percent: number) => void
  ): Promise<StorageUploadResult> {
    const validation = validateUploadedFile(file.name, file.size, file.type, 'document');
    if (!validation.valid) {
      throw new Error(validation.error || 'ملف الصورة غير صالح للرفع.');
    }

    // Auto-compress and scale to web-optimized dimensions
    const processedFile = await compressImageFile(file);

    const cleanName = sanitizeFileName(processedFile.name);
    const timestamp = Date.now();
    const vId = vehicleId ? sanitizeFileName(vehicleId) : 'fleet';
    const storagePath = `vehicles/${vId}/images/${timestamp}_${cleanName}`;

    const { downloadUrl, storagePath: finalPath } = await this.uploadFile({
      file: processedFile,
      storagePath,
      onProgress,
    });

    return {
      downloadUrl,
      storagePath: finalPath,
      fileName: processedFile.name,
      fileSize: processedFile.size,
      fileType: processedFile.type || 'image/jpeg',
    };
  },

  /**
   * Generates a fresh download URL on demand from a storagePath
   */
  async getFileDownloadUrl(storagePath: string): Promise<string> {
    if (!storagePath) return '';
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('data:')) {
      return storagePath;
    }
    if (!this.isAvailable() || !storage) return '';
    try {
      const fileRef = ref(storage, storagePath);
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error('Error fetching download URL for path:', storagePath, err);
      return '';
    }
  },

  /**
   * Deletes a file from Firebase Storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    if (!this.isAvailable() || !storage) return;

    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
    } catch (err) {
      console.warn('Could not delete file from Firebase Storage:', err);
    }
  },
};
