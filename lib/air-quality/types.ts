export type SourceType = "official" | "community";

export interface AirQualityObservation {
  sourceType: SourceType;
  sourceId: string;
  latitude: number;
  longitude: number;
  pm25: number | null;
  pm10: number | null;
  observedAt: string;
  stationName?: string;
}
