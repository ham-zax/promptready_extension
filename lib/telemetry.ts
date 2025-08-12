import { Storage } from './storage.js';
import type { TelemetryEvent } from './types.js';

/**
 * Minimal opt-in telemetry helper.
 * Delegates to Storage to persist events locally. No content/URLs collected.
 */
export class Telemetry {
  /** Record an event if telemetry is enabled in settings. */
  static async record(event: Omit<TelemetryEvent, 'timestamp'> & { timestamp?: string }) {
    const payload: TelemetryEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    } as TelemetryEvent;
    await Storage.recordTelemetry(payload);
  }

  /** Retrieve all stored events (for debugging/QA). */
  static async getAll(): Promise<TelemetryEvent[]> {
    return Storage.getTelemetryEvents();
  }

  /** Clear all stored events. */
  static async clear(): Promise<void> {
    await Storage.clearTelemetry();
  }
}
