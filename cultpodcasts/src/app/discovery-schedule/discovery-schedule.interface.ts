export interface DiscoveryScheduleNextRun {
  /** Display label such as `2026-10-08 22:30 UK`. */
  slotId: string;
  /** UTC instant (`...Z` on the wire); `JsonDateInterceptor` turns it into a `Date`. */
  slotStartUtc: Date | string;
  /**
   * UK local wall-clock time with its UK offset (`+01:00` BST, `+00:00` GMT). Exception to UTC-only: run times are
   * set in local time, so `JsonDateInterceptor` leaves this as text to keep the offset.
   */
  slotStartUk: string;
}

export interface DiscoverySchedule {
  runTimes: string[];
  timeZoneId: string;
  enabled: boolean;
  isDefault: boolean;
  nextRuns: DiscoveryScheduleNextRun[];
}

export interface DiscoveryScheduleUpdate {
  runTimes: string[];
  enabled: boolean;
  timeZoneId?: string;
}
