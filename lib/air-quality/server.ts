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
import { createClient } from "@/utils/supabase/server";

const MAX_ELIGIBLE_READINGS_PER_TABLE = 1_000;

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
