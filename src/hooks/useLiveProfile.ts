import React, { useState, useEffect } from 'react';
import { FirestoreUser } from '../types';
import { dataService } from '../services/dataService';

export interface UseLiveProfileParams {
  isOpen: boolean;
  user: {
    uid: string;
    address?: string;
  } | null;
}

export function useLiveProfile({ isOpen, user }: UseLiveProfileParams) {
  const [liveProfile, setLiveProfile] = useState<FirestoreUser | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    const unsubscribe = dataService.subscribeToUserProfile(user.uid, (p) => {
      setLiveProfile(p);
      setProfileLoaded(true);
    });
    return () => {
      unsubscribe();
      setLiveProfile(null);
      setProfileLoaded(false);
    };
  }, [isOpen, user?.uid]);

  const [userAddress, setUserAddress] = useState(user?.address || '');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressFeedback, setAddressFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const targetAddress = user?.address ?? liveProfile?.address ?? '';
  const [prevTargetAddress, setPrevTargetAddress] = useState(targetAddress);
  if (targetAddress !== prevTargetAddress) {
    setPrevTargetAddress(targetAddress);
    setUserAddress(targetAddress);
  }

  const handleSaveAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFeedback(null);
    const trimmed = userAddress.trim();
    if (trimmed.length > 0 && (trimmed.length < 20 || trimmed.length > 300)) {
      setAddressFeedback({ type: 'error', message: 'العنوان يجب أن يكون بين 20 و 300 حرف' });
      return;
    }
    if (!user?.uid) return;
    try {
      setIsSavingAddress(true);
      await dataService.updateUserProfile(user.uid, { address: trimmed });
      setAddressFeedback({ type: 'success', message: 'تم حفظ العنوان بنجاح.' });
    } catch (err: unknown) {
      setAddressFeedback({ type: 'error', message: err instanceof Error ? err.message : 'تعذر حفظ العنوان.' });
    } finally {
      setIsSavingAddress(false);
    }
  };

  return {
    liveProfile,
    profileLoaded,
    userAddress,
    setUserAddress,
    isSavingAddress,
    addressFeedback,
    handleSaveAddressSubmit,
  };
}
