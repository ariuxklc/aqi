export type SourceType = "official" | "community";
export type ObservationDataStatus = "observed" | "simulated";

export interface AirQualityObservation {
  sourceType: SourceType;
  sourceId: string;
  latitude: number;
  longitude: number;
  pm25: number | null;
  pm10: number | null;
  o3?: number | null;
  no2?: number | null;
  co?: number | null;
  so2?: number | null;
  observedAt: string;
  stationName?: string;
  /** Explicitly identifies scenario data so it is never presented as a measured reading. */
  dataStatus?: ObservationDataStatus;
}
