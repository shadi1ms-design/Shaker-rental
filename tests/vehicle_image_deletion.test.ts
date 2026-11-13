import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  isFirebaseStorageUrl,
  removeVehicleImage,
  undoRemoveVehicleImage,
  removeAllVehicleImages,
  removeUrlFromPendingStorageDeletions,
} from '../src/utils/vehicleImageManagement';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Vehicle Image Deletion & Gallery Management Suite', () => {
  const storageUrl1 = 'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/vehicles%2Fv1%2Fimg1.jpg?alt=media';
  const storageUrl2 = 'https://storage.googleapis.com/project.appspot.com/vehicles/v1/img2.jpg';
  const relativeStorageUrl = 'vehicles/veh-123/images/img3.webp';
  const externalUrl = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70';

  // 1) حذف صورة Storage يضيفها لقائمة الحذف المعلّق ولا يحذفها فوراً
  it('حذف صورة Storage يضيفها لقائمة الحذف المعلّق ولا يحذفها فوراً (deferred delete on save)', () => {
    const images = [storageUrl1, storageUrl2];
    const res = removeVehicleImage({
      images,
      primaryUrl: storageUrl1,
      indexToRemove: 1, // storageUrl2
      uploadedThisSession: [], // not uploaded in this session => original saved photo
      removedStorageUrls: [],
    });

    expect(res.updatedImages).toEqual([storageUrl1]);
    expect(res.newRemovedStorageUrls).toContain(storageUrl2);
    // Crucial: Must NOT delete immediately
    expect(res.immediateStorageDeleteUrls).toHaveLength(0);
  });

  // 2) حذف الرئيسية يرجع لأول صورة
  it('حذف الصورة الرئيسية يجعل images[0] تلقائياً هي الصورة الرئيسية الجديدة', () => {
    const images = [storageUrl1, storageUrl2, relativeStorageUrl];
    const res = removeVehicleImage({
      images,
      primaryUrl: storageUrl1,
      indexToRemove: 0,
      uploadedThisSession: [],
      removedStorageUrls: [],
    });

    expect(res.updatedImages).toEqual([storageUrl2, relativeStorageUrl]);
    expect(res.newPrimaryUrl).toBe(storageUrl2);
    expect(res.isPrimaryChanged).toBe(true);
  });

  // 3) الحذف ثم التراجع
  it('الحذف ثم التراجع يعيد الصورة لموضعها الأصلي ويزيلها من قائمة الحذف المعلّق', () => {
    const images = [storageUrl1, storageUrl2, relativeStorageUrl];
    // Remove middle image
    const removeRes = removeVehicleImage({
      images,
      primaryUrl: storageUrl1,
      indexToRemove: 1, // storageUrl2
      uploadedThisSession: [],
      removedStorageUrls: [],
    });

    expect(removeRes.updatedImages).toEqual([storageUrl1, relativeStorageUrl]);
    expect(removeRes.newRemovedStorageUrls).toContain(storageUrl2);

    // Now Undo
    const undoRes = undoRemoveVehicleImage({
      currentImages: removeRes.updatedImages,
      currentPrimaryUrl: removeRes.newPrimaryUrl,
      deletedRecord: removeRes.deletedRecord,
      removedStorageUrls: removeRes.newRemovedStorageUrls,
      uploadedThisSession: removeRes.newUploadedThisSession,
    });

    expect(undoRes.updatedImages).toEqual([storageUrl1, storageUrl2, relativeStorageUrl]);
    // Must be removed from pending storage deletions!
    expect(undoRes.newRemovedStorageUrls).not.toContain(storageUrl2);
  });

  // 4) الإلغاء لا يحذف الأصلية
  it('الإلغاء لا يحذف الصور الأصلية المخزنة سابقاً', () => {
    const modalCode = read('src/components/VehicleFormModal.tsx');
    // Ensure handleCancelClose cleans up only uploadedThisSessionRef and never removedStorageImageUrls
    expect(modalCode).toMatch(/handleCancelClose/);
    expect(modalCode).not.toMatch(/handleCancelClose[\s\S]*?removedStorageImageUrls\.map/);
  });

  // 5) حذف صورة رُفعت في الجلسة يحذفها فوراً
  it('حذف صورة رُفعت في الجلسة يضعها في الحذف الفوري ويزيلها من الجلسة ولا يضيفها لقائمة الحذف المعلّق', () => {
    const sessionUrl = 'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/vehicles%2Ftemp%2Fsession_upload.jpg';
    const images = [storageUrl1, sessionUrl];

    const res = removeVehicleImage({
      images,
      primaryUrl: storageUrl1,
      indexToRemove: 1,
      uploadedThisSession: [sessionUrl], // Uploaded this session
      removedStorageUrls: [],
    });

    expect(res.updatedImages).toEqual([storageUrl1]);
    expect(res.immediateStorageDeleteUrls).toContain(sessionUrl);
    expect(res.newUploadedThisSession).not.toContain(sessionUrl);
    expect(res.newRemovedStorageUrls).not.toContain(sessionUrl);
  });

  // 6) الرابط الخارجي لا يُحذف من Storage
  it('الرابط الخارجي يُزال من القائمة فقط ولا يُضاف للحذف الفوري ولا المعلق', () => {
    const images = [storageUrl1, externalUrl];

    const res = removeVehicleImage({
      images,
      primaryUrl: storageUrl1,
      indexToRemove: 1, // externalUrl
      uploadedThisSession: [],
      removedStorageUrls: [],
    });

    expect(res.updatedImages).toEqual([storageUrl1]);
    expect(res.immediateStorageDeleteUrls).toHaveLength(0);
    expect(res.newRemovedStorageUrls).not.toContain(externalUrl);
    expect(isFirebaseStorageUrl(externalUrl)).toBe(false);
  });

  // 7) إعادة إضافة رابط صورة محذوفة يدوياً يزيلها من الحذف المعلّق
  it('إعادة إضافة رابط صورة محذوفة يدوياً يزيلها من removedStorageImageUrls', () => {
    const removedUrls = [storageUrl1, storageUrl2];
    const afterReAdd = removeUrlFromPendingStorageDeletions(storageUrl1, removedUrls);
    expect(afterReAdd).toEqual([storageUrl2]);
  });

  // 8) حذف كافة الصور و التراجع عنها
  it('حذف كافة الصور يفرغ القائمة ويفصل بين صور الجلسة والصور الأصلية مع دعم التراجع', () => {
    const sessionUrl = 'https://firebasestorage.googleapis.com/v0/b/app/o/vehicles%2Fsession.jpg';
    const images = [storageUrl1, sessionUrl];

    const res = removeAllVehicleImages({
      images,
      primaryUrl: storageUrl1,
      uploadedThisSession: [sessionUrl],
      removedStorageUrls: [],
    });

    expect(res.updatedImages).toHaveLength(0);
    expect(res.immediateStorageDeleteUrls).toEqual([sessionUrl]);
    expect(res.newRemovedStorageUrls).toEqual([storageUrl1]);
    expect(res.deletedRecords).toHaveLength(2);
  });

  // 9) اختبار زر الحذف في المعرض: لا يحمل opacity-0 بدون بديل لمس، وظاهر دائماً
  it('زر الحذف في المعرض لا يعتمد على hover ولا يحمل opacity-0 ويحجم لا يقل عن 40x40', () => {
    const modalCode = read('src/components/VehicleFormModal.tsx');

    // Make sure opacity-0 group-hover:opacity-100 overlay was removed from the gallery
    expect(modalCode).not.toContain('opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between');

    // Make sure delete button is visible with min-h-10 min-w-10 (40px)
    expect(modalCode).toContain('delete-img-btn-');
    expect(modalCode).toContain('min-h-10 min-w-10');
    expect(modalCode).toContain('bg-rose-600');
    expect(modalCode).toContain('absolute top-2 start-2');

    // Make sure delete button has aria-label with image number
    expect(modalCode).toMatch(/aria-label=\{`حذف الصورة \$\{idx \+ 1\}`\}/);

    // Make sure primary button is visible without hover dependency
    expect(modalCode).toContain('تعيين كرئيسية');
    expect(modalCode).toMatch(/aria-label=\{`تعيين الصورة \$\{idx \+ 1\} كرئيسية`\}/);

    // Make sure inline confirmation or confirm modal is present
    expect(modalCode).toContain('تأكيد الحذف؟');
    expect(modalCode).toContain('حذف كل الصور');
  });
});
