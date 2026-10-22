import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase/config';

export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Firebase Analytics Service for Shaker Car Rental
 * Tracks user actions, booking steps, car views, contract signing, and conversion metrics
 */
class AnalyticsService {
  private eventLog: Array<{ eventName: string; params?: AnalyticsEventParams; timestamp: string }> = [];

  /**
   * Log an event to Firebase Analytics with safety checks
   */
  public log(eventName: string, params?: AnalyticsEventParams) {
    const timestamp = new Date().toISOString();
    this.eventLog.unshift({ eventName, params, timestamp });
    if (this.eventLog.length > 50) this.eventLog.pop();

    try {
      if (analytics) {
        logEvent(analytics, eventName, params);
      }
      if (import.meta.env.DEV) {
        console.debug(`[Firebase Analytics] 📊 ${eventName}`, params || {});
      }
    } catch (err) {
      console.warn(`[Firebase Analytics] Could not log event ${eventName}:`, err);
    }
  }

  // --- Specialized Events ---

  public trackPageView(pageName: string) {
    this.log('page_view', { page_title: pageName, page_location: window.location.href });
  }

  public trackCarViewed(carId: string, carName: string, category: string, pricePerDay: number) {
    this.log('view_item', {
      item_id: carId,
      item_name: carName,
      item_category: category,
      price: pricePerDay,
      currency: 'USD',
    });
  }

  public trackBookingStarted(carId: string, carName: string, days: number, totalPrice: number) {
    this.log('begin_checkout', {
      item_id: carId,
      item_name: carName,
      rental_days: days,
      value: totalPrice,
      currency: 'USD',
    });
  }

  public trackBookingCompleted(bookingId: string, carId: string, totalPrice: number, days: number) {
    this.log('purchase', {
      transaction_id: bookingId,
      value: totalPrice,
      currency: 'USD',
      item_id: carId,
      rental_days: days,
    });
  }

  public trackDocumentUploaded(category: string, fileType: string, fileSize: number) {
    this.log('document_uploaded', {
      document_category: category,
      file_type: fileType,
      file_size_bytes: fileSize,
    });
  }

  public trackContractSigned(contractId: string, totalAmount: number) {
    this.log('contract_signed', {
      contract_id: contractId,
      value: totalAmount,
      currency: 'USD',
    });
  }

  public trackUserLogin(method: string, userRole: string) {
    this.log('login', { method, user_role: userRole });
  }

  public trackUserSignUp(method: string) {
    this.log('sign_up', { method });
  }

  /**
   * Get recently logged events for the admin audit inspector
   */
  public getRecentEvents() {
    return this.eventLog;
  }
}

export const analyticsService = new AnalyticsService();
