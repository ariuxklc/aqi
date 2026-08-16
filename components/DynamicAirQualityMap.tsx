"use client";

import dynamic from "next/dynamic";

import type { AirQualityObservation } from "@/lib/air-quality/types";

const AirQualityMap = dynamic(
  () => import("@/components/AirQualityMap"),
  { ssr: false },
);

interface DynamicAirQualityMapProps {
  observations: AirQualityObservation[];
  selectedTimestamp?: string;
  notice?: string;
  noticeIsDevelopmentFixture?: boolean;
}

export default function DynamicAirQualityMap(props: DynamicAirQualityMapProps) {
  return <AirQualityMap {...props} />;
}
