import type { AirQualityObservation } from "@/lib/air-quality/types";

export interface ProposedCommunityNode {
  id: string;
  name: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  pm25: number;
  pm10: number;
  pm25Multiplier: number;
  pm10Multiplier: number;
}

/**
 * Illustrative locations for the proposed community network. These are not
 * readings from deployed sensors and are deliberately kept outside Supabase.
 */
export const PROPOSED_COMMUNITY_NODES: readonly ProposedCommunityNode[] = [
  {
    id: "PROPOSED-BAYANKHOSHUU-01",
    name: "Bayankhoshuu community node",
    neighborhood: "Bayankhoshuu",
    latitude: 47.9718,
    longitude: 106.8392,
    pm25: 17,
    pm10: 31,
    pm25Multiplier: 1.32,
    pm10Multiplier: 1.26,
  },
  {
    id: "PROPOSED-SELBE-01",
    name: "Selbe community node",
    neighborhood: "Selbe",
    latitude: 47.9564,
    longitude: 106.9081,
    pm25: 16,
    pm10: 28,
    pm25Multiplier: 1.25,
    pm10Multiplier: 1.2,
  },
  {
    id: "PROPOSED-DAMBADARJAA-01",
    name: "Dambadarjaa community node",
    neighborhood: "Dambadarjaa",
    latitude: 47.9802,
    longitude: 106.9154,
    pm25: 18,
    pm10: 32,
    pm25Multiplier: 1.28,
    pm10Multiplier: 1.24,
  },
  {
    id: "PROPOSED-GANDAN-01",
    name: "Gandan community node",
    neighborhood: "Gandan",
    latitude: 47.9217,
    longitude: 106.8854,
    pm25: 15,
    pm10: 26,
    pm25Multiplier: 1.16,
    pm10Multiplier: 1.12,
  },
  {
    id: "PROPOSED-TOLGOIT-01",
    name: "Tolgoit community node",
    neighborhood: "Tolgoit",
    latitude: 47.8918,
    longitude: 106.8098,
    pm25: 17,
    pm10: 30,
    pm25Multiplier: 1.22,
    pm10Multiplier: 1.18,
  },
  {
    id: "PROPOSED-YARMAG-01",
    name: "Yarmag community node",
    neighborhood: "Yarmag",
    latitude: 47.8599,
    longitude: 106.8235,
    pm25: 14,
    pm10: 25,
    pm25Multiplier: 1.08,
    pm10Multiplier: 1.06,
  },
  {
    id: "PROPOSED-3RD-HOROOLOL-01",
    name: "3rd Micro-District community node",
    neighborhood: "3rd Micro-District",
    latitude: 47.9116,
    longitude: 106.8573,
    pm25: 13.5,
    pm10: 24,
    pm25Multiplier: 1.1,
    pm10Multiplier: 1.08,
  },
  {
    id: "PROPOSED-4TH-HOROOLOL-01",
    name: "4th Micro-District community node",
    neighborhood: "4th Micro-District",
    latitude: 47.9062,
    longitude: 106.8394,
    pm25: 14.5,
    pm10: 26,
    pm25Multiplier: 1.12,
    pm10Multiplier: 1.1,
  },
  {
    id: "PROPOSED-DUNJINGARAV-01",
    name: "Dunjingarav community node",
    neighborhood: "Dunjingarav",
    latitude: 47.9168,
    longitude: 107.0118,
    pm25: 15,
    pm10: 27,
    pm25Multiplier: 1.12,
    pm10Multiplier: 1.1,
  },
  {
    id: "PROPOSED-BAYANZURKH-36-01",
    name: "Bayanzurkh 36th khoroo community node",
    neighborhood: "Bayanzurkh 36th khoroo",
    latitude: 47.9076,
    longitude: 107.0056,
    pm25: 14.5,
    pm10: 26,
    pm25Multiplier: 1.1,
    pm10Multiplier: 1.08,
  },
  {
    id: "PROPOSED-NARNII-ZAM-CENTRAL-01",
    name: "Narnii Zam central community node",
    neighborhood: "Narnii Zam",
    latitude: 47.9097,
    longitude: 106.9286,
    pm25: 14,
    pm10: 25,
    pm25Multiplier: 1.08,
    pm10Multiplier: 1.06,
  },
  {
    id: "PROPOSED-NARNII-ZAM-EAST-01",
    name: "Narnii Zam east community node",
    neighborhood: "Narnii Zam East",
    latitude: 47.9106,
    longitude: 106.9635,
    pm25: 15,
    pm10: 27,
    pm25Multiplier: 1.12,
    pm10Multiplier: 1.1,
  },
  {
    id: "PROPOSED-TSAYZ-01",
    name: "Tsai Z community node",
    neighborhood: "Tsai Z",
    latitude: 47.9281,
    longitude: 106.97877,
    pm25: 15.5,
    pm10: 28,
    pm25Multiplier: 1.14,
    pm10Multiplier: 1.12,
  },
  {
    id: "PROPOSED-ULIASTAI-01",
    name: "Uliastai community node",
    neighborhood: "Uliastai",
    latitude: 47.9358,
    longitude: 107.0286,
    pm25: 16,
    pm10: 29,
    pm25Multiplier: 1.14,
    pm10Multiplier: 1.12,
  },
  {
    id: "PROPOSED-ZAISAN-01",
    name: "Zaisan community node",
    neighborhood: "Zaisan",
    latitude: 47.8897,
    longitude: 106.9085,
    pm25: 12,
    pm10: 20,
    pm25Multiplier: 0.96,
    pm10Multiplier: 0.98,
  },
  {
    id: "PROPOSED-KHAN-UUL-01",
    name: "Khan-Uul community node",
    neighborhood: "Khan-Uul",
    latitude: 47.8764,
    longitude: 106.8323,
    pm25: 13,
    pm10: 22,
    pm25Multiplier: 1.05,
    pm10Multiplier: 1.04,
  },
  {
    id: "PROPOSED-SONGINOKHAIRKHAN-CENTRAL-01",
    name: "Songinokhairkhan central community node",
    neighborhood: "Songinokhairkhan",
    latitude: 47.8998,
    longitude: 106.7758,
    pm25: 17,
    pm10: 31,
    pm25Multiplier: 1.2,
    pm10Multiplier: 1.16,
  },
  {
    id: "PROPOSED-5-SHAR-01",
    name: "5 Shar community node",
    neighborhood: "5 Shar",
    latitude: 47.9037,
    longitude: 106.8152,
    pm25: 16,
    pm10: 29,
    pm25Multiplier: 1.16,
    pm10Multiplier: 1.14,
  },
  {
    id: "PROPOSED-10TH-KHOROOLOL-01",
    name: "10th khoroolol community node",
    neighborhood: "10th khoroolol",
    latitude: 47.9111,
    longitude: 106.8503,
    pm25: 15,
    pm10: 27,
    pm25Multiplier: 1.12,
    pm10Multiplier: 1.1,
  },
  {
    id: "PROPOSED-BAGA-TOIRUU-01",
    name: "Baga Toiruu community node",
    neighborhood: "Baga Toiruu",
    latitude: 47.9257,
    longitude: 106.9182,
    pm25: 13.5,
    pm10: 24,
    pm25Multiplier: 1.06,
    pm10Multiplier: 1.05,
  },
  {
    id: "PROPOSED-100-AIL-EAST-01",
    name: "100 Ail east community node",
    neighborhood: "100 Ail",
    latitude: 47.9354,
    longitude: 106.9412,
    pm25: 14.5,
    pm10: 26,
    pm25Multiplier: 1.1,
    pm10Multiplier: 1.08,
  },
  {
    id: "PROPOSED-SANSAR-01",
    name: "Sansar community node",
    neighborhood: "Sansar",
    latitude: 47.9142,
    longitude: 106.9458,
    pm25: 14.5,
    pm10: 26,
    pm25Multiplier: 1.1,
    pm10Multiplier: 1.08,
  },
  {
    id: "PROPOSED-13TH-KHOROOLOL-01",
    name: "13th khoroolol community node",
    neighborhood: "13th khoroolol",
    latitude: 47.9192,
    longitude: 106.9628,
    pm25: 15,
    pm10: 27,
    pm25Multiplier: 1.12,
    pm10Multiplier: 1.1,
  },
  {
    id: "PROPOSED-KHAILAAST-01",
    name: "Khailaast community node",
    neighborhood: "Khailaast",
    latitude: 47.9762,
    longitude: 106.8786,
    pm25: 18,
    pm10: 33,
    pm25Multiplier: 1.3,
    pm10Multiplier: 1.24,
  },
  {
    id: "PROPOSED-DENJIIN-MYANGA-01",
    name: "Denjiin Myanga community node",
    neighborhood: "Denjiin Myanga",
    latitude: 47.9473,
    longitude: 106.8975,
    pm25: 17,
    pm10: 31,
    pm25Multiplier: 1.24,
    pm10Multiplier: 1.2,
  },
  {
    id: "PROPOSED-7-BUUDAAL-01",
    name: "7 Buudal community node",
    neighborhood: "7 Buudal",
    latitude: 47.9612,
    longitude: 106.8695,
    pm25: 17.5,
    pm10: 32,
    pm25Multiplier: 1.28,
    pm10Multiplier: 1.22,
  },
  {
    id: "PROPOSED-IKH-TOIRUU-01",
    name: "Ikh Toiruu community node",
    neighborhood: "Ikh Toiruu",
    latitude: 47.9322,
    longitude: 106.9043,
    pm25: 14,
    pm10: 25,
    pm25Multiplier: 1.08,
    pm10Multiplier: 1.06,
  },
  {
    id: "PROPOSED-BAYANZURKH-EAST-01",
    name: "Bayanzurkh east community node",
    neighborhood: "Bayanzurkh East",
    latitude: 47.9301,
    longitude: 107.0118,
    pm25: 16,
    pm10: 29,
    pm25Multiplier: 1.18,
    pm10Multiplier: 1.14,
  },
];

function nearestOfficialMeasurement(
  node: ProposedCommunityNode,
  observations: readonly AirQualityObservation[],
  metric: "pm25" | "pm10",
): number | null {
  let nearestValue: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const observation of observations) {
    const value = observation[metric];
    if (
      observation.sourceType !== "official" ||
      value === null ||
      !Number.isFinite(value) ||
      !Number.isFinite(observation.latitude) ||
      !Number.isFinite(observation.longitude)
    ) {
      continue;
    }

    const distance =
      (node.latitude - observation.latitude) ** 2 +
      (node.longitude - observation.longitude) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestValue = value;
    }
  }

  return nearestValue;
}

function simulatedMeasurement(
  node: ProposedCommunityNode,
  observations: readonly AirQualityObservation[],
  metric: "pm25" | "pm10",
): number {
  const referenceValue = nearestOfficialMeasurement(node, observations, metric);
  if (referenceValue === null) return node[metric];

  const multiplier =
    metric === "pm25" ? node.pm25Multiplier : node.pm10Multiplier;
  return Math.round(referenceValue * multiplier * 10) / 10;
}

export function buildProposedCommunityObservations(
  observedAt: string,
  officialObservations: readonly AirQualityObservation[] = [],
): AirQualityObservation[] {
  return PROPOSED_COMMUNITY_NODES.map((node) => ({
    sourceType: "community",
    sourceId: node.id,
    stationName: node.name,
    latitude: node.latitude,
    longitude: node.longitude,
    pm25: simulatedMeasurement(node, officialObservations, "pm25"),
    pm10: simulatedMeasurement(node, officialObservations, "pm10"),
    observedAt,
    dataStatus: "simulated",
  }));
}
