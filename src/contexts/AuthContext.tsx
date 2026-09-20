import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, AuthUser, UserAccount } from '../types';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getArabicErrorMessage } from '../utils/firebaseErrorHandler';
import { loginRateLimiter, sanitizeInput } from '../utils/security';
import { functionsService } from '../services/functionsService';
import { dataService } from '../services/dataService';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<boolean>;
  registerWithEmail: (data: { email: string; pass: string; displayName: string; phone?: string }) => Promise<boolean>;
  loginWithGoogle: (preferredEmail?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  refreshClaims: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerificationStatus: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changePhoneNumber: (newPhone: string) => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isCustomer: boolean;
  isSpecificAdminUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'shaker_auth_session_v1';
const DEMO_USERS_STORAGE_KEY = 'shaker_demo_users_v1';

// Initial demo accounts (Empty by default - no hardcoded admin credentials in source code)
const DEMO_INITIAL_USERS: UserAccount[] = [];

function getDemoUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(DEMO_USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DEMO_USERS_STORAGE_KEY, JSON.stringify(DEMO_INITIAL_USERS));
      return DEMO_INITIAL_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEMO_INITIAL_USERS;
  } catch {
    return DEMO_INITIAL_USERS;
  }
}

function saveDemoUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(DEMO_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save demo users:', err);
  }
}

/**
 * Resolves user role strictly from Firebase Auth Token Custom Claims.
 * Firebase Authentication Custom Claims is the sole server-side source of truth.
 * Never relies on unverified Firestore data, React state, or localStorage.
 */
async function resolveRoleFromToken(fbUser: FirebaseUser, forceRefresh = false): Promise<UserRole> {
  try {
    let tokenResult = await fbUser.getIdTokenResult(forceRefresh);
    let claims = tokenResult.claims || {};

    // If no role or elevated claim is present in the initial token result and we haven't force-refreshed yet,
    // force a refresh to retrieve any freshly minted server claims without stale cache delay.
    if (!claims.role && !claims.super_admin && !claims.superAdmin && !claims.admin && !claims.employee && !forceRefresh) {
      tokenResult = await fbUser.getIdTokenResult(true);
      claims = tokenResult.claims || {};
    }

    if (claims.role && typeof claims.role === 'string') {
      const cr = claims.role.toLowerCase().trim();
      if (cr === 'super_admin' || cr === 'superadmin' || cr === 'owner') {
        return 'super_admin';
      }
      if (cr === 'admin') {
        return 'admin';
      }
      if (cr === 'employee' || cr === 'staff' || cr === 'manager') {
        return 'employee';
      }
      return 'customer';
    }

    if (claims.super_admin === true || claims.superAdmin === true || claims.owner === true) {
      return 'super_admin';
    }
    if (claims.admin === true) {
      return 'admin';
    }
    if (claims.employee === true || claims.staff === true) {
      return 'employee';
    }

    // If user has no claims yet, invoke syncMyRole server function (which mints customer role only)
    try {
      const syncRes = await functionsService.syncMyRole();
      if (syncRes.success && syncRes.data?.role) {
        // Force refresh ID token to obtain newly minted claims
        await fbUser.getIdTokenResult(true);
        const syncedRole = syncRes.data.role.toLowerCase().trim();
        if (syncedRole === 'super_admin' || syncedRole === 'superadmin' || syncedRole === 'owner') {
          return 'super_admin';
        }
        if (syncedRole === 'admin') {
          return 'admin';
        }
        if (syncedRole === 'employee' || syncedRole === 'staff') {
          return 'employee';
        }
        return 'customer';
      }
    } catch {
      // Default to customer on network error
    }

    return 'customer';
  } catch (tokenErr) {
    console.warn('Error reading Firebase Auth token claims:', tokenErr);
    return 'customer';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(Boolean(isFirebaseConfigured));

  // Centralized Firebase auth state listener
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const userEmail = (fbUser.email || '').toLowerCase().trim();

          // 1. Role is strictly determined from Firebase Auth Custom Claims
          const role: UserRole = await resolveRoleFromToken(fbUser);

          let displayName = fbUser.displayName || userEmail.split('@')[0] || 'مستخدم';
          let phone: string | undefined = fbUser.phoneNumber || undefined;

          let userCreatedAt: string | undefined = undefined;
          // 2. Read display profile info from Firestore (display only, never security authority)
          if (db) {
            try {
              const userDocRef = doc(db, 'users', fbUser.uid);
              const userSnap = await Promise.race([
                getDoc(userDocRef),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
              ]);

              if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.name || userData.displayName) {
                  displayName = userData.name || userData.displayName;
                }
                if (userData.phone) {
                  phone = userData.phone;
                }
                if (userData.createdAt) {
                  userCreatedAt = userData.createdAt;
                }

                // مزامنة بيانات الاتصال الحقيقية من Firebase Auth (المصدر الموثوق الوحيد)
                // في كل تسجيل دخول، دون المساس بأي حقل صلاحيات (role, isAdmin, isStaff, active, verified...)
                const needsSync =
                  userData.email !== userEmail ||
                  userData.displayName !== displayName ||
                  (phone && userData.phone !== phone);

                if (needsSync) {
                  await setDoc(userDocRef, {
                    email: userEmail,
                    displayName,
                    name: displayName,
                    ...(phone ? { phone } : {}),
                    updatedAt: new Date().toISOString(),
                  }, { merge: true }).catch(() => {});
                }
              } else {
                // Provision initial profile record for UI display
                userCreatedAt = new Date().toISOString();
                await setDoc(userDocRef, {
                  uid: fbUser.uid,
                  name: displayName,
                  displayName,
                  email: userEmail,
                  role, // display metadata only
                  active: true,
                  uploadedFilesCount: 0,
                  createdAt: userCreatedAt,
                  updatedAt: userCreatedAt,
                }, { merge: true }).catch(() => {});
              }
            } catch (firestoreErr) {
              console.warn('Firestore display profile read error:', firestoreErr);
            }
          }

          const authUser: AuthUser = {
            uid: fbUser.uid,
            email: userEmail,
            displayName,
            phone,
            role,
            createdAt: userCreatedAt || fbUser.metadata?.creationTime,
            emailVerified: fbUser.emailVerified,
            isPasswordProvider: fbUser.providerData.some(p => p.providerId === 'password'),
          };

          setUser(authUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } else {
          setUser(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
          dataService.purgeSensitiveStorage();
        }
      } catch (err) {
        console.error('Auth state change resolution error:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login with Email & Password
  const loginWithEmail = async (email: string, pass: string): Promise<boolean> => {
    const cleanEmail = sanitizeInput(email).toLowerCase().trim();
    const cleanPass = pass.trim();

    if (!cleanEmail) throw new Error('يرجى إدخال بريد إلكتروني صحيح');
    if (!cleanPass) throw new Error('يرجى إدخال كلمة المرور');

    // 1. Client-side fast UX rate limiter check
    const rateLimit = loginRateLimiter.isAllowed(cleanEmail);
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.message || 'تم تجاوز الحد المسموح من محاولات الدخول. يرجى الانتظار قليلاً.');
    }

    // 2. Server-authoritative pre-login rate limit verification
    if (isFirebaseConfigured) {
      const allowedRes = await functionsService.checkLoginAllowed(cleanEmail);
      if (!allowedRes.success) {
        throw new Error(
          allowedRes.error ||
          'تم تجميد محاولات الدخول مؤقتاً لحماية أمان الحساب. يرجى الانتظار قليلاً قبل المحاولة مجدداً.'
        );
      }
    }

    // 3. Production Mode: Firebase Authentication Custom Claims is the sole authority
    if (isFirebaseConfigured && auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        const fbUser = userCred.user;
        const userEmail = (fbUser.email || cleanEmail).toLowerCase().trim();

        // Resolve role exclusively from Firebase Auth Custom Claims (forceRefresh = true)
        const role: UserRole = await resolveRoleFromToken(fbUser, true);

        let displayName = fbUser.displayName || userEmail.split('@')[0] || 'مستخدم';
        let phone: string | undefined = fbUser.phoneNumber || undefined;

        let userCreatedAt: string | undefined = undefined;
        if (db) {
          try {
            const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              if (uData.name || uData.displayName) displayName = uData.name || uData.displayName;
              if (uData.phone) phone = uData.phone;
              if (uData.createdAt) userCreatedAt = uData.createdAt;
            }
          } catch (e) {
            console.warn('Could not read user profile from firestore:', e);
          }
        }

        const authUser: AuthUser = {
          uid: fbUser.uid,
          email: userEmail,
          displayName,
          phone,
          role,
          createdAt: userCreatedAt || fbUser.metadata?.creationTime,
          emailVerified: fbUser.emailVerified,
          isPasswordProvider: fbUser.providerData.some(p => p.providerId === 'password'),
        };

        setUser(authUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));

        // Reset rate limit counters both locally and server-authoritatively
        loginRateLimiter.reset(cleanEmail);
        functionsService.resetLoginAttempts(cleanEmail).catch(() => {});

        return true;
      } catch (fbErr: any) {
        // Record failed attempt locally and server-authoritatively
        loginRateLimiter.recordFailedAttempt(cleanEmail);
        functionsService.recordFailedLogin(cleanEmail).catch(() => {});

        // Unified error messaging to prevent email enumeration
        if (
          fbErr.code === 'auth/wrong-password' ||
          fbErr.code === 'auth/invalid-credential' ||
          fbErr.code === 'auth/user-not-found'
        ) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        } else if (fbErr.code === 'auth/too-many-requests') {
          throw new Error('تم تعليق المحاولات مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار قليلاً.');
        } else if (fbErr.code === 'auth/user-disabled') {
          throw new Error('تم تعطيل هذا الحساب من قبل الإدارة.');
        } else if (fbErr.code === 'auth/invalid-email') {
          throw new Error('صيغة البريد الإلكتروني غير صالحة.');
        } else if (fbErr.code === 'auth/operation-not-allowed') {
          throw new Error('تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في لوحة تحكم Firebase.');
        } else {
          throw new Error(getArabicErrorMessage(fbErr));
        }
      }
    }

    // 4. Demo Mode (Only active when Firebase is completely unconfigured)
    const demoUsers = getDemoUsers();
    const existing = demoUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      loginRateLimiter.recordFailedAttempt(cleanEmail);
      if (isFirebaseConfigured) {
        functionsService.recordFailedLogin(cleanEmail).catch(() => {});
      }
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }

    const authUser: AuthUser = {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      phone: existing.phone,
      role: existing.role,
      createdAt: existing.createdAt,
      emailVerified: existing.emailVerified ?? true,
      isPasswordProvider: existing.isPasswordProvider ?? true,
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    loginRateLimiter.reset(cleanEmail);
    if (isFirebaseConfigured) {
      functionsService.resetLoginAttempts(cleanEmail).catch(() => {});
    }
    return true;
  };

  // Register with Email, Password, Name & Phone
  const registerWithEmail = async ({
    email,
    pass,
    displayName,
    phone
  }: {
    email: string;
    pass: string;
    displayName: string;
    phone?: string;
  }): Promise<boolean> => {
    const cleanEmail = sanitizeInput(email).toLowerCase().trim();
    const cleanPass = pass.trim();
    const cleanName = sanitizeInput(displayName).trim();
    const cleanPhone = sanitizeInput(phone || '').trim();

    if (!cleanEmail) throw new Error('يرجى إدخال بريد إلكتروني صحيح');
    if (!cleanName) throw new Error('يرجى إدخال الاسم الكامل');
    if (cleanPass.length < 8) {
      throw new Error('كلمة المرور يجب أن لا تقل عن 8 خانات');
    }
    if (!/[a-zA-Z]/.test(cleanPass) || !/\d/.test(cleanPass)) {
      throw new Error('كلمة المرور يجب أن تحتوي على حرف واحد ورقم واحد على الأقل');
    }

    // 1. Production Mode: Firebase Authentication creates the credentials
    if (isFirebaseConfigured && auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        try {
          await sendEmailVerification(userCred.user);
        } catch (verifyErr) {
          console.warn('Failed to send verification email:', verifyErr);
        }

        const uid = userCred.user.uid;
        await updateProfile(userCred.user, { displayName: cleanName });

        // Mint initial custom claim via syncMyRole server function
        try {
          await functionsService.syncMyRole();
          await userCred.user.getIdTokenResult(true);
        } catch {
          // Token claims will default to customer
        }

        const role: UserRole = 'customer';
        const nowIso = new Date().toISOString();

        if (db) {
          await setDoc(doc(db, 'users', uid), {
            uid,
            name: cleanName,
            displayName: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            role, // display metadata only
            active: true,
            uploadedFilesCount: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          }, { merge: true }).catch((docErr) => {
            console.warn('Could not sync user profile to Firestore:', docErr);
          });
        }

        const authUser: AuthUser = {
          uid,
          email: cleanEmail,
          displayName: cleanName,
          phone: cleanPhone,
          role,
          createdAt: nowIso,
          emailVerified: userCred.user.emailVerified,
          isPasswordProvider: userCred.user.providerData.some(p => p.providerId === 'password'),
        };

        setUser(authUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        return true;
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/email-already-in-use') {
          throw new Error('هذا البريد الإلكتروني مسجل مسبقاً في النظام. يمكنك تسجيل الدخول مباشرة.');
        } else if (fbErr.code === 'auth/weak-password') {
          throw new Error('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور تتكون من 8 خانات على الأقل وتتضمن أحرفاً وأرقاماً.');
        } else if (fbErr.code === 'auth/invalid-email') {
          throw new Error('صيغة البريد الإلكتروني غير صالحة.');
        } else if (fbErr.code === 'auth/operation-not-allowed') {
          throw new Error('تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في لوحة تحكم Firebase.');
        } else {
          throw new Error(getArabicErrorMessage(fbErr));
        }
      }
    }

    // 2. Demo Mode (Only active when Firebase is completely unconfigured)
    const demoUsers = getDemoUsers();
    if (demoUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('هذا البريد الإلكتروني مسجل مسبقاً.');
    }

    const newAccount: UserAccount = {
      uid: `demo_user_${Date.now()}`,
      email: cleanEmail,
      displayName: cleanName,
      phone: cleanPhone,
      role: 'customer',
      createdAt: new Date().toISOString(),
      emailVerified: false,
      isPasswordProvider: true,
    };

    saveDemoUsers([...demoUsers, newAccount]);

    const authUser: AuthUser = {
      uid: newAccount.uid,
      email: newAccount.email,
      displayName: newAccount.displayName,
      phone: newAccount.phone,
      role: newAccount.role,
      createdAt: newAccount.createdAt,
      emailVerified: newAccount.emailVerified,
      isPasswordProvider: newAccount.isPasswordProvider,
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return true;
  };

  // Google Sign-In & Instant Account Registration
  const loginWithGoogle = async (preferredEmail?: string): Promise<boolean> => {
    // 1. If Firebase is configured with Auth
    if (isFirebaseConfigured && auth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account',
          ...(preferredEmail ? { login_hint: preferredEmail } : {}),
        });

        const result = await signInWithPopup(auth, provider);
        const fbUser = result.user;
        const userEmail = (fbUser.email || preferredEmail || '').toLowerCase().trim();

        // Resolve role strictly from Firebase Auth Custom Claims (forceRefresh = true)
        const role: UserRole = await resolveRoleFromToken(fbUser, true);

        let displayName = fbUser.displayName || userEmail.split('@')[0] || 'مستخدم Google';
        let phone = fbUser.phoneNumber || undefined;
        let userCreatedAt: string | undefined = undefined;

        // Fetch or create profile in Firestore for display
        if (db) {
          try {
            const userDocRef = doc(db, 'users', fbUser.uid);
            const userSnap = await Promise.race([
              getDoc(userDocRef),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
            ]);

            if (userSnap.exists()) {
              const userData = userSnap.data();
              if (userData.name || userData.displayName) displayName = userData.name || userData.displayName;
              if (userData.phone) phone = userData.phone;
              if (userData.createdAt) userCreatedAt = userData.createdAt;
            } else {
              const nowIso = new Date().toISOString();
              userCreatedAt = nowIso;
              await setDoc(userDocRef, {
                uid: fbUser.uid,
                name: displayName,
                displayName,
                email: userEmail,
                phone: phone || '',
                role, // display metadata only
                provider: 'google',
                active: true,
                createdAt: nowIso,
                updatedAt: nowIso,
              }, { merge: true }).catch(() => {});
            }
          } catch (dbErr) {
            console.warn('Firestore sync during Google login:', dbErr);
          }
        }

        const authUser: AuthUser = {
          uid: fbUser.uid,
          email: userEmail,
          displayName,
          phone,
          role,
          createdAt: userCreatedAt || fbUser.metadata?.creationTime || new Date().toISOString(),
          emailVerified: fbUser.emailVerified,
          isPasswordProvider: fbUser.providerData.some(p => p.providerId === 'password'),
        };

        setUser(authUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        return true;
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/popup-closed-by-user') {
          throw new Error('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
        } else if (fbErr.code === 'auth/popup-blocked') {
          throw new Error('تم حظر النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة لتسجيل الدخول.');
        } else if (fbErr.code === 'auth/cancelled-popup-request') {
          throw new Error('تم إلغاء طلب تسجيل الدخول.');
        } else if (fbErr.code === 'auth/unauthorized-domain') {
          throw new Error('نطاق الموقع غير مضاف إلى نطاقات Firebase المعتمدة لتسجيل الدخول عبر Google.');
        } else if (fbErr.code === 'auth/operation-not-allowed') {
          throw new Error('تسجيل الدخول عبر Google غير مفعّل حالياً في إعدادات Firebase Authentication.');
        }
        console.warn('Firebase Google Auth error:', fbErr);
        throw new Error(getArabicErrorMessage(fbErr));
      }
    }

    // 2. Demo fallback when Firebase is unconfigured
    const cleanEmail = (preferredEmail || 'demo_user@shakercars.com').toLowerCase().trim();
    const demoUsers = getDemoUsers();
    let existing = demoUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      existing = {
        uid: `demo_google_${Date.now()}`,
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0] || 'مستخدم تجريبي',
        phone: undefined,
        role: 'customer',
        createdAt: new Date().toISOString(),
      };
      saveDemoUsers([...demoUsers, existing]);
    }

    const authUser: AuthUser = {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      phone: existing.phone,
      role: existing.role,
      createdAt: existing.createdAt,
      emailVerified: true,
      isPasswordProvider: false,
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return true;
  };

  // Password reset (Email Enumeration Protected)
  const resetPassword = async (email: string): Promise<void> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) throw new Error('يرجى إدخال البريد الإلكتروني');

    if (isFirebaseConfigured && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          // Do not reveal user existence - return generic success
          return;
        }
        throw new Error(getArabicErrorMessage(err));
      }
    }

    // Demo fallback check (Always return silently to prevent email enumeration)
    return;
  };

  // Refresh Claims manually (e.g. after bootstrap or role sync)
  const refreshClaims = async (): Promise<void> => {
    if (isFirebaseConfigured && auth?.currentUser) {
      try {
        const newRole = await resolveRoleFromToken(auth.currentUser, true);
        setUser((prev) => {
          if (!prev) return null;
          const updated: AuthUser = { ...prev, role: newRole };
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.warn('Failed to refresh claims:', err);
      }
    }
  };

  // Resend Verification Email
  const resendVerificationEmail = async (): Promise<void> => {
    if (!auth?.currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
    await sendEmailVerification(auth.currentUser);
  };

  // Refresh Email Verification Status
  const refreshEmailVerificationStatus = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    const isVerified = auth.currentUser.emailVerified;
    setUser(prev => {
      if (!prev) return null;
      const updated: AuthUser = { ...prev, emailVerified: isVerified };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage auth:', e);
      }
      return updated;
    });
    return isVerified;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!auth?.currentUser || !auth.currentUser.email) {
      throw new Error('يجب تسجيل الدخول أولاً.');
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const changePhoneNumber = async (newPhone: string): Promise<void> => {
    if (!auth?.currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
    const cleanPhone = (newPhone || '').trim();
    if (!cleanPhone) throw new Error('يرجى إدخال رقم هاتف صحيح.');
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        phone: cleanPhone,
        updatedAt: serverTimestamp(),
      });
    }
    setUser(prev => {
      if (!prev) return null;
      const updated: AuthUser = { ...prev, phone: cleanPhone };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage auth:', e);
      }
      return updated;
    });
  };

  // Logout
  const logout = () => {
    if (isFirebaseConfigured && auth) {
      fbSignOut(auth).catch(() => {});
    }
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    dataService.purgeSensitiveStorage();
  };

  // Sensitive role permissions are strictly withheld while isLoadingAuth is true
  // to prevent displaying elevated views before server token claims verification completes.
  const role = isLoadingAuth ? null : (user?.role || null);
  const isSuperAdmin = !isLoadingAuth && (role === 'super_admin' || role === 'superAdmin');
  const isAdmin = !isLoadingAuth && (isSuperAdmin || role === 'admin');
  const isEmployee = !isLoadingAuth && (isAdmin || role === 'employee');
  const isCustomer = !isLoadingAuth && (role === 'customer' || !role);
  const isSpecificAdminUser = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoadingAuth,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
        logout,
        refreshClaims,
        resendVerificationEmail,
        refreshEmailVerificationStatus,
        changePassword,
        changePhoneNumber,
        isSuperAdmin,
        isAdmin,
        isEmployee,
        isCustomer,
        isSpecificAdminUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
