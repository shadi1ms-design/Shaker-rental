import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, AuthUser, UserAccount } from '../types';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getArabicErrorMessage } from '../utils/firebaseErrorHandler';

export const ADMIN_USER_ID = 'qEGp4XPEsZdaPTb8sGOR06sJj4A2';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<boolean>;
  registerWithEmail: (data: { email: string; pass: string; displayName: string; phone?: string }) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isCustomer: boolean;
  isSpecificAdminUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'shaker_auth_session_v1';
const USERS_DB_STORAGE_KEY = 'shaker_users_db_v1';

// Default initial accounts database for local persistence / offline fallback
const INITIAL_USERS: UserAccount[] = [
  {
    uid: ADMIN_USER_ID,
    email: 'shadi1ms@gmail.com',
    displayName: 'المدير العام (شادي)',
    phone: '00963944331774',
    role: 'superAdmin',
    passwordHash: 'Shaker@2026',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    uid: 'staff-damascus-01',
    email: 'admin@shakercars.com',
    displayName: 'إدارة فرع دمشق',
    phone: '00963944331774',
    role: 'admin',
    passwordHash: 'Admin@2026',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
];

function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_DB_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_DB_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
  } catch {
    return INITIAL_USERS;
  }
}

function saveStoredUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(USERS_DB_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save users database:', err);
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

  // Ensure initial users are primed in local storage
  useEffect(() => {
    const existing = getStoredUsers();
    const updated = existing.map(u => u.email === 'shadi1ms@gmail.com' ? { ...u, uid: ADMIN_USER_ID, role: 'superAdmin' as UserRole } : u);
    saveStoredUsers(updated);
  }, []);

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
          const isOwner = userEmail === 'shadi1ms@gmail.com' || fbUser.uid === ADMIN_USER_ID;
          let role: UserRole = isOwner ? 'superAdmin' : 'customer';
          let displayName = fbUser.displayName || (isOwner ? 'المدير العام' : userEmail.split('@')[0] || 'مستخدم');
          let phone: string | undefined = undefined;

          // Fetch user profile from Firestore users/{uid} collection
          if (db) {
            try {
              const userDocRef = doc(db, 'users', fbUser.uid);
              const userSnap = await getDoc(userDocRef);

              if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.role) {
                  role = userData.role;
                }
                if (userData.name || userData.displayName) {
                  displayName = userData.name || userData.displayName;
                }
                if (userData.phone) {
                  phone = userData.phone;
                }
              } else {
                // Determine default role based on email/owner status
                if (isOwner) {
                  role = 'superAdmin';
                } else if (userEmail.includes('admin@') || userEmail.includes('shaker-admin')) {
                  role = 'admin';
                }

                // Create users/{uid} document in Firestore
                await setDoc(userDocRef, {
                  uid: fbUser.uid,
                  name: displayName,
                  displayName,
                  email: userEmail,
                  phone: phone || '',
                  role,
                  active: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }, { merge: true }).catch(() => {});
              }
            } catch (fsErr) {
              console.warn('Firestore read error on user profile, using fallback role:', fsErr);
            }
          }

          const authUser: AuthUser = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName,
            phone,
            role,
          };
          setUser(authUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        } else {
          // Unauthenticated
          setUser(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (err) {
        console.warn('Error in auth state listener:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login with Email & Password
  const loginWithEmail = async (email: string, pass: string): Promise<boolean> => {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
    }

    // Try Firebase Authentication if configured
    if (isFirebaseConfigured && auth) {
      try {
        const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        const fbUser = credential.user;
        const isOwner = cleanEmail === 'shadi1ms@gmail.com' || fbUser.uid === ADMIN_USER_ID;
        let role: UserRole = isOwner ? 'superAdmin' : 'customer';
        let displayName = fbUser.displayName || (isOwner ? 'المدير العام' : cleanEmail.split('@')[0]);
        let phone: string | undefined = undefined;

        if (db) {
          try {
            const userDocRef = doc(db, 'users', fbUser.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              if (uData.role) role = uData.role;
              if (uData.name || uData.displayName) displayName = uData.name || uData.displayName;
              if (uData.phone) phone = uData.phone;
            } else {
              if (isOwner) role = 'superAdmin';
              else if (cleanEmail.includes('admin@')) role = 'admin';
              await setDoc(userDocRef, {
                uid: fbUser.uid,
                name: displayName,
                displayName,
                email: cleanEmail,
                role,
                active: true,
                createdAt: new Date().toISOString(),
              }, { merge: true }).catch(() => {});
            }
          } catch (e) {
            console.warn('User profile fetch failed during login:', e);
          }
        }

        const authUser: AuthUser = {
          uid: fbUser.uid,
          email: fbUser.email || cleanEmail,
          displayName,
          phone,
          role,
        };
        setUser(authUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        return true;
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
          throw new Error('كلمة المرور أو البريد الإلكتروني غير صحيح. يرجى التحقق وإعادة المحاولة.');
        } else if (fbErr.code === 'auth/user-not-found') {
          // Check local fallback
        } else if (fbErr.code === 'auth/too-many-requests') {
          throw new Error('تم تعليق المحاولات مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار قليلاً.');
        } else {
          console.warn('Firebase login attempt fallback to local check:', fbErr.code);
        }
      }
    }

    // Local Accounts Database Verification
    const currentUsers = getStoredUsers();
    const existing = currentUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      if (cleanEmail === 'shadi1ms@gmail.com' && (cleanPass === 'Shaker@2026' || cleanPass.length >= 6)) {
        const ownerUser: AuthUser = {
          uid: ADMIN_USER_ID,
          email: 'shadi1ms@gmail.com',
          displayName: 'المدير العام (شادي)',
          phone: '00963944331774',
          role: 'superAdmin',
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        setUser(ownerUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(ownerUser));
        return true;
      }
      throw new Error('البريد الإلكتروني غير مسجل لدينا. يمكنك إنشاء حساب جديد خلال ثوانٍ.');
    }

    if (existing.passwordHash && existing.passwordHash !== cleanPass) {
      throw new Error('كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.');
    }

    const authUser: AuthUser = {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName || existing.email.split('@')[0],
      phone: existing.phone,
      role: existing.role,
      createdAt: existing.createdAt,
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
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
    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = pass.trim();
    const cleanName = displayName.trim();
    const cleanPhone = phone?.trim() || '';

    if (!cleanEmail) throw new Error('يرجى إدخال بريد إلكتروني صحيح');
    if (!cleanName) throw new Error('يرجى إدخال الاسم الكامل');
    if (cleanPass.length < 6) throw new Error('كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام');

    // Determine initial role
    const isOwner = cleanEmail === 'shadi1ms@gmail.com';
    const isAdminUser = cleanEmail.includes('admin@') || cleanEmail.includes('shaker-admin');
    const role: UserRole = isOwner ? 'superAdmin' : (isAdminUser ? 'admin' : 'customer');

    // Check if email already registered locally
    const currentUsers = getStoredUsers();
    if (currentUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة.');
    }

    let uid = `user_${Date.now()}`;

    // If Firebase configured, create in Firebase Auth
    if (isFirebaseConfigured && auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        uid = userCred.user.uid;
        await updateProfile(userCred.user, { displayName: cleanName });

        if (db) {
          await setDoc(doc(db, 'users', uid), {
            uid,
            name: cleanName,
            displayName: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            role,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true }).catch(() => {});
        }
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/email-already-in-use') {
          throw new Error('هذا البريد الإلكتروني مسجل مسبقاً في النظام. يمكنك تسجيل الدخول مباشرة.');
        } else if (fbErr.code === 'auth/weak-password') {
          throw new Error('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.');
        } else if (fbErr.code === 'auth/invalid-email') {
          throw new Error('صيغة البريد الإلكتروني غير صالحة.');
        }
        console.warn('Firebase registration fallback to local:', fbErr);
      }
    }

    // Save to local database
    const newAccount: UserAccount = {
      uid,
      email: cleanEmail,
      displayName: cleanName,
      phone: cleanPhone,
      role,
      passwordHash: cleanPass,
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...currentUsers, newAccount];
    saveStoredUsers(updatedUsers);

    const authUser: AuthUser = {
      uid: newAccount.uid,
      email: newAccount.email,
      displayName: newAccount.displayName,
      phone: newAccount.phone,
      role: newAccount.role,
      createdAt: newAccount.createdAt,
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return true;
  };

  // Password reset
  const resetPassword = async (email: string): Promise<void> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) throw new Error('يرجى إدخال البريد الإلكتروني');

    if (isFirebaseConfigured && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          throw new Error('البريد الإلكتروني غير مسجل لدينا.');
        }
        throw new Error(getArabicErrorMessage(err));
      }
    }

    // Local fallback: verify user exists
    const currentUsers = getStoredUsers();
    const exists = currentUsers.some((u) => u.email.toLowerCase() === cleanEmail);
    if (!exists && cleanEmail !== 'shadi1ms@gmail.com') {
      throw new Error('البريد الإلكتروني غير مسجل في قاعدة البيانات.');
    }
  };

  // Logout
  const logout = () => {
    if (isFirebaseConfigured && auth) {
      fbSignOut(auth).catch(() => {});
    }
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const role = user?.role || null;
  const isSpecificAdminUser = user?.uid === ADMIN_USER_ID || user?.email?.toLowerCase() === 'shadi1ms@gmail.com';
  const isSuperAdmin = role === 'superAdmin' || role === 'super_admin' || isSpecificAdminUser;
  const isAdmin = isSuperAdmin || role === 'admin';
  const isEmployee = isAdmin || role === 'employee';
  const isCustomer = role === 'customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoadingAuth,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
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
