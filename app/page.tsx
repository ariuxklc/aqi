import { Suspense } from "react";

import DynamicAirQualityMap from "@/components/DynamicAirQualityMap";
import Sidebar from "@/components/Sidebar";
import TimeControls from "@/components/TimeControls";
import { fetchAirQualityObservations } from "@/lib/air-quality/server";
import type { AirQualityObservation } from "@/lib/air-quality/types";

interface PageSearchParams {
  timestamp?: string;
}

interface ObservationResult {
  observations: AirQualityObservation[];
  notice?: string;
  isDevelopmentFixture: boolean;
}

async function loadObservations(selectedTimestamp?: string): Promise<ObservationResult> {
  const targetTime = selectedTimestamp ? new Date(selectedTimestamp) : undefined;

  if (targetTime && Number.isNaN(targetTime.getTime())) {
    return {
      observations: [],
      notice: "The selected historical date is invalid.",
      isDevelopmentFixture: false,
    };
  }

  try {
    const { observations, unavailableSources } =
      await fetchAirQualityObservations(targetTime);

    if (observations.length > 0) {
      const sourceNotice = unavailableSources.length
        ? `${unavailableSources.map((source) => source[0].toUpperCase() + source.slice(1)).join(" and ")} observations are temporarily unavailable.`
        : undefined;

      return {
        observations,
        notice: sourceNotice,
        isDevelopmentFixture: false,
      };
    }

    if (unavailableSources.length > 0) {
      return {
        observations: [],
        notice: "Air-quality observations are temporarily unavailable.",
        isDevelopmentFixture: false,
      };
    }

    if (process.env.NODE_ENV === "development") {
      const { MOCK_OBSERVATIONS } = await import("@/lib/air-quality/mock");
      const fixturesAtSelectedTime = targetTime
        ? MOCK_OBSERVATIONS.filter(
            (observation) =>
              Date.parse(observation.observedAt) <= targetTime.getTime(),
          )
        : MOCK_OBSERVATIONS;

      if (fixturesAtSelectedTime.length === 0) {
        return {
          observations: [],
          notice: "No observations were available at the selected time.",
          isDevelopmentFixture: false,
        };
      }

      return {
        observations: fixturesAtSelectedTime,
        notice: "Development fixtures — not live environmental observations.",
        isDevelopmentFixture: true,
      };
    }

    return {
      observations: [],
      notice: targetTime
        ? "No observations were available at the selected time."
        : "No current observations are available.",
      isDevelopmentFixture: false,
    };
  } catch (error) {
    console.error("[Supabase Fetch Error]:", error);
    return {
      observations: [],
      notice: "Air-quality observations are temporarily unavailable.",
      isDevelopmentFixture: false,
    };
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const { timestamp } = await searchParams;
  const result = await loadObservations(timestamp);
  const isHistorical = Boolean(
    timestamp && Number.isFinite(Date.parse(timestamp)),
  );

  return (
    <main className="relative h-screen min-h-[36rem] w-full overflow-hidden bg-zinc-100">
      <div className="absolute inset-0">
        <DynamicAirQualityMap
          observations={result.observations}
          selectedTimestamp={isHistorical ? timestamp : undefined}
          notice={result.notice}
          noticeIsDevelopmentFixture={result.isDevelopmentFixture}
        />
      </div>

      <Sidebar />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3 sm:p-4">
        <div className="pointer-events-auto mx-auto w-full max-w-7xl">
          <Suspense
            fallback={
              <div className="h-40 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md" />
            }
          >
            <TimeControls />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
