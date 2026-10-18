import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/config';

export interface FunctionCallResult<T = any> {
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
      } catch (err: any) {
        console.error(`[Firebase Functions] Call to "${name}" failed:`, err?.message || err);
        const errorMsg = err?.details || err?.message || `فشل تنفيذ العملية السحابية (${name}).`;
        return {
          success: false,
          error: errorMsg,
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
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'خطأ أثناء التشغيل المحلي التجريبي',
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

  public async createBookingSecure(params: any): Promise<FunctionCallResult> {
    return this.invokeCallable('createBookingSecure', params);
  }

  public async updateBookingStatusSecure(params: { bookingId: string; status: string; bookingNumber?: string }): Promise<FunctionCallResult> {
    return this.invokeCallable('updateBookingStatusSecure', params);
  }

  public async sendBookingNotification(params: { bookingId: string; [key: string]: any }): Promise<FunctionCallResult> {
    return this.invokeCallable('sendBookingNotification', params);
  }

  public async getVehicleAvailability(params: { vehicleId: string; from?: string; to?: string; fromTime?: string; toTime?: string }): Promise<FunctionCallResult> {
    return this.invokeCallable('getVehicleAvailability', params);
  }

  public async generateRentalContractPdf(params: { contractId?: string; bookingId?: string }): Promise<FunctionCallResult> {
    return this.invokeCallable('generateRentalContractPdf', params);
  }

  public async calculateDynamicPricing(params: { days: number; vehicleId: string; withDriver?: boolean }): Promise<FunctionCallResult> {
    return this.invokeCallable('calculateDynamicPricing', params);
  }

  public async updateSettingsSecure(params: any): Promise<FunctionCallResult> {
    return this.invokeCallable('updateSettingsSecure', params);
  }

  public async recordPaymentSecure(params: {
    bookingId: string;
    amount: number;
    method?: string;
    notes?: string;
    referenceNumber?: string;
  }): Promise<FunctionCallResult> {
    return this.invokeCallable('recordPaymentSecure', params);
  }

  public async syncFleetMaintenance(): Promise<FunctionCallResult> {
    return this.invokeCallable('syncFleetMaintenance', {});
  }

  public async setUserRole(params: { targetUid: string; newRole: string }): Promise<FunctionCallResult> {
    return this.invokeCallable('setUserRole', params);
  }

  public async toggleUserAccountStatus(params: { targetUid: string; disabled: boolean }): Promise<FunctionCallResult> {
    return this.invokeCallable('toggleUserAccountStatus', params);
  }

  public async deleteUserAccount(params: { targetUid: string }): Promise<FunctionCallResult> {
    return this.invokeCallable('deleteUserAccount', params);
  }

  public async syncMyRole(): Promise<FunctionCallResult> {
    return this.invokeCallable('syncMyRole', {});
  }

  public async verifyCustomerIdentity(params: any): Promise<FunctionCallResult> {
    return this.invokeCallable('verifyCustomerIdentity', params);
  }
}

export const functionsService = new FunctionsService();
