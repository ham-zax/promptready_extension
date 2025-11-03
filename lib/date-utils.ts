// Date formatting utilities with ISO 8601 support and timezone handling
// Provides consistent, locale-aware date formatting across the application

export interface DateFormattingOptions {
  locale?: string;
  timezone?: string;
  format?: 'iso8601' | 'locale' | 'custom';
  customFormat?: string;
  includeTime?: boolean;
  includeTimezone?: boolean;
}

export interface TimeZoneInfo {
  id: string;
  name: string;
  offset: number;
  offsetString: string;
  isDST: boolean;
  currentTime: Date;
}

export interface LocaleInfo {
  code: string;
  name: string;
  region: string;
  dateFormat: Intl.DateTimeFormatOptions;
}

export class DateUtils {
  private static readonly DEFAULT_LOCALE = 'en-US';
  private static readonly DEFAULT_TIMEZONE = 'UTC';
  private static readonly ISO_8601_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSxxx";

  /**
   * Format date according to specified options
   */
  static formatDate(date: Date | string, options: DateFormattingOptions = {}): string {
    if (typeof date === 'string') {
      return date; // Already formatted
    }

    const {
      locale = DateUtils.DEFAULT_LOCALE,
      timezone = DateUtils.DEFAULT_TIMEZONE,
      format = 'iso8601',
      includeTime = true,
      includeTimezone = false,
      customFormat
    } = options;

    try {
      // Get timezone-aware date
      const timezoneAwareDate = this.getTimezoneAwareDate(date, timezone);

      switch (format) {
        case 'iso8601':
          return this.formatISO8601(timezoneAwareDate, timezone, includeTimezone);

        case 'locale':
          return this.formatLocale(timezoneAwareDate, locale, includeTime);

        case 'custom':
          if (customFormat) {
            return this.formatCustom(timezoneAwareDate, customFormat, locale);
          }
          // Fall back to ISO 8601 if custom format is invalid
          return this.formatISO8601(timezoneAwareDate, timezone, includeTimezone);

        default:
          return this.formatISO8601(timezoneAwareDate, timezone, includeTimezone);
      }
    } catch (error) {
      console.warn('[DateUtils] Failed to format date:', error);
      return date.toISOString();
    }
  }

  /**
   * Format date in ISO 8601 format with timezone support
   */
  static formatISO8601(date: Date, timezone: string = 'UTC', includeTimezone: boolean = false): string {
    if (timezone === 'UTC' || !includeTimezone) {
      // Simple UTC ISO 8601
      return date.toISOString();
    }

    // Get timezone information
    const timezoneInfo = this.getTimezoneInfo(date, timezone);
    const localDate = this.convertToTimezone(date, timezone);

    // Format with timezone offset
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    const milliseconds = String(localDate.getMilliseconds()).padStart(3, '0');

    const offsetString = timezoneInfo.offsetString;

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetString}`;
  }

  /**
   * Format date according to locale conventions
   */
  static formatLocale(date: Date, locale: string = 'en-US', includeTime: boolean = true): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: includeTime ? 'numeric' : undefined,
        minute: includeTime ? 'numeric' : undefined,
        second: includeTime ? 'numeric' : undefined,
        timeZone: this.getUserTimezone()
      };

      const formatter = new Intl.DateTimeFormat(locale, options);
      return formatter.format(date);
    } catch (error) {
      console.warn('[DateUtils] Failed to format locale date:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * Format date with custom format string
   */
  static formatCustom(date: Date, format: string, locale: string = 'en-US'): string {
    try {
      // Simple format string replacement (basic implementation)
      // Supports: yyyy, MM, dd, HH, mm, ss, SSS
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      const milliseconds = date.getMilliseconds();

      return format
        .replace(/yyyy/g, String(year))
        .replace(/MM/g, String(month).padStart(2, '0'))
        .replace(/dd/g, String(day).padStart(2, '0'))
        .replace(/HH/g, String(hours).padStart(2, '0'))
        .replace(/mm/g, String(minutes).padStart(2, '0'))
        .replace(/ss/g, String(seconds).padStart(2, '0'))
        .replace(/SSS/g, String(milliseconds).padStart(3, '0'));
    } catch (error) {
      console.warn('[DateUtils] Failed to format custom date:', error);
      return date.toISOString();
    }
  }

  /**
   * Get timezone information
   */
  static getTimezoneInfo(date: Date, timezone: string): TimeZoneInfo {
    try {
      // Use Intl API for timezone information
      const timeZone = timezone || this.getUserTimezone();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short'
      });

      const formattedDate = formatter.format(date);

      // Parse timezone offset
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const localDate = new Date(date.toLocaleString('en-US', { timeZone }));
      const offsetMinutes = (localDate.getTime() - utcDate.getTime()) / (1000 * 60);

      // Convert offset to hours and minutes
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetMins = Math.abs(offsetMinutes) % 60;
      const offsetSign = offsetMinutes >= 0 ? '+' : '-';
      const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;

      return {
        id: timeZone,
        name: this.getTimezoneName(timeZone),
        offset: offsetMinutes,
        offsetString,
        isDST: this.isDST(timeZone, date),
        currentTime: date
      };
    } catch (error) {
      console.warn('[DateUtils] Failed to get timezone info:', error);
      // Fallback to basic timezone calculation
      return {
        id: timezone,
        name: timezone,
        offset: 0,
        offsetString: '+00:00',
        isDST: false,
        currentTime: date
      };
    }
  }

  /**
   * Get locale information
   */
  static getLocaleInfo(locale: string = 'en-US'): LocaleInfo {
    try {
      const localeParts = locale.split('-');
      const language = localeParts[0];
      const region = localeParts[1] || '';

      const formatter = new Intl.DateTimeFormat(locale);
      const resolved = formatter.resolvedOptions();

      return {
        code: locale,
        name: locale,
        region,
        dateFormat: resolved as any
      };
    } catch (error) {
      console.warn('[DateUtils] Failed to get locale info:', error);
      return {
        code: locale,
        name: locale,
        region: '',
        dateFormat: {}
      };
    }
  }

  /**
   * Convert date to specific timezone
   */
  static convertToTimezone(date: Date, timezone: string): Date {
    try {
      // Use Intl API for timezone conversion
      const utcDate = new Date(date.toISOString());
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
      });

      const parts = formatter.formatToParts(utcDate);
      const dateParts = parts.reduce((acc, part) => {
        if (part.type === 'year') acc.year = part.value;
        if (part.type === 'month') acc.month = parseInt(part.value) - 1;
        if (part.type === 'day') acc.day = parseInt(part.value);
        if (part.type === 'hour') acc.hour = parseInt(part.value);
        if (part.type === 'minute') acc.minute = parseInt(part.value);
        return acc;
      }, {} as any);

      return new Date(Date.UTC(
        dateParts.year,
        dateParts.month,
        dateParts.day,
        dateParts.hour || 0,
        dateParts.minute || 0,
        0,
        0
      ));
    } catch (error) {
      console.warn('[DateUtils] Failed to convert timezone:', error);
      return date; // Fallback to original date
    }
  }

  /**
   * Get timezone-aware date
   */
  static getTimezoneAwareDate(date: Date, timezone: string): Date {
    if (timezone === 'UTC' || timezone === this.getUserTimezone()) {
      return date;
    }

    return this.convertToTimezone(date, timezone);
  }

  /**
   * Get user's timezone
   */
  static getUserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (error) {
      console.warn('[DateUtils] Failed to get user timezone:', error);
      return 'UTC';
    }
  }

  /**
   * Get timezone name
   */
  static getTimezoneName(timezone: string): string {
    try {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'long'
      });

      const parts = formatter.formatToParts(date);
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart?.value || timezone;
    } catch (error) {
      console.warn('[DateUtils] Failed to get timezone name:', error);
      return timezone;
    }
  }

  /**
   * Check if date is in DST
   */
  static isDST(timezone: string, date: Date): boolean {
    try {
      const january = new Date(date.getFullYear(), 0, 1);
      const july = new Date(date.getFullYear(), 6, 1);

      const janFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      });

      const julyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      });

      const januaryOffset = this.getTimezoneOffset(january, timezone);
      const julyOffset = this.getTimezoneOffset(july, timezone);

      // DST is in effect when offsets differ
      return januaryOffset !== julyOffset;
    } catch (error) {
      console.warn('[DateUtils] Failed to check DST:', error);
      return false;
    }
  }

  /**
   * Get timezone offset in minutes
   */
  static getTimezoneOffset(date: Date, timezone: string): number {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return Math.round((localDate.getTime() - utcDate.getTime()) / (1000 * 60));
    } catch (error) {
      console.warn('[DateUtils] Failed to get timezone offset:', error);
      return 0;
    }
  }

  /**
   * Format relative time
   */
  static formatRelativeTime(date: Date, locale: string = 'en-US'): string {
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto'
      });
      const diffDays = (date.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return rtf.format(Math.round(diffDays), 'day');
    } catch (error) {
      console.warn('[DateUtils] Failed to format relative time:', error);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.round(diffMs / (1000 * 60));

      if (diffMins < 60) {
        return `${diffMins} minutes ago`;
      } else if (diffMins < 1440) { // 24 hours
        const diffHours = Math.round(diffMins / 60);
        return `${diffHours} hours ago`;
      } else {
        const diffDays = Math.round(diffMins / 1440);
        return `${diffDays} days ago`;
      }
    }
  }

  /**
   * Parse date from various formats
   */
  static parseDate(dateString: string): Date | null {
    try {
      // Try ISO 8601 first
      const isoMatch = dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/);
      if (isoMatch) {
        return new Date(dateString);
      }

      // Try common formats
      const formats = [
        'MM/dd/yyyy',
        'dd/MM/yyyy',
        'yyyy-MM-dd',
        'MMM dd, yyyy',
        'MMMM dd, yyyy'
      ];

      for (const format of formats) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }

      return null;
    } catch (error) {
      console.warn('[DateUtils] Failed to parse date:', error);
      return null;
    }
  }

  /**
   * Format date for consistency across tests
   */
  static formatForTest(date: Date): string {
    return this.formatISO8601(date, 'UTC', true);
  }

  /**
   * Get common timezone list
   */
  static getCommonTimezones(): Array<{ id: string; name: string; offset: string }> {
    return [
      { id: 'UTC', name: 'Coordinated Universal Time', offset: '+00:00' },
      { id: 'America/New_York', name: 'Eastern Time (US)', offset: '-05:00' },
      { id: 'America/Los_Angeles', name: 'Pacific Time (US)', offset: '-08:00' },
      { id: 'America/Chicago', name: 'Central Time (US)', offset: '-06:00' },
      { id: 'America/Denver', name: 'Mountain Time (US)', offset: '-07:00' },
      { id: 'America/Phoenix', name: 'Mountain Time (no DST)', offset: '-07:00' },
      { id: 'Europe/London', name: 'Greenwich Mean Time', offset: '+00:00' },
      { id: 'Europe/Paris', name: 'Central European Time', offset: '+01:00' },
      { id: 'Europe/Berlin', name: 'Central European Time', offset: '+01:00' },
      { id: 'Asia/Tokyo', name: 'Japan Standard Time', offset: '+09:00' },
      { id: 'Asia/Shanghai', name: 'China Standard Time', offset: '+08:00' },
      { id: 'Asia/Dubai', name: 'Gulf Standard Time', offset: '+04:00' },
      { id: 'Asia/Kolkata', name: 'India Standard Time', offset: '+05:30' },
      { id: 'Australia/Sydney', name: 'Australian Eastern Time', offset: '+10:00' },
      { id: 'Pacific/Auckland', name: 'New Zealand Time', offset: '+12:00' }
    ];
  }

  /**
   * Validate timezone ID
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get best-guess timezone from browser
   */
  static detectUserTimezone(): string {
    try {
      // Try to detect from browser APIs
      if (typeof Intl !== 'undefined') {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      }

      // Fallback to system timezone detection
      const offset = new Date().getTimezoneOffset();
      const offsetHours = Math.abs(offset / 60);

      // Common timezone mapping based on offset
      const commonTimezones: { [key: string]: string } = {
        '-5': 'America/New_York',
        '-8': 'America/Los_Angeles',
        '-6': 'America/Chicago',
        '-7': 'America/Denver',
        '-10': 'Pacific/Auckland',
        '+0': 'Europe/London',
        '+1': 'Europe/Paris',
        '+9': 'Asia/Tokyo',
        '+8': 'Asia/Shanghai',
        '+5:30': 'Asia/Kolkata'
      };

      return commonTimezones[offsetHours.toString()] || 'UTC';
    } catch (error) {
      console.warn('[DateUtils] Failed to detect timezone:', error);
      return 'UTC';
    }
  }
}