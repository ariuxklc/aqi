export type FreshnessStatus = {
  label: "Recent" | "Stale" | "No recent data";
  colorClass: string;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function getFreshnessStatus(
  observedAt: string,
  referenceTime?: string,
): FreshnessStatus {
  const observedTime = Date.parse(observedAt);
  const referenceTimestamp = referenceTime
    ? Date.parse(referenceTime)
    : Date.now();

  if (!Number.isFinite(observedTime) || !Number.isFinite(referenceTimestamp)) {
    return {
      label: "No recent data",
      colorClass: "bg-zinc-700 text-zinc-200",
    };
  }

  const age = referenceTimestamp - observedTime;

  if (age < 0) {
    return {
      label: "No recent data",
      colorClass: "bg-zinc-700 text-zinc-200",
    };
  }

  if (age < TWO_HOURS_MS) {
    return {
      label: "Recent",
      colorClass: "bg-emerald-500/20 text-emerald-300",
    };
  }

  if (age <= TWENTY_FOUR_HOURS_MS) {
    return {
      label: "Stale",
      colorClass: "bg-amber-500/20 text-amber-300",
    };
  }

  return {
    label: "No recent data",
    colorClass: "bg-zinc-700 text-zinc-200",
  };
}
