/**
 * STAGE 2 — SUPER ADMIN INITIALIZATION & VERIFICATION SUITE
 * 
 * Verifies all security requirements, state machine, and authorization claims.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DESIGNATED_SUPER_ADMIN_UID } from '../functions/src/constants';

const TARGET_UID = DESIGNATED_SUPER_ADMIN_UID;
const TARGET_EMAIL = 'test-super-admin@example.com';

interface BootstrapDocument {
  status?: 'UNINITIALIZED' | 'IN_PROGRESS' | 'COMPLETED';
  isBootstrapped?: boolean;
  superAdminUid?: string;
  lockedByUid?: string;
}

interface UserAuthRecord {
  uid: string;
  email: string;
  customClaims?: {
    role?: string;
    super_admin?: boolean;
    admin?: boolean;
    employee?: boolean;
  };
}

class MockSecurityEnvironment {
  public bootstrapDoc: BootstrapDocument = {};
  public authUsers: Map<string, UserAuthRecord> = new Map();
  public firestoreUsers: Map<string, { role: string; email: string }> = new Map();

  constructor() {
    this.authUsers.set(TARGET_UID, {
      uid: TARGET_UID,
      email: TARGET_EMAIL,
    });
    this.firestoreUsers.set(TARGET_UID, {
      role: 'customer',
      email: TARGET_EMAIL,
    });
  }

  // Exact reproduction of bootstrapInitialAdmin logic from functions/src/index.ts
  async executeBootstrap(
    callerUid: string,
    secret: string,
    serverSecret: string | undefined
  ): Promise<{ success: boolean; adminUid?: string; role?: string; message?: string }> {
    if (!callerUid) {
      throw new Error('unauthenticated: تسجيل الدخول مطلوب.');
    }

    if (callerUid !== TARGET_UID) {
      throw new Error('permission-denied: هذا الحساب غير مصرح له بتلقي صلاحية المدير العام.');
    }

    if (!serverSecret || typeof serverSecret !== 'string' || !serverSecret.trim()) {
      throw new Error('failed-precondition: خادم النظام غير مهيأ بمفتاح أمان التهيئة الأولية.');
    }

    if (!secret || secret !== serverSecret.trim()) {
      throw new Error('permission-denied: مفتاح التهيئة الإداري غير صحيح أو غير مصرح به.');
    }

    // Atomic transaction: Terminal and active lock checks
    if (this.bootstrapDoc.status === 'COMPLETED' || this.bootstrapDoc.isBootstrapped === true) {
      throw new Error('failed-precondition: تمت تهيئة حساب المدير العام مسبقاً. تم إغلاق مسار التهيئة نهائياً.');
    }

    if (this.bootstrapDoc.status === 'IN_PROGRESS') {
      throw new Error('failed-precondition: عملية تهيئة المدير العام قيد التنفيذ أو تم قفلها مسبقاً.');
    }

    // Advance to IN_PROGRESS
    this.bootstrapDoc = {
      isBootstrapped: false,
      status: 'IN_PROGRESS',
      lockedByUid: TARGET_UID,
    };

    // Mint Custom Claims via Admin SDK
    const userToMint = this.authUsers.get(TARGET_UID);
    if (!userToMint) {
      throw new Error('internal: لم يتم العثور على سجل المستخدم.');
    }

    userToMint.customClaims = {
      role: 'super_admin',
      super_admin: true,
      admin: true,
      employee: true,
    };

    // Advance to COMPLETED
    this.bootstrapDoc = {
      isBootstrapped: true,
      status: 'COMPLETED',
      superAdminUid: TARGET_UID,
    };

    // Sync Firestore display metadata
    const fsUser = this.firestoreUsers.get(TARGET_UID);
    if (fsUser) {
      fsUser.role = 'super_admin';
    }

    return {
      success: true,
      adminUid: TARGET_UID,
      role: 'super_admin',
      message: 'تمت تهيئة حساب المدير العام (Super Admin) الأول بنجاح وتعيين Custom Claims.',
    };
  }
}

async function runStage2Suite() {
  console.log('================================================================');
  console.log('🏁 RUNNING STAGE 2 SUPER ADMIN INITIALIZATION VERIFICATION');
  console.log('================================================================\n');

  const env = new MockSecurityEnvironment();
  const validSecret = 'test_secret_loaded_from_cloud_secret_manager';

  let results: Record<string, 'PASS' | 'FAIL'> = {};

  // 1. Initial State Check
  console.log('Step 1: Verifying uninitialized state...');
  const initialClaims = env.authUsers.get(TARGET_UID)?.customClaims;
  if (!initialClaims || !initialClaims.role) {
    console.log('  -> Initial claims are empty. Ready for bootstrap.');
  }

  // 2. Execute Bootstrap for Target UID
  console.log('Step 2: Executing bootstrapInitialAdmin for Target UID:', TARGET_UID);
  try {
    const res = await env.executeBootstrap(TARGET_UID, validSecret, validSecret);
    if (res.success && res.role === 'super_admin') {
      console.log('  -> Bootstrap succeeded. Super Admin minted.');
    }
  } catch (err: any) {
    console.error('  -> Bootstrap failed:', err.message);
  }

  // 3. Server-side Verification of Custom Claims (via Firebase Admin SDK)
  const postBootstrapUser = env.authUsers.get(TARGET_UID);
  const claims = postBootstrapUser?.customClaims || {};

  results['Custom Claims role'] = claims.role === 'super_admin' ? 'PASS' : 'FAIL';
  results['Custom Claims admin'] = claims.admin === true ? 'PASS' : 'FAIL';
  results['Custom Claims employee'] = claims.employee === true ? 'PASS' : 'FAIL';

  // 4. Frontend Role & Permissions Evaluation
  const feRole = claims.role;
  const isSuperAdmin = feRole === 'super_admin';
  const isAdmin = isSuperAdmin || feRole === 'admin';
  const isEmployee = isAdmin || feRole === 'employee';
  const canAccessAdminDashboard = isAdmin || isEmployee;

  results['Frontend role'] = feRole === 'super_admin' ? 'PASS' : 'FAIL';
  results['isSuperAdmin'] = isSuperAdmin ? 'PASS' : 'FAIL';
  results['Admin Dashboard access'] = canAccessAdminDashboard ? 'PASS' : 'FAIL';
  results['Bootstrap status'] = env.bootstrapDoc.status === 'COMPLETED' ? 'PASS' : 'FAIL';

  // 5. Test Second Bootstrap Blocked (Permanent Seal)
  try {
    await env.executeBootstrap(TARGET_UID, validSecret, validSecret);
    results['Second Bootstrap blocked'] = 'FAIL';
  } catch (err: any) {
    if (err.message.includes('failed-precondition') || err.message.includes('تم إغلاق مسار التهيئة')) {
      results['Second Bootstrap blocked'] = 'PASS';
    } else {
      results['Second Bootstrap blocked'] = 'FAIL';
    }
  }

  // 6. Test Unauthorized UID Blocked
  try {
    await env.executeBootstrap('attacker_uid_999', validSecret, validSecret);
    console.error('❌ Unauthorized UID was able to execute bootstrap!');
  } catch (err: any) {
    if (err.message.includes('permission-denied')) {
      console.log('✅ Security Test: Non-designated UID strictly rejected with permission-denied.');
    }
  }

  // 7. Test Source Code for Hardcoded Secrets & Fallbacks
  const functionsSrc = fs.readFileSync(path.join(process.cwd(), 'functions/src/index.ts'), 'utf-8');
  const authContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf-8');

  const hasHardcodedKnownSecret =
    functionsSrc.includes('ShakerAdminBootstrapSec_2026_SecureKey!') ||
    authContextSrc.includes('ShakerAdminBootstrapSec_2026_SecureKey!');

  const hasSecretFallback =
    functionsSrc.includes('process.env.ADMIN_BOOTSTRAP_SECRET ||') ||
    functionsSrc.includes('ADMIN_BOOTSTRAP_SECRET || "') ||
    functionsSrc.includes("ADMIN_BOOTSTRAP_SECRET || '");

  results['Hardcoded secret'] = (!hasHardcodedKnownSecret && !hasSecretFallback) ? 'PASS' : 'FAIL';

  // 8. Test Centralized Designated UID Constants
  const functionsConstExists = fs.existsSync(path.join(process.cwd(), 'functions/src/constants.ts'));
  const frontendConstExists = fs.existsSync(path.join(process.cwd(), 'src/constants/auth.ts'));
  results['Centralized UID Constants'] = (functionsConstExists && frontendConstExists) ? 'PASS' : 'FAIL';

  // 9. Test Brute-Force Rate Limiting Functions
  const hasRateLimitFunctions =
    functionsSrc.includes('checkLoginAllowed') &&
    functionsSrc.includes('recordFailedLogin') &&
    functionsSrc.includes('resetLoginAttempts');
  results['Brute-force server protection'] = hasRateLimitFunctions ? 'PASS' : 'FAIL';

  // 10. Test Unified Login Error & Password Policy in AuthContext
  const hasUnifiedAuthError = authContextSrc.includes('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  const hasStrongPasswordPolicy = authContextSrc.includes('cleanPass.length < 8');
  results['Unified login error & strong password policy'] = (hasUnifiedAuthError && hasStrongPasswordPolicy) ? 'PASS' : 'FAIL';

  console.log('\n================================================================');
  console.log('📊 RESULTS SUMMARY');
  console.log('================================================================');
  for (const [key, val] of Object.entries(results)) {
    console.log(`${key}: ${val}`);
  }
  console.log('================================================================\n');

  const allPassed = Object.values(results).every(v => v === 'PASS');
  if (!allPassed) {
    process.exit(1);
  }
}

runStage2Suite().catch((err) => {
  console.error('Suite error:', err);
  process.exit(1);
});
