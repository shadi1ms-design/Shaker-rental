import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, AuthUser, UserAccount } from '../types';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  User as FirebaseUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { getArabicErrorMessage } from '../utils/firebaseErrorHandler';
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
  logout: () => Promise<void>;
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

const DEMO_USERS_STORAGE_KEY = 'shaker_demo_users_v1';
const DEMO_INITIAL_USERS: UserAccount[] = [];

function getDemoUsers(): UserAccount[] {
  if (!import.meta.env.DEV) return [];
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
  if (!import.meta.env.DEV) return;
  try {
    localStorage.setItem(DEMO_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save demo users:', err);
  }
}

/**
 * Resolves user role strictly from Firebase Auth Custom Claims.
 * Firebase Authentication Custom Claims is the sole server-side source of truth.
 */
async function resolveRoleFromToken(fbUser: FirebaseUser, forceRefresh = false): Promise<UserRole> {
  try {
    let tokenResult = await fbUser.getIdTokenResult(forceRefresh);
    let claims = tokenResult.claims || {};

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

    // Invoke syncMyRole server function
    try {
      const syncRes = await functionsService.syncMyRole();
      if (syncRes.success && syncRes.data?.role) {
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
    } catch {}

    return 'customer';
  } catch (tokenErr) {
    console.warn('Error reading Firebase Auth token claims:', tokenErr);
    return 'customer';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(Boolean(isFirebaseConfigured));

  // Centralized Firebase auth listener using onIdTokenChanged
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsLoadingAuth(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const userEmail = (fbUser.email || '').toLowerCase().trim();
          const role: UserRole = await resolveRoleFromToken(fbUser);

          let displayName = fbUser.displayName || userEmail.split('@')[0] || 'مستخدم';
          let phone: string | undefined = fbUser.phoneNumber || undefined;
          let userCreatedAt: string | undefined = undefined;

          if (db) {
            try {
              const userDocRef = doc(db, 'users', fbUser.uid);
              const userSnap = await Promise.race([
                getDoc(userDocRef),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
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

                // Check if account is disabled in Firestore
                if (userData.disabled === true || userData.accountDisabled === true) {
                  console.warn('Account is disabled in database. Signing out...');
                  await fbSignOut(auth);
                  setUser(null);
                  return;
                }
              }
            } catch (firestoreErr) {
              console.warn('Firestore profile read notice:', firestoreErr);
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
        } else {
          setUser(null);
          dataService.purgeSensitiveStorage();
        }
      } catch (err) {
        console.error('Auth state resolution error:', err);
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login with Email & Password
  const loginWithEmail = async (email: string, pass: string): Promise<boolean> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) throw new Error('يرجى إدخال البريد الإلكتروني.');
    if (!pass) throw new Error('يرجى إدخال كلمة المرور.');

    if (isFirebaseConfigured && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        await resolveRoleFromToken(cred.user, true);
        return true;
      } catch (err: any) {
        throw new Error(getArabicErrorMessage(err));
      }
    }

    if (import.meta.env.DEV) {
      const demoUsers = getDemoUsers();
      const found = demoUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (!found) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      const authUser: AuthUser = {
        uid: found.uid,
        email: found.email,
        displayName: found.displayName,
        phone: found.phone,
        role: found.role,
        createdAt: found.createdAt,
        emailVerified: found.emailVerified ?? true,
        isPasswordProvider: found.isPasswordProvider ?? true,
      };
      setUser(authUser);
      return true;
    }

    throw new Error('خدمة التوثيق السحابية غير متصلة.');
  };

  // Register with Email & Password
  const registerWithEmail = async (data: { email: string; pass: string; displayName: string; phone?: string }): Promise<boolean> => {
    const cleanEmail = data.email.toLowerCase().trim();
    const cleanName = data.displayName.trim();
    const cleanPhone = (data.phone || '').trim();
    const pass = data.pass; // NO password trimming

    if (!cleanEmail) throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
    if (!cleanName) throw new Error('يرجى إدخال الاسم الكامل.');
    if (!pass || pass.length < 8) throw new Error('كلمة المرور يجب أن لا تقل عن 8 خانات.');
    if (!/[a-zA-Z]/.test(pass) || !/\d/.test(pass)) throw new Error('كلمة المرور يجب أن تحتوي على حرف واحد ورقم واحد على الأقل.');

    if (isFirebaseConfigured && auth) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        await updateProfile(cred.user, { displayName: cleanName });
        try {
          await sendEmailVerification(cred.user);
        } catch (vErr) {
          console.warn('Failed to send verification email:', vErr);
        }
        try {
          await functionsService.syncMyRole();
        } catch {}
        return true;
      } catch (err: any) {
        throw new Error(getArabicErrorMessage(err));
      }
    }

    if (import.meta.env.DEV) {
      const demoUsers = getDemoUsers();
      if (demoUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
        throw new Error('هذا البريد الإلكتروني مسجل مسبقاً.');
      }
      const newUser: UserAccount = {
        uid: `demo_user_${Date.now()}`,
        email: cleanEmail,
        displayName: cleanName,
        phone: cleanPhone,
        role: 'customer',
        createdAt: new Date().toISOString(),
        emailVerified: false,
        isPasswordProvider: true,
      };
      saveDemoUsers([...demoUsers, newUser]);
      setUser(newUser);
      return true;
    }

    throw new Error('خدمة التوثيق السحابية غير متصلة.');
  };

  // Google Sign-In
  const loginWithGoogle = async (preferredEmail?: string): Promise<boolean> => {
    if (isFirebaseConfigured && auth) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account',
          ...(preferredEmail ? { login_hint: preferredEmail } : {})
        });

        let fbUser: FirebaseUser;
        try {
          const cred = await signInWithPopup(auth, provider);
          fbUser = cred.user;
        } catch (popupErr: any) {
          if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, provider);
            return true;
          }
          if (popupErr?.code === 'auth/account-exists-with-different-credential') {
            throw new Error('يوجد حساب مسجل مسبقاً بنفس البريد الإلكتروني باستخدام طريقة دخول مختلفة.');
          }
          throw popupErr;
        }

        await resolveRoleFromToken(fbUser, true);
        return true;
      } catch (err: any) {
        throw new Error(getArabicErrorMessage(err));
      }
    }

    if (import.meta.env.DEV) {
      const email = (preferredEmail || 'demo_google_user@shakercars.com').toLowerCase().trim();
      const demoUsers = getDemoUsers();
      let found = demoUsers.find(u => u.email.toLowerCase() === email);
      if (!found) {
        found = {
          uid: `demo_google_${Date.now()}`,
          email,
          displayName: email.split('@')[0] || 'مستخدم Google',
          phone: undefined,
          role: 'customer',
          createdAt: new Date().toISOString(),
          emailVerified: true,
          isPasswordProvider: false,
        };
        saveDemoUsers([...demoUsers, found]);
      }
      setUser(found);
      return true;
    }

    throw new Error('خدمة التوثيق السحابية غير متصلة.');
  };

  const resetPassword = async (email: string): Promise<void> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) throw new Error('يرجى إدخال البريد الإلكتروني.');

    if (isFirebaseConfigured && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return;
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') return;
        throw new Error(getArabicErrorMessage(err));
      }
    }
  };

  const logout = async (): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.warn('SignOut warning:', err);
      }
    }

    if (db) {
      try {
        await terminate(db).catch(() => {});
        await clearIndexedDbPersistence(db).catch(() => {});
      } catch {}
    }

    setUser(null);
    localStorage.removeItem('shaker_auth_session_v1');
    dataService.purgeSensitiveStorage();
  };

  const refreshClaims = async (): Promise<void> => {
    if (isFirebaseConfigured && auth && auth.currentUser) {
      try {
        const role = await resolveRoleFromToken(auth.currentUser, true);
        setUser(prev => prev ? { ...prev, role } : null);
      } catch (err) {
        console.warn('Failed to refresh claims:', err);
      }
    }
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!auth?.currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshEmailVerificationStatus = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    const verified = auth.currentUser.emailVerified;
    setUser(prev => prev ? { ...prev, emailVerified: verified } : null);
    return verified;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!auth?.currentUser || !auth.currentUser.email) {
      throw new Error('يجب تسجيل الدخول أولاً.');
    }
    const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, cred);
    await updatePassword(auth.currentUser, newPassword);
  };

  const changePhoneNumber = async (newPhone: string): Promise<void> => {
    if (!auth?.currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
    const cleanPhone = newPhone.trim();
    if (!cleanPhone) throw new Error('يرجى إدخال رقم هاتف صحيح.');
    setUser(prev => prev ? { ...prev, phone: cleanPhone } : null);
  };

  const role = user?.role || null;
  const isSuperAdmin = Boolean(user && (role === 'super_admin'));
  const isAdmin = Boolean(user && (isSuperAdmin || role === 'admin'));
  const isEmployee = Boolean(user && (isAdmin || role === 'employee'));
  const isCustomer = Boolean(user && (role === 'customer' || !role));
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
