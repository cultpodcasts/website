export interface DiscoveryScheduleNextRun {
  slotId: string;
  slotStartUtc: string;
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
