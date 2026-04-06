import { Injectable } from '@angular/core';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Service for application logging
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private isProduction = false;

  constructor() {
    // Check if running in production
    this.isProduction = !this.isDevelopment();
  }

  /**
   * Check if running in development
   */
  private isDevelopment(): boolean {
    return !document.location.hostname.match(/localhost|127\.0\.0\.1/);
  }

  /**
   * Debug log
   */
  debug(message: string, data?: any): void {
    if (!this.isProduction) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  /**
   * Info log
   */
  info(message: string, data?: any): void {
    console.info(`[INFO] ${message}`, data);
  }

  /**
   * Warning log
   */
  warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data);
  }

  /**
   * Error log
   */
  error(message: string, error?: Error | any): void {
    console.error(`[ERROR] ${message}`, error);
    
    // In production, you might want to send errors to a logging service
    if (this.isProduction && error) {
      this.reportError(message, error);
    }
  }

  /**
   * Report error to external service (implement as needed)
   */
  private reportError(message: string, error: any): void {
    // TODO: Implement error reporting to external service
    // e.g., Sentry, LogRocket, etc.
  }
}
