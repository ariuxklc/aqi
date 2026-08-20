"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import {
  AlertTriangle,
  Database,
  Moon,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";

import { getFreshnessStatus } from "@/lib/air-quality/freshness";
import {
  getMetricThresholds,
  getPollutionSeverity,
} from "@/lib/air-quality/severity";
import type { AirQualityMetric } from "@/lib/air-quality/severity";
import type { AirQualityObservation } from "@/lib/air-quality/types";

interface AirQualityMapProps {
  observations: AirQualityObservation[];
  selectedTimestamp?: string;
  notice?: string;
  noticeIsDevelopmentFixture?: boolean;
}

const MAP_CENTER: [number, number] = [47.9184, 106.9177];
const MAX_CANVAS_PIXEL_RATIO = 2;
const METERS_PER_LATITUDE_DEGREE = 111_320;
const THEME_STORAGE_KEY = "ub-aq-theme-v2";
const DEFAULT_MAP_ZOOM = 12;
const COORDINATE_GROUPING_FACTOR = 10_000;
const MARKER_DISPERSAL_RADIUS_DEGREES = 0.0002;
const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const DARK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const LIGHT_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const METRIC_LABELS: Record<AirQualityMetric, string> = {
  pm25: "PM2.5",
  pm10: "PM10",
};
const POPUP_POLLUTANTS = [
  { metric: "pm25", label: "PM2.5", unit: "µg/m³" },
  { metric: "pm10", label: "PM10", unit: "µg/m³" },
  { metric: "o3", label: "Ozone (O3)", unit: "µg/m³" },
  { metric: "no2", label: "Nitrogen Dioxide (NO2)", unit: "µg/m³" },
  { metric: "co", label: "Carbon Monoxide (CO)", unit: "mg/m³" },
  { metric: "so2", label: "Sulfur Dioxide (SO2)", unit: "µg/m³" },
] as const;

type MarkerTier = "minimal" | "compact" | "detailed";

interface MarkerConfig {
  tier: MarkerTier;
  iconWidth: number;
  iconHeight: number;
  html: string;
}

interface PositionedObservation {
  observation: AirQualityObservation;
  renderPosition: [number, number];
}

interface DrawableMetricObservation {
  observation: AirQualityObservation;
  value: number;
}

function MapThemeClass({ isLightTheme }: { isLightTheme: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle("aq-map-light", isLightTheme);
    container.classList.toggle("aq-map-dark", !isLightTheme);

    return () => {
      container.classList.remove("aq-map-light", "aq-map-dark");
    };
  }, [isLightTheme, map]);

  return null;
}

const DEVICE_ICON_SVG = `<svg class="aq-tier-marker__device" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>`;

function hasValidCoordinates(observation: AirQualityObservation): boolean {
  return (
    Number.isFinite(observation.latitude) &&
    Number.isFinite(observation.longitude) &&
    observation.latitude >= -90 &&
    observation.latitude <= 90 &&
    observation.longitude >= -180 &&
    observation.longitude <= 180
  );
}

function getDispersedMarkerPositions(
  observations: AirQualityObservation[],
): PositionedObservation[] {
  const coordinateGroups = new Map<string, AirQualityObservation[]>();

  for (const observation of observations) {
    const coordinateKey = `${Math.round(observation.latitude * COORDINATE_GROUPING_FACTOR)}:${Math.round(observation.longitude * COORDINATE_GROUPING_FACTOR)}`;
    const group = coordinateGroups.get(coordinateKey) ?? [];
    group.push(observation);
    coordinateGroups.set(coordinateKey, group);
  }

  return Array.from(coordinateGroups.values()).flatMap((group) => {
    if (group.length === 1) {
      const observation = group[0];
      return [{
        observation,
        renderPosition: [observation.latitude, observation.longitude],
      } satisfies PositionedObservation];
    }

    return [...group]
      .sort((first, second) =>
        `${first.sourceType}:${first.sourceId}:${first.observedAt}`.localeCompare(
          `${second.sourceType}:${second.sourceId}:${second.observedAt}`,
        ),
      )
      .map((observation, index) => {
        const angle = (2 * Math.PI * index) / group.length;
        return {
          observation,
          renderPosition: [
            observation.latitude +
              MARKER_DISPERSAL_RADIUS_DEGREES * Math.cos(angle),
            observation.longitude +
              MARKER_DISPERSAL_RADIUS_DEGREES * Math.sin(angle),
          ],
        } satisfies PositionedObservation;
      });
  });
}

function getAuraRadiusMeters(
  observation: AirQualityObservation,
  metricValue: number,
): number {
  const baseRadius = Math.min(700, 300 + metricValue * 2);
  return observation.sourceType === "official" ? baseRadius * 1.2 : baseRadius;
}

function getAuraRadiusPixels(
  map: L.Map,
  observation: AirQualityObservation,
  metricValue: number,
  center: L.Point,
): number {
  const latitudeRadians = (observation.latitude * Math.PI) / 180;
  const metersPerLongitudeDegree =
    METERS_PER_LATITUDE_DEGREE * Math.cos(latitudeRadians);
  const longitudeOffset =
    getAuraRadiusMeters(observation, metricValue) / metersPerLongitudeDegree;
  const edge = map.latLngToContainerPoint([
    observation.latitude,
    observation.longitude + longitudeOffset,
  ]);

  return Math.max(1, Math.abs(edge.x - center.x));
}

function getDrawableMetricObservations(
  observations: AirQualityObservation[],
  metric: AirQualityMetric,
): DrawableMetricObservation[] {
  return observations.flatMap((observation) => {
    const value = observation[metric];
    return value !== null && Number.isFinite(value) && value >= 0
      ? [{ observation, value }]
      : [];
  });
}

function getMarkerConfig(
  observation: AirQualityObservation,
  zoomLevel: number,
  activeMetric: AirQualityMetric,
  referenceTime?: string,
): MarkerConfig {
  const color = getPollutionSeverity(
    observation[activeMetric],
    activeMetric,
  ).hex;
  const isOfficial = observation.sourceType === "official";
  const markerSourceClass = isOfficial
    ? "aq-tier-marker--official"
    : "aq-tier-marker--community";

  if (zoomLevel <= 10) {
    const diameter = isOfficial ? 8 : 5;
    return {
      tier: "minimal",
      iconWidth: diameter,
      iconHeight: diameter,
      html: `<span class="aq-tier-marker aq-tier-marker--minimal ${markerSourceClass}" style="--status-color:${color}"></span>`,
    };
  }

  if (zoomLevel <= 13) {
    const diameter = isOfficial ? 14 : 10;
    return {
      tier: "compact",
      iconWidth: diameter,
      iconHeight: diameter,
      html: `<span class="aq-tier-marker aq-tier-marker--compact ${markerSourceClass}" style="--status-color:${color}"><span class="aq-tier-marker__compact-core"></span></span>`,
    };
  }

  const freshness = getFreshnessStatus(observation.observedAt, referenceTime);
  const isActive = freshness.label === "Recent";
  const sourceCode = observation.sourceType === "official" ? "O" : "C";
  const sourceClass =
    observation.sourceType === "official"
      ? "aq-tier-marker__source--official"
      : "aq-tier-marker__source--community";
  const diameter = isOfficial ? 26 : 22;
  const deviceSize = Math.round(diameter * 0.5);
  const sourceSize = Math.round(diameter * 0.4375);
  const sourceOffset = -Math.round(diameter * 0.125);
  const sourceFontSize = Math.round(diameter * 0.25);

  return {
    tier: "detailed",
    iconWidth: diameter,
    iconHeight: diameter,
    html: `<div class="aq-tier-marker aq-tier-marker--detailed ${markerSourceClass}" style="--status-color:${color};--device-size:${deviceSize}px;--source-size:${sourceSize}px;--source-offset:${sourceOffset}px;--source-font-size:${sourceFontSize}px">
      ${isActive ? '<span class="aq-tier-marker__pulse animate-ping"></span>' : ""}
      <span class="aq-tier-marker__detailed-core">${DEVICE_ICON_SVG}</span>
      <span class="aq-tier-marker__source ${sourceClass}">${sourceCode}</span>
    </div>`,
  };
}

function createStatusIcon(
  observation: AirQualityObservation,
  zoomLevel: number,
  activeMetric: AirQualityMetric,
  referenceTime?: string,
): L.DivIcon {
  const config = getMarkerConfig(
    observation,
    zoomLevel,
    activeMetric,
    referenceTime,
  );

  return L.divIcon({
    className: `aq-tier-marker-container aq-tier-marker-container--${config.tier}`,
    html: config.html,
    iconSize: [config.iconWidth, config.iconHeight],
    iconAnchor: [config.iconWidth / 2, config.iconHeight / 2],
    popupAnchor: [0, -Math.ceil(config.iconHeight / 2)],
  });
}

function formatMeasurement(
  value: number | null | undefined,
  unit: string,
): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : `${value.toFixed(1)} ${unit}`;
}

function formatObservedAt(observedAt: string): string {
  const date = new Date(observedAt);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-MN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ulaanbaatar",
  }).format(date);
}

function ObservationPopup({
  observation,
  activeMetric,
  referenceTime,
}: {
  observation: AirQualityObservation;
  activeMetric: AirQualityMetric;
  referenceTime?: string;
}) {
  const freshness = getFreshnessStatus(
    observation.observedAt,
    referenceTime,
  );
  const sourceLabel =
    observation.sourceType === "official" ? "Official" : "Community";

  return (
    <Popup>
      <article className="aq-popup-card min-w-60 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl">
        <header className="space-y-1.5">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              observation.sourceType === "official"
                ? "border-sky-400/30 bg-sky-400/15 text-sky-200"
                : "border-amber-400/30 bg-amber-400/15 text-amber-200"
            }`}
          >
            {sourceLabel}
          </span>
          <h2 className="m-0 text-base font-bold text-white">
            {observation.stationName ?? observation.sourceId}
          </h2>
          <p className="m-0 text-xs font-medium text-zinc-300">
            {observation.sourceType === "official" ? "Station ID" : "Sensor ID"}
            : {observation.sourceId}
          </p>
        </header>

        <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {POPUP_POLLUTANTS.map(({ metric, label, unit }) => {
            const isActiveMetric = metric === activeMetric;

            return (
              <div
                key={metric}
                className={`rounded-lg border p-2.5 transition ${
                  isActiveMetric
                    ? "border-emerald-400/70 bg-emerald-400/10 ring-1 ring-emerald-300/40"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <dt
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    isActiveMetric ? "text-emerald-100" : "text-zinc-300"
                  }`}
                >
                  {label}
                </dt>
                <dd className="m-0 mt-1 text-sm font-extrabold text-white">
                  {formatMeasurement(observation[metric], unit)}
                </dd>
              </div>
            );
          })}
        </dl>

        <footer className="flex items-end justify-between gap-3 border-t border-zinc-800 pt-2.5">
          <time className="text-[11px] font-medium leading-4 text-zinc-300">
            Observed {formatObservedAt(observation.observedAt)}
          </time>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${freshness.colorClass}`}
          >
            {freshness.label}
          </span>
        </footer>
      </article>
    </Popup>
  );
}

function MetricAuraLayer({
  observations,
  activeMetric,
}: {
  observations: AirQualityObservation[];
  activeMetric: AirQualityMetric;
}) {
  const map = useMap();

  useEffect(() => {
    const drawableObservations = getDrawableMetricObservations(
      observations,
      activeMetric,
    ).sort((first, second) => first.value - second.value);

    if (drawableObservations.length === 0) return;

    const canvas = L.DomUtil.create(
      "canvas",
      "leaflet-metric-aura leaflet-layer leaflet-zoom-animated",
    );
    const canvasContext = canvas.getContext("2d");

    if (!canvasContext) return;
    const context: CanvasRenderingContext2D = canvasContext;

    canvas.style.opacity = "0";
    map.getPanes().overlayPane.appendChild(canvas);
    const fadeFrame = window.requestAnimationFrame(() => {
      canvas.style.opacity = "0.72";
    });
    let animationFrame: number | null = null;

    function drawAura() {
      animationFrame = null;
      const size = map.getSize();
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_CANVAS_PIXEL_RATIO,
      );
      const canvasWidth = Math.round(size.x * pixelRatio);
      const canvasHeight = Math.round(size.y * pixelRatio);

      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
      }

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size.x, size.y);
      context.globalCompositeOperation = "screen";

      for (const { observation, value } of drawableObservations) {
        const center = map.latLngToContainerPoint([
          observation.latitude,
          observation.longitude,
        ]);
        const radius = getAuraRadiusPixels(map, observation, value, center);
        const color = getPollutionSeverity(value, activeMetric).rgb;
        const gradient = context.createRadialGradient(
          center.x,
          center.y,
          0,
          center.x,
          center.y,
          radius,
        );

        gradient.addColorStop(
          0,
          `rgba(${color.red}, ${color.green}, ${color.blue}, 0.64)`,
        );
        gradient.addColorStop(
          0.28,
          `rgba(${color.red}, ${color.green}, ${color.blue}, 0.4)`,
        );
        gradient.addColorStop(
          0.68,
          `rgba(${color.red}, ${color.green}, ${color.blue}, 0.14)`,
        );
        gradient.addColorStop(
          1,
          `rgba(${color.red}, ${color.green}, ${color.blue}, 0)`,
        );
        context.fillStyle = gradient;
        context.fillRect(
          center.x - radius,
          center.y - radius,
          radius * 2,
          radius * 2,
        );
      }
    }

    function scheduleDraw() {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(drawAura);
    }

    const redrawEvents = [
      "move",
      "moveend",
      "zoom",
      "zoomend",
      "viewreset",
      "resize",
    ] as const;

    redrawEvents.forEach((eventName) => map.on(eventName, scheduleDraw));
    scheduleDraw();

    return () => {
      redrawEvents.forEach((eventName) => map.off(eventName, scheduleDraw));
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.cancelAnimationFrame(fadeFrame);
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    };
  }, [activeMetric, map, observations]);

  return null;
}

function ObservationMarkers({
  observations,
  activeMetric,
  selectedTimestamp,
}: {
  observations: AirQualityObservation[];
  activeMetric: AirQualityMetric;
  selectedTimestamp?: string;
}) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(() => map.getZoom());
  const positionedObservations = useMemo(
    () => getDispersedMarkerPositions(observations),
    [observations],
  );

  useEffect(() => {
    function updateMapMarkers() {
      setZoomLevel(map.getZoom());
    }

    map.on("zoomend", updateMapMarkers);
    updateMapMarkers();

    return () => {
      map.off("zoomend", updateMapMarkers);
    };
  }, [map]);

  return (
    <>
      {positionedObservations.map(({ observation, renderPosition }) => {
        const sourceLabel =
          observation.sourceType === "official" ? "Official" : "Community";

        return (
          <Marker
            key={`${observation.sourceType}-${observation.sourceId}-${observation.observedAt}`}
            position={renderPosition}
            icon={createStatusIcon(
              observation,
              zoomLevel,
              activeMetric,
              selectedTimestamp,
            )}
            opacity={0.65}
            zIndexOffset={observation.sourceType === "official" ? 1000 : 0}
            title={`${sourceLabel}: ${observation.stationName ?? observation.sourceId}`}
          >
            <ObservationPopup
              observation={observation}
              activeMetric={activeMetric}
              referenceTime={selectedTimestamp}
            />
          </Marker>
        );
      })}
    </>
  );
}

function getMetricLegendItems(metric: AirQualityMetric) {
  const thresholds = getMetricThresholds(metric);
  const increment = metric === "pm25" ? 0.1 : 1;
  const moderateStart = thresholds.goodMax + increment;
  const sensitiveStart = thresholds.moderateMax + increment;
  const unhealthyStart = thresholds.sensitiveMax + increment;

  return [
    { value: 0, range: `Green 0–${thresholds.goodMax}` },
    {
      value: moderateStart,
      range: `Yellow ${moderateStart}–${thresholds.moderateMax}`,
    },
    {
      value: sensitiveStart,
      range: `Orange ${sensitiveStart}–${thresholds.sensitiveMax}`,
    },
    {
      value: unhealthyStart,
      range: `Red ${unhealthyStart}+`,
    },
  ];
}

export default function AirQualityMap({
  observations,
  selectedTimestamp,
  notice,
  noticeIsDevelopmentFixture = false,
}: AirQualityMapProps) {
  const [activeMetric, setActiveMetric] =
    useState<AirQualityMetric>("pm25");
  const [showCommunity, setShowCommunity] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [sourceToggleHost, setSourceToggleHost] =
    useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  });
  const validObservations = useMemo(
    () => observations.filter(hasValidCoordinates),
    [observations],
  );
  const visibleObservations = useMemo(
    () =>
      showCommunity
        ? validObservations
        : validObservations.filter(
            (observation) => observation.sourceType === "official",
          ),
    [showCommunity, validObservations],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("light-mode", theme === "light");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    setSourceToggleHost(document.getElementById("aq-source-toggle-slot"));
  }, [hasMounted]);

  const isHistorical = Boolean(selectedTimestamp);
  const isLightTheme = theme === "light";

  return (
    <div
      className="aq-map-shell relative h-full w-full"
      aria-label={
        selectedTimestamp
          ? "Historical air-quality observation map"
          : "Current air-quality observation map"
      }
    >
      <MapContainer
        center={MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        className={`h-full w-full ${isLightTheme ? "aq-map-light" : "aq-map-dark"}`}
        zoomControl={false}
      >
        <MapThemeClass isLightTheme={isLightTheme} />
        <TileLayer
          key={isLightTheme ? "light-basemap" : "dark-basemap"}
          url={isLightTheme ? LIGHT_TILE_URL : DARK_TILE_URL}
          attribution={
            isLightTheme ? LIGHT_TILE_ATTRIBUTION : DARK_TILE_ATTRIBUTION
          }
          className={isLightTheme ? "aq-basemap-light" : "aq-basemap-dark"}
          opacity={isLightTheme ? 1 : 0.88}
          maxZoom={20}
        />
        <ZoomControl position="bottomright" />
        <MetricAuraLayer
          observations={visibleObservations}
          activeMetric={activeMetric}
        />
        <ObservationMarkers
          observations={visibleObservations}
          activeMetric={activeMetric}
          selectedTimestamp={selectedTimestamp}
        />
      </MapContainer>

      <section
        aria-label="Map status"
        className="aq-map-status pointer-events-none absolute left-3 top-3 z-[900] max-w-[calc(100%-13rem)] rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-200 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Database aria-hidden="true" className="h-3.5 w-3.5" />
            Observations shown: {visibleObservations.length}
          </span>
          {isHistorical && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
              Historical view — not live conditions
            </span>
          )}
        </div>
        {notice && (
          <p
            role={noticeIsDevelopmentFixture ? "status" : "alert"}
            className={`mt-1.5 border-t pt-1.5 text-[11px] ${noticeIsDevelopmentFixture ? "border-violet-400/30 text-violet-200" : "border-amber-400/30 text-amber-200"}`}
          >
            {notice}
          </p>
        )}
      </section>

      <div className="absolute right-3 top-3 z-[900] flex items-center gap-2 sm:right-4">
        <button
          type="button"
          onClick={() => setTheme(isLightTheme ? "dark" : "light")}
          aria-label="Dark mode"
          aria-pressed={!isLightTheme}
          className={`aq-theme-toggle grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-xl backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${isLightTheme ? "border-zinc-300 bg-white/90 text-zinc-900 hover:bg-zinc-100" : "border-zinc-700/80 bg-zinc-950/90 text-zinc-100 hover:bg-zinc-800"}`}
        >
          {isLightTheme ? (
            <Moon aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Sun aria-hidden="true" className="h-5 w-5" />
          )}
        </button>

        <div
          role="group"
          aria-label="Heatmap metric"
          className="aq-metric-toggle inline-flex rounded-lg border border-zinc-700/80 bg-zinc-950/90 p-1 text-xs font-bold shadow-xl backdrop-blur-md"
        >
          {(["pm25", "pm10"] as const).map((metric) => {
            const isActive = activeMetric === metric;
            return (
              <button
                key={metric}
                type="button"
                onClick={() => setActiveMetric(metric)}
                aria-pressed={isActive}
                className={`rounded-md px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {METRIC_LABELS[metric]}
              </button>
            );
          })}
        </div>
      </div>

      {hasMounted &&
        sourceToggleHost &&
        createPortal(
          <button
            type="button"
            onClick={() => setShowCommunity((current) => !current)}
            aria-label="Official stations only"
            aria-pressed={!showCommunity}
            className="aq-source-toggle inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-3 text-xs font-bold text-zinc-100 shadow-xl backdrop-blur-md transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {showCommunity ? (
              <Users aria-hidden="true" className="h-4 w-4 text-amber-300" />
            ) : (
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-sky-300" />
            )}
            {showCommunity ? "Official + Community" : "Official only"}
          </button>,
          sourceToggleHost,
        )}

      <aside
        aria-label="Map legend"
        className="aq-map-legend pointer-events-none absolute right-3 top-40 z-[900] hidden w-52 rounded-xl border border-zinc-700/80 bg-zinc-950/90 p-3 text-zinc-100 shadow-2xl backdrop-blur-md sm:right-4 sm:top-16 sm:block sm:w-60"
      >
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
          {METRIC_LABELS[activeMetric]} concentration
        </h2>
        <ul className="mt-2 space-y-1.5 text-[11px] font-medium">
          {getMetricLegendItems(activeMetric).map(({ value, range }) => {
            const severity = getPollutionSeverity(value, activeMetric);
            return (
              <li key={severity.code} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: severity.hex }}
                />
                <span>{severity.label} · {range}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-2.5 flex gap-3 border-t border-zinc-800 pt-2.5 text-[11px] font-semibold">
          <span><b className="text-sky-300">O</b> Official</span>
          <span><b className="text-amber-300">C</b> Community</span>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-zinc-300">
          Ambient halo represents an interpolated spatial estimate.
        </p>
      </aside>
    </div>
  );
}
