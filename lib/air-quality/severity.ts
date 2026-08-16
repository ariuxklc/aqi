export type AirQualityMetric = "pm25" | "pm10";

export type PollutionSeverityCode =
  | "unavailable"
  | "good"
  | "moderate"
  | "sensitive"
  | "unhealthy";

export interface MetricThresholds {
  goodMax: number;
  moderateMax: number;
  sensitiveMax: number;
}

export interface PollutionSeverity {
  code: PollutionSeverityCode;
  label:
    | "Unavailable"
    | "Good"
    | "Moderate"
    | "Unhealthy for Sensitive"
    | "Unhealthy";
  colorName: "Zinc" | "Green" | "Yellow" | "Orange" | "Red";
  hex: `#${string}`;
  rgb: Readonly<{ red: number; green: number; blue: number }>;
}

const METRIC_THRESHOLDS: Record<AirQualityMetric, MetricThresholds> = {
  pm25: { goodMax: 12, moderateMax: 35.4, sensitiveMax: 55.4 },
  pm10: { goodMax: 54, moderateMax: 154, sensitiveMax: 254 },
};

const UNAVAILABLE: PollutionSeverity = {
  code: "unavailable",
  label: "Unavailable",
  colorName: "Zinc",
  hex: "#71717a",
  rgb: { red: 113, green: 113, blue: 122 },
};

const GOOD: PollutionSeverity = {
  code: "good",
  label: "Good",
  colorName: "Green",
  hex: "#22c55e",
  rgb: { red: 34, green: 197, blue: 94 },
};

const MODERATE: PollutionSeverity = {
  code: "moderate",
  label: "Moderate",
  colorName: "Yellow",
  hex: "#eab308",
  rgb: { red: 234, green: 179, blue: 8 },
};

const SENSITIVE: PollutionSeverity = {
  code: "sensitive",
  label: "Unhealthy for Sensitive",
  colorName: "Orange",
  hex: "#f97316",
  rgb: { red: 249, green: 115, blue: 22 },
};

const UNHEALTHY: PollutionSeverity = {
  code: "unhealthy",
  label: "Unhealthy",
  colorName: "Red",
  hex: "#ef4444",
  rgb: { red: 239, green: 68, blue: 68 },
};

export function getMetricThresholds(
  metric: AirQualityMetric,
): MetricThresholds {
  return METRIC_THRESHOLDS[metric];
}

export function getPollutionSeverity(
  value: number | null,
  metric: AirQualityMetric = "pm25",
): PollutionSeverity {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return UNAVAILABLE;
  }

  const thresholds = METRIC_THRESHOLDS[metric];
  if (value <= thresholds.goodMax) return GOOD;
  if (value <= thresholds.moderateMax) return MODERATE;
  if (value <= thresholds.sensitiveMax) return SENSITIVE;
  return UNHEALTHY;
}
