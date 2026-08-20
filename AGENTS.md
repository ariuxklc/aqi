# AGENTS.md - Ulaanbaatar Air Quality Platform

## Critical Rules

1. **Leaflet SSR boundary**
   - Components that import `leaflet` or `react-leaflet` must start with `"use client"`.
   - Do not import `components/AirQualityMap.tsx` directly into a Server Component.
   - `components/DynamicAirQualityMap.tsx` is the current SSR boundary and imports `AirQualityMap` with `{ ssr: false }`.
   - Keep `app/page.tsx` as a Server Component unless a specific feature requires otherwise.

2. **Supabase separation**
   - Server Components and server-side data utilities import Supabase only from `@/utils/supabase/server`.
   - There is currently no client-side Supabase utility in this repo. Do not add client Supabase access unless a feature truly needs it.
   - Never expose service-role credentials or privileged keys to browser code.
   - Do not add auth middleware, login, or account creation for the public dashboard unless explicitly requested.

3. **Data integrity and provenance**
   - Never merge official and community readings into an anonymous pool. Canonical observations must keep `sourceType`, `sourceId`, coordinates, raw values, and original timestamps.
   - Never treat `null`, `undefined`, missing, invalid, or stale measurements as `0`.
   - Never label raw particulate concentration as an AQI score, and do not invent AQI conversion formulas.
   - Development fixtures in `lib/air-quality/mock.ts` are only for `NODE_ENV === "development"` and must stay clearly labeled as non-live data.

## Product

- Public multi-source air-quality visualization for Ulaanbaatar, Mongolia.
- Core question: "What is the air quality in this part of UB, and how recent is the information?"
- Default map center: `[47.9184, 106.9177]`.
- Default map zoom: `12`.
- Normal dashboard use requires no authentication.
- The platform complements official monitoring; it must not impersonate or replace official infrastructure.

## Current Tech Stack

- Next.js App Router with TypeScript.
- Tailwind CSS and Lucide React.
- Leaflet, React-Leaflet, OpenStreetMap/CARTO tiles.
- Supabase via `@supabase/ssr` and PostgreSQL.

Do not replace the core stack or add another mapping/UI/state library without explicit approval.

## Current File Responsibilities

```text
app/
├── page.tsx                 Server Component; fetches observations and renders controls/map
├── globals.css              Global Tailwind and Leaflet/map styling
└── layout.tsx

components/
├── DynamicAirQualityMap.tsx Client wrapper; dynamic AirQualityMap import with ssr:false
├── AirQualityMap.tsx        Leaflet map, canvas aura overlay, markers, popups, legend, theme toggle
└── TimeControls.tsx         Client historical date/time controls and mounted source-toggle portal slot

lib/air-quality/
├── types.ts                 Canonical observation/source types
├── normalize.ts             Raw row validation and source-specific normalization
├── server.ts                Bounded Supabase queries and latest-per-source selection
├── severity.ts              PM2.5/PM10 metric thresholds for overlay/marker severity
├── freshness.ts             Centralized freshness labels
└── mock.ts                  Development-only fixture observations

utils/supabase/
└── server.ts                Server Supabase client
```

Do not document or implement separate `HeatmapLayer`, `OfficialStationMarker`, `CommunitySensorMarker`, or `AirQualityLegend` components unless the codebase is actually refactored to contain them.

## Database Schema

### Community table: `aqi_readings`

The community query currently selects:

| Column | Type | Notes |
| --- | --- | --- |
| `sensor_id` | `text` | Community sensor identifier |
| `lat` | `double precision` | Latitude |
| `lng` | `double precision` | Longitude |
| `pm25` | `double precision` | PM2.5 concentration in µg/m³; may be null |
| `pm10` | `double precision` | PM10 concentration in µg/m³; may be null |
| `created_at` | `timestamptz` | Original observation timestamp |

The physical table may also contain an `id`, but the application does not select it for the map.

### Official table: `official_aqi_readings`

The official query currently selects:

| Column | Type | Notes |
| --- | --- | --- |
| `station_id` | `text` | Official station identifier |
| `station_name` | `text` | Public station name; may be null |
| `lat` | `double precision` | Latitude |
| `lng` | `double precision` | Longitude |
| `pm25` | `double precision` | PM2.5 concentration in µg/m³; may be null |
| `pm10` | `double precision` | PM10 concentration in µg/m³; may be null |
| `o3` | `double precision` | Ozone concentration in µg/m³; may be null |
| `no2` | `double precision` | Nitrogen dioxide concentration in µg/m³; may be null |
| `co` | `double precision` | Carbon monoxide concentration in mg/m³; may be null |
| `so2` | `double precision` | Sulfur dioxide concentration in µg/m³; may be null |
| `observed_at` | `timestamptz` | Original observation timestamp |

Use explicit column lists. Do not use `select("*")` for map data.

## Canonical Data Model

`lib/air-quality/types.ts` is the source of truth:

```ts
export type SourceType = "official" | "community";

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
}
```

Community rows normalize to `sourceType: "community"` and do not provide gas fields. Official rows normalize to `sourceType: "official"` and preserve PM plus gas fields.

## Data Flow

```text
app/page.tsx
  -> fetchAirQualityObservations(targetTime?)
  -> bounded community and official Supabase queries
  -> validate raw rows
  -> normalize to AirQualityObservation[]
  -> select latest eligible reading per source ID
  -> DynamicAirQualityMap
  -> AirQualityMap
```

Historical views pass a `timestamp` query parameter. Queries include records at or before that instant, then select the latest eligible reading per source ID. Freshness is evaluated relative to the selected snapshot when present.

## Map And Popup Behavior

- `AirQualityMetric` currently supports only `"pm25"` and `"pm10"` in `lib/air-quality/severity.ts`.
- The active metric drives marker color, legend thresholds, and the canvas aura overlay in `AirQualityMap.tsx`.
- Do not combine PM2.5 and PM10 into one metric. Do not use gas values in the overlay until explicit gas thresholds and product rules exist.
- The canvas aura is a derived spatial visualization from available observation points. It must not be described as a direct measurement at unmonitored locations.
- Official and community observations must remain visually distinguishable in markers and popups.

Station popups in `AirQualityMap.tsx` must show all six pollutant cells at once:

| Pollutant | Unit | Missing display |
| --- | --- | --- |
| PM2.5 | µg/m³ | `--` |
| PM10 | µg/m³ | `--` |
| Ozone (O3) | µg/m³ | `--` |
| Nitrogen Dioxide (NO2) | µg/m³ | `--` |
| Carbon Monoxide (CO) | mg/m³ | `--` |
| Sulfur Dioxide (SO2) | µg/m³ | `--` |

The popup grid uses two columns by default and three columns on small-and-up screens. The cell matching `activeMetric` gets subtle active highlighting, even for community sensors. Missing gas fields on community observations must render as `--`, never `NaN`, `undefined`, or `0`.

## SSR And Hydration

- `DynamicAirQualityMap.tsx` is a Client Component solely to disable SSR for the Leaflet map.
- `AirQualityMap.tsx` is a Client Component because it imports Leaflet and React-Leaflet.
- `TimeControls.tsx` is a Client Component because it uses router/search params, local interaction state, timers, and browser APIs.
- The source filter button is rendered through a portal from `AirQualityMap.tsx` into `#aq-source-toggle-slot` owned by `TimeControls.tsx`.
- To avoid hydration mismatches, both the slot and the portal lookup/rendering are gated by `hasMounted` state. Do not render portal content or DOM-slot-only markup before mount.

## Freshness And Time Handling

- Use `lib/air-quality/freshness.ts` for freshness status.
- Current thresholds are:
  - `< 2 hours`: `Recent`
  - `2-24 hours`: `Stale`
  - invalid, future relative to reference time, or older than 24 hours: `No recent data`
- Preserve original observation timestamps. Never rewrite historical timestamps to make readings look current.

## Missing And Invalid Data

- Validate coordinates before rendering markers.
- Validate raw rows in `lib/air-quality/normalize.ts`.
- Missing pollutant values may be displayed as `--` or omitted from visualizations, depending on context.
- Missing values must never be converted to zero.
- If Supabase fails, show a useful notice and do not expose raw database errors to users.

## Public Access, Privacy, And Security

- Public users can view the dashboard without login.
- Do not expose resident names, personal contact information, occupancy details, or private sensor metadata.
- Never trust client input for future writes.
- Never allow users to spoof official source provenance.
- If write paths are added later, validate source IDs, coordinates, timestamps, PM2.5, PM10, O3, NO2, CO, and SO2 server-side.

## Styling And Accessibility

- Use Tailwind CSS and Lucide React.
- Keep the UI responsive for mobile, tablet, laptop, and desktop.
- Keep OpenStreetMap/tile-provider attribution visible.
- Do not rely only on color to communicate source type, severity, or status; keep textual equivalents where practical.
- Light mode is the default for first-time visitors. Preserve explicit light/dark preference in local storage.

## Dependency Discipline

Do not add Redux, Axios, Zustand, Material UI, Mapbox, another mapping library, auth infrastructure, a separate backend, GraphQL, a CMS, or a second database unless explicitly requested.

Before adding any dependency, prefer the existing stack or a small native implementation.

## Development And Validation

Before meaningful code changes:

1. Inspect the current implementation.
2. Reuse existing utilities/components.
3. Keep the change scoped.
4. Preserve source provenance and raw measurements.
5. Run available validation, usually:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

If a validation command cannot run because dependencies or local tooling are unavailable, report that clearly.

Do not use `any`, `@ts-ignore`, disabled lint rules, or fabricated data to force a passing build.
