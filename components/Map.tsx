"use client";

import { useMemo } from "react";

import AirQualityMap from "@/components/AirQualityMap";
import { buildProposedCommunityObservations } from "@/lib/air-quality/proposed";
import type { AirQualityObservation } from "@/lib/air-quality/types";

interface MapProps {
  observations: AirQualityObservation[];
  selectedTimestamp?: string;
  notice?: string;
  noticeIsDevelopmentFixture?: boolean;
}

const PROPOSED_SNAPSHOT_TIMESTAMP = "2026-08-18T12:00:00+08:00";

/**
 * The map's proposed layer is generated in the browser and never persisted or
 * combined with official data. AirQualityMap renders its provenance directly.
 */
export default function Map(props: MapProps) {
  const observations = useMemo(
    () => [
      ...props.observations,
      ...buildProposedCommunityObservations(
        props.selectedTimestamp ?? PROPOSED_SNAPSHOT_TIMESTAMP,
        props.observations,
      ),
    ],
    [props.observations, props.selectedTimestamp],
  );

  return <AirQualityMap {...props} observations={observations} />;
}
