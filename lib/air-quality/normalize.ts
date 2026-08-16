import type { AirQualityObservation } from "@/lib/air-quality/types";

export interface RawAqiReading {
  sensor_id: string;
  lat: number;
  lng: number;
  pm25: number | null;
  pm10: number | null;
  created_at: string;
}

export interface RawOfficialAqiReading {
  station_id: string;
  station_name: string | null;
  lat: number;
  lng: number;
  pm25: number | null;
  pm10: number | null;
  observed_at: string;
}

function hasValidMeasurement(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function hasValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function isRawAqiReading(row: unknown): row is RawAqiReading {
  if (typeof row !== "object" || row === null) return false;

  const reading = row as Record<string, unknown>;
  return (
    typeof reading.sensor_id === "string" &&
    reading.sensor_id.length > 0 &&
    hasValidCoordinates(reading.lat, reading.lng) &&
    hasValidMeasurement(reading.pm25) &&
    hasValidMeasurement(reading.pm10) &&
    typeof reading.created_at === "string" &&
    Number.isFinite(Date.parse(reading.created_at))
  );
}

export function isRawOfficialAqiReading(
  row: unknown,
): row is RawOfficialAqiReading {
  if (typeof row !== "object" || row === null) return false;

  const reading = row as Record<string, unknown>;

  return (
    typeof reading.station_id === "string" &&
    reading.station_id.length > 0 &&
    (reading.station_name === null ||
      typeof reading.station_name === "string") &&
    hasValidCoordinates(reading.lat, reading.lng) &&
    hasValidMeasurement(reading.pm25) &&
    hasValidMeasurement(reading.pm10) &&
    typeof reading.observed_at === "string" &&
    Number.isFinite(Date.parse(reading.observed_at))
  );
}

export function normalizeAqiReading(
  row: RawAqiReading,
): AirQualityObservation {
  return {
    sourceType: "community",
    sourceId: row.sensor_id,
    stationName: row.sensor_id,
    latitude: row.lat,
    longitude: row.lng,
    pm25: row.pm25,
    pm10: row.pm10,
    observedAt: row.created_at,
  };
}

export function normalizeOfficialAqiReading(
  row: RawOfficialAqiReading,
): AirQualityObservation {
  return {
    sourceType: "official",
    sourceId: row.station_id,
    stationName: row.station_name ?? undefined,
    latitude: row.lat,
    longitude: row.lng,
    pm25: row.pm25,
    pm10: row.pm10,
    observedAt: row.observed_at,
  };
}
