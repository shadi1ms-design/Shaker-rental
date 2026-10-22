import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/config';
import { getArabicErrorMessage } from '../utils/firebaseErrorHandler';
import { IdentityVerificationParams, IdentityVerificationResult, SettingsPayload } from '../types';

export interface FunctionCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'live_cloud_function' | 'local_demo_sandbox';
  executionTimeMs: number;
}

class FunctionsService {
  /**
   * Universal callable invoker. In live environment, calls live Cloud Functions directly.
   * Eliminates sandbox fallback in production.
   */
  private async invokeCallable<TInput, TOutput>(
    name: string,
    payload: TInput,
    devFallback?: (input: TInput) => Promise<TOutput>
  ): Promise<FunctionCallResult<TOutput>> {
    const start = Date.now();

    if (isFirebaseConfigured && functions) {
      try {
        const callable = httpsCallable<TInput, TOutput>(functions, name);
        const res = await callable(payload);
        return {
          success: true,
          data: res.data,
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err));
        console.error(`[Firebase Functions] Call to "${name}" failed:`, errMsg);
        return {
          success: false,
          error: getArabicErrorMessage(err),
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      }
    }

    // Local Demo mode strictly in DEV environment
    if (import.meta.env.DEV && devFallback) {
      try {
        const simulated = await devFallback(payload);
        return {
          success: true,
          data: simulated,
          source: 'local_demo_sandbox',
          executionTimeMs: Date.now() - start,
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err));
        return {
          success: false,
          error: errMsg || 'خطأ أثناء التشغيل المحلي التجريبي',
          source: 'local_demo_sandbox',
          executionTimeMs: Date.now() - start,
        };
      }
    }

    return {
      success: false,
      error: 'خدمة الدوال السحابية غير متصلة بالبيئة الحية.',
      source: 'live_cloud_function',
      executionTimeMs: Date.now() - start,
    };
  }

  public async createBookingSecure(params: Record<string, unknown>): Promise<FunctionCallResult<{ booking?: unknown; success?: boolean; error?: string; bookingId?: string; bookingNumber?: string }>> {
    return this.invokeCallable('createBookingSecure', params);
  }

  public async updateBookingStatusSecure(params: { bookingId: string; status: string; bookingNumber?: string }): Promise<FunctionCallResult<{ success?: boolean }>> {
    return this.invokeCallable('updateBookingStatusSecure', params);
  }

  public async deleteBookingSecure(params: { bookingId: string; bookingNumber?: string }): Promise<FunctionCallResult<{ success?: boolean }>> {
    return this.invokeCallable('deleteBookingSecure', params);
  }

  public async sendBookingNotification(params: { bookingId: string; [key: string]: unknown }): Promise<FunctionCallResult<{ success?: boolean }>> {
    return this.invokeCallable('sendBookingNotification', params);
  }

  public async getVehicleAvailability(params: { vehicleId: string; from?: string; to?: string; fromTime?: string; toTime?: string }): Promise<FunctionCallResult<{ available?: boolean; conflictReason?: string }>> {
    return this.invokeCallable('getVehicleAvailability', params);
  }

  public async generateRentalContractPdf(params: { contractId?: string; bookingId?: string }): Promise<FunctionCallResult<{ contract?: unknown; contractId?: string }>> {
    return this.invokeCallable('generateRentalContractPdf', params);
  }

  public async calculateDynamicPricing(params: { days: number; vehicleId: string; withDriver?: boolean }): Promise<FunctionCallResult<{ basePrice?: number; discount?: number; totalPrice?: number; insuranceAmount?: number }>> {
    return this.invokeCallable('calculateDynamicPricing', params);
  }

  public async updateSettingsSecure(params: SettingsPayload): Promise<FunctionCallResult<{ success?: boolean; settings?: unknown }>> {
    return this.invokeCallable<SettingsPayload, { success?: boolean; settings?: unknown }>('updateSettingsSecure', params);
  }

  public async verifyContractCode(params: { contractNumber: string; verificationCode: string }): Promise<FunctionCallResult<{ verified?: boolean; contract?: unknown }>> {
    return this.invokeCallable('verifyContractCode', params);
  }

  public async setUserRole(params: { targetUid: string; newRole: string }): Promise<FunctionCallResult<{ success?: boolean; role?: string }>> {
    return this.invokeCallable('setUserRole', params);
  }

  public async toggleUserAccountStatus(params: { targetUid: string; disabled: boolean }): Promise<FunctionCallResult<{ success?: boolean }>> {
    return this.invokeCallable('toggleUserAccountStatus', params);
  }

  public async deleteUserAccount(params: { targetUid: string }): Promise<FunctionCallResult<{ success?: boolean }>> {
    return this.invokeCallable('deleteUserAccount', params);
  }

  public async syncMyRole(): Promise<FunctionCallResult<{ role: string }>> {
    return this.invokeCallable('syncMyRole', {});
  }

  public async verifyCustomerIdentity(params: IdentityVerificationParams): Promise<FunctionCallResult<IdentityVerificationResult>> {
    return this.invokeCallable<IdentityVerificationParams, IdentityVerificationResult>('verifyCustomerIdentity', params);
  }
}

export const functionsService = new FunctionsService();
