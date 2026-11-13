/**
 * Utilities for vehicle image gallery management in VehicleFormModal
 * Handles Firebase Storage URL detection, session tracking, deferred deletion,
 * primary image re-assignment, and undo operations.
 */

export interface DeletedImageRecord {
  url: string;
  originalIndex: number;
  wasPrimary: boolean;
  isSessionUpload: boolean;
}

export interface RemoveImageResult {
  updatedImages: string[];
  newPrimaryUrl: string;
  newUploadedThisSession: string[];
  newRemovedStorageUrls: string[];
  immediateStorageDeleteUrls: string[];
  isPrimaryChanged: boolean;
  deletedRecord: DeletedImageRecord;
}

export interface UndoDeleteResult {
  updatedImages: string[];
  newPrimaryUrl: string;
  newRemovedStorageUrls: string[];
  newUploadedThisSession: string[];
}

/**
 * Checks if a URL points to Firebase Cloud Storage (or a vehicles/ storage path)
 * Only Firebase Storage assets should be deleted from cloud storage. External URLs are ignored.
 */
export function isFirebaseStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com') ||
    url.startsWith('vehicles/')
  );
}

/**
 * Calculates new state after removing an image from the gallery
 */
export function removeVehicleImage({
  images,
  primaryUrl,
  indexToRemove,
  uploadedThisSession,
  removedStorageUrls,
}: {
  images: string[];
  primaryUrl: string;
  indexToRemove: number;
  uploadedThisSession: string[];
  removedStorageUrls: string[];
}): RemoveImageResult {
  if (indexToRemove < 0 || indexToRemove >= images.length) {
    throw new Error(`Index ${indexToRemove} out of bounds for images array of length ${images.length}`);
  }

  const targetUrl = images[indexToRemove];
  const isSessionUpload = uploadedThisSession.includes(targetUrl);
  const isStorage = isFirebaseStorageUrl(targetUrl);
  const wasPrimary = targetUrl === primaryUrl;

  const updatedImages = images.filter((_, idx) => idx !== indexToRemove);

  // If removed image was primary, fall back to the first available image
  let newPrimaryUrl = primaryUrl;
  let isPrimaryChanged = false;
  if (wasPrimary) {
    newPrimaryUrl = updatedImages.length > 0 ? updatedImages[0] : '';
    isPrimaryChanged = true;
  }

  // Session uploads are removed from session tracking and queued for immediate deletion
  let newUploadedThisSession = uploadedThisSession;
  const immediateStorageDeleteUrls: string[] = [];

  if (isSessionUpload) {
    newUploadedThisSession = uploadedThisSession.filter((u) => u !== targetUrl);
    if (isStorage) {
      immediateStorageDeleteUrls.push(targetUrl);
    }
  }

  // Original stored images (not uploaded in this session) are added to pending deletion list
  let newRemovedStorageUrls = removedStorageUrls;
  if (!isSessionUpload && isStorage) {
    if (!removedStorageUrls.includes(targetUrl)) {
      newRemovedStorageUrls = [...removedStorageUrls, targetUrl];
    }
  }

  return {
    updatedImages,
    newPrimaryUrl,
    newUploadedThisSession,
    newRemovedStorageUrls,
    immediateStorageDeleteUrls,
    isPrimaryChanged,
    deletedRecord: {
      url: targetUrl,
      originalIndex: indexToRemove,
      wasPrimary,
      isSessionUpload,
    },
  };
}

/**
 * Restores a deleted image back into the gallery (Undo operation)
 */
export function undoRemoveVehicleImage({
  currentImages,
  currentPrimaryUrl,
  deletedRecord,
  removedStorageUrls,
  uploadedThisSession,
}: {
  currentImages: string[];
  currentPrimaryUrl: string;
  deletedRecord: DeletedImageRecord;
  removedStorageUrls: string[];
  uploadedThisSession: string[];
}): UndoDeleteResult {
  const { url, originalIndex, wasPrimary, isSessionUpload } = deletedRecord;

  // Insert back at original index or clamped to current length
  const updatedImages = [...currentImages];
  const insertIndex = Math.min(Math.max(0, originalIndex), updatedImages.length);
  updatedImages.splice(insertIndex, 0, url);

  // Restore primary status if it was primary
  let newPrimaryUrl = currentPrimaryUrl;
  if (wasPrimary) {
    newPrimaryUrl = url;
  } else if (!newPrimaryUrl && updatedImages.length > 0) {
    newPrimaryUrl = updatedImages[0];
  }

  // If restored image was in pending delete list, remove it so it won't be deleted on save
  const newRemovedStorageUrls = removedStorageUrls.filter((u) => u !== url);

  // If it was a session upload, re-add to session list so it is cleaned up on cancel
  let newUploadedThisSession = uploadedThisSession;
  if (isSessionUpload && !uploadedThisSession.includes(url)) {
    newUploadedThisSession = [...uploadedThisSession, url];
  }

  return {
    updatedImages,
    newPrimaryUrl,
    newRemovedStorageUrls,
    newUploadedThisSession,
  };
}

/**
 * Re-adds or ensures an image is excluded from pending storage deletion
 */
export function removeUrlFromPendingStorageDeletions(
  url: string,
  removedStorageUrls: string[]
): string[] {
  return removedStorageUrls.filter((u) => u !== url);
}

/**
 * Calculates state when deleting all images from the gallery
 */
export function removeAllVehicleImages({
  images,
  primaryUrl,
  uploadedThisSession,
  removedStorageUrls,
}: {
  images: string[];
  primaryUrl: string;
  uploadedThisSession: string[];
  removedStorageUrls: string[];
}): {
  updatedImages: string[];
  newPrimaryUrl: string;
  newUploadedThisSession: string[];
  newRemovedStorageUrls: string[];
  immediateStorageDeleteUrls: string[];
  deletedRecords: DeletedImageRecord[];
} {
  const deletedRecords: DeletedImageRecord[] = images.map((url, idx) => ({
    url,
    originalIndex: idx,
    wasPrimary: url === primaryUrl,
    isSessionUpload: uploadedThisSession.includes(url),
  }));

  const immediateStorageDeleteUrls: string[] = [];
  const pendingRemoved: string[] = [...removedStorageUrls];

  images.forEach((url) => {
    const isSession = uploadedThisSession.includes(url);
    const isStorage = isFirebaseStorageUrl(url);
    if (isSession) {
      if (isStorage) {
        immediateStorageDeleteUrls.push(url);
      }
    } else if (isStorage) {
      if (!pendingRemoved.includes(url)) {
        pendingRemoved.push(url);
      }
    }
  });

  return {
    updatedImages: [],
    newPrimaryUrl: '',
    newUploadedThisSession: [],
    newRemovedStorageUrls: pendingRemoved,
    immediateStorageDeleteUrls,
    deletedRecords,
  };
}
