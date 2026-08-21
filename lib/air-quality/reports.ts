import { PROPOSED_COMMUNITY_NODES } from "@/lib/air-quality/proposed";
import type { SourceType } from "@/lib/air-quality/types";

export const REPORT_MIN_DATE = "2026-07-17";
export const REPORT_MAX_DATE = "2026-08-18";

export interface AirQualityReportRecord {
  timestamp: string;
  stationId: string;
  stationName: string;
  stationType: string;
  locationName: string;
  sourceType: SourceType;
  pm25: number | null;
  pm10: number | null;
  dataStatus: "observed" | "simulated";
}

function getUlaanbaatarHour(timestamp: Date): number {
  const shifted = new Date(timestamp.getTime() + 8 * 60 * 60 * 1000);
  return shifted.getUTCHours();
}

function getScenarioMultiplier(hour: number): number {
  if (hour >= 6 && hour <= 9) return 1.22;
  if (hour >= 18 && hour <= 22) return 1.3;
  if (hour >= 0 && hour <= 5) return 1.14;
  return 0.86;
}

/**
 * Creates an explicitly simulated, hourly proposal dataset for export previews.
 * Values model neighborhood-scale variation and are never read from Supabase.
 */
export function createProposedCommunityReportRecords(
  startDate: string,
  endDate: string,
): AirQualityReportRecord[] {
  const start = new Date(`${startDate}T00:00:00+08:00`);
  const end = new Date(`${endDate}T23:00:00+08:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const records: AirQualityReportRecord[] = [];

  for (
    let timestamp = start;
    timestamp.getTime() <= end.getTime();
    timestamp = new Date(timestamp.getTime() + 60 * 60 * 1000)
  ) {
    const multiplier = getScenarioMultiplier(getUlaanbaatarHour(timestamp));

    for (const node of PROPOSED_COMMUNITY_NODES) {
      records.push({
        timestamp: timestamp.toISOString(),
        stationId: node.id,
        stationName: node.name,
        stationType: "proposed_community_node",
        locationName: node.neighborhood,
        sourceType: "community",
        pm25: Math.round(node.pm25 * multiplier * 10) / 10,
        pm10: Math.round(node.pm10 * multiplier * 10) / 10,
        dataStatus: "simulated",
      });
    }
  }

  return records;
}
