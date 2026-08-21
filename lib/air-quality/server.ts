import "server-only";

import {
  isRawAqiReading,
  isRawOfficialAqiReading,
  normalizeAqiReading,
  normalizeOfficialAqiReading,
} from "@/lib/air-quality/normalize";
import type {
  RawAqiReading,
  RawOfficialAqiReading,
} from "@/lib/air-quality/normalize";
import type {
  AirQualityObservation,
  SourceType,
} from "@/lib/air-quality/types";
import type { AirQualityReportRecord } from "@/lib/air-quality/reports";
import { createClient } from "@/utils/supabase/server";

const MAX_ELIGIBLE_READINGS_PER_TABLE = 1_000;
const REPORT_PAGE_SIZE = 1_000;
const REPORT_MAX_ROWS_PER_SOURCE = 25_000;
const REPORT_START_TIMESTAMP = "2026-07-16T16:00:00.000Z";
const REPORT_END_TIMESTAMP = "2026-08-18T15:59:59.999Z";

export interface AirQualityFetchResult {
  observations: AirQualityObservation[];
  unavailableSources: SourceType[];
}

function selectLatestPerSourceId<T>(
  readings: T[],
  getSourceId: (reading: T) => string,
  getObservedAt: (reading: T) => string,
): T[] {
  const latestBySourceId = new Map<string, T>();

  for (const reading of readings) {
    const sourceId = getSourceId(reading);
    const currentLatest = latestBySourceId.get(sourceId);

    if (
      !currentLatest ||
      Date.parse(getObservedAt(reading)) >
        Date.parse(getObservedAt(currentLatest))
    ) {
      latestBySourceId.set(sourceId, reading);
    }
  }

  return Array.from(latestBySourceId.values());
}

export async function fetchAirQualityObservations(
  targetTime?: Date,
): Promise<AirQualityFetchResult> {
  const supabase = await createClient();
  let communityQuery = supabase
    .schema("public")
    .from("aqi_readings")
    .select("sensor_id, lat, lng, pm25, pm10, created_at")
    .order("created_at", { ascending: false })
    .order("sensor_id", { ascending: true })
    .limit(MAX_ELIGIBLE_READINGS_PER_TABLE);
  let officialQuery = supabase
    .schema("public")
    .from("official_aqi_readings")
    .select(
      "station_id, station_name, lat, lng, pm25, pm10, o3, no2, co, so2, observed_at",
    )
    .order("observed_at", { ascending: false })
    .order("station_id", { ascending: true })
    .limit(MAX_ELIGIBLE_READINGS_PER_TABLE);

  if (targetTime) {
    const timestamp = targetTime.toISOString();
    communityQuery = communityQuery.lte("created_at", timestamp);
    officialQuery = officialQuery.lte("observed_at", timestamp);
  }

  const [communityResult, officialResult] = await Promise.all([
    communityQuery,
    officialQuery,
  ]);
  const unavailableSources: SourceType[] = [];

  if (communityResult.error) {
    console.error("[Supabase Fetch Error]:", communityResult.error);
    unavailableSources.push("community");
  }
  if (officialResult.error) {
    console.error("[Supabase Fetch Error]:", officialResult.error);
    unavailableSources.push("official");
  }

  const communityReadings: RawAqiReading[] = communityResult.error
    ? []
    : (communityResult.data ?? []).filter(isRawAqiReading);
  const officialReadings: RawOfficialAqiReading[] = officialResult.error
    ? []
    : (officialResult.data ?? []).filter(isRawOfficialAqiReading);

  const communityObservations = selectLatestPerSourceId(
    communityReadings,
    (reading) => reading.sensor_id,
    (reading) => reading.created_at,
  ).map(normalizeAqiReading);
  const officialObservations = selectLatestPerSourceId(
    officialReadings,
    (reading) => reading.station_id,
    (reading) => reading.observed_at,
  ).map(normalizeOfficialAqiReading);

  return {
    observations: [...communityObservations, ...officialObservations],
    unavailableSources,
  };
}

async function fetchReportPages(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: unknown[]; error: unknown | null }> {
  const data: unknown[] = [];

  for (
    let from = 0;
    from < REPORT_MAX_ROWS_PER_SOURCE;
    from += REPORT_PAGE_SIZE
  ) {
    const result = await fetchPage(from, from + REPORT_PAGE_SIZE - 1);

    if (result.error) return { data, error: result.error };

    const page = result.data ?? [];
    data.push(...page);
    if (page.length < REPORT_PAGE_SIZE) break;
  }

  return { data, error: null };
}

export async function fetchAirQualityReportRecords(): Promise<
  AirQualityReportRecord[]
> {
  const supabase = await createClient();

  const [communityResult, officialResult] = await Promise.all([
    fetchReportPages(async (from, to) =>
      supabase
        .schema("public")
        .from("aqi_readings")
        .select("sensor_id, lat, lng, pm25, pm10, created_at")
        .gte("created_at", REPORT_START_TIMESTAMP)
        .lte("created_at", REPORT_END_TIMESTAMP)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
    fetchReportPages(async (from, to) =>
      supabase
        .schema("public")
        .from("official_aqi_readings")
        .select("station_id, station_name, lat, lng, pm25, pm10, o3, no2, co, so2, observed_at")
        .gte("observed_at", REPORT_START_TIMESTAMP)
        .lte("observed_at", REPORT_END_TIMESTAMP)
        .order("observed_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (communityResult.error) {
    console.error("[Supabase Report Fetch Error]:", communityResult.error);
  }
  if (officialResult.error) {
    console.error("[Supabase Report Fetch Error]:", officialResult.error);
  }

  const communityRows: AirQualityReportRecord[] = communityResult.error
    ? []
    : (communityResult.data ?? [])
        .filter(isRawAqiReading)
        .map((reading) => ({
          timestamp: reading.created_at,
          stationId: reading.sensor_id,
          stationName: reading.sensor_id,
          stationType: "community_sensor",
          locationName: reading.sensor_id,
          sourceType: "community" as const,
          pm25: reading.pm25,
          pm10: reading.pm10,
          dataStatus: "observed" as const,
        }));
  const officialRows: AirQualityReportRecord[] = officialResult.error
    ? []
    : (officialResult.data ?? [])
        .filter(isRawOfficialAqiReading)
        .map((reading) => ({
          timestamp: reading.observed_at,
          stationId: reading.station_id,
          stationName: reading.station_name ?? reading.station_id,
          stationType: "official_macro_station",
          locationName: reading.station_name ?? reading.station_id,
          sourceType: "official" as const,
          pm25: reading.pm25,
          pm10: reading.pm10,
          dataStatus: "observed" as const,
        }));

  return [...officialRows, ...communityRows].sort(
    (first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp),
  );
}
