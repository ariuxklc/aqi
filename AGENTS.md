# AGENTS.md — Ulaanbaatar Air Quality Platform

## 🛑 CRITICAL / FATAL RULES (DO NOT VIOLATE)

1. **Leaflet SSR Boundary (CRITICAL)**

   * Leaflet uses browser globals such as `window` and **will crash Next.js during SSR**.
   * Any component importing `leaflet`, `react-leaflet`, or `leaflet.heat` **MUST** have `'use client'` at line 1.
   * When importing a map component into a Server Component/Page such as `app/page.tsx`, **ALWAYS** disable SSR for that map component:

     ```tsx
     const AirQualityMap = dynamic(
       () => import('@/components/AirQualityMap'),
       { ssr: false }
     )
     ```
   * Do **not** add `'use client'` to `app/page.tsx` merely because it renders the map.

2. **Supabase Client Separation**

   * Server Components / Route Handlers / server-side utilities: import **only** from `@/utils/supabase/server`.
   * Client Components: import **only** from `@/utils/supabase/client`.
   * Never expose `SUPABASE_SERVICE_ROLE_KEY` or other privileged credentials to client-side code.
   * **DO NOT** create or require `middleware.ts`; this is a public dashboard.

3. **Data Integrity & Provenance**

   * **NEVER** merge official government data and community data into an anonymous pool.
   * Every observation must retain its `sourceType`, `sourceId`, and original timestamp.
   * **NEVER** treat missing values (`null`) as `0`.
   * **NEVER** invent AQI formulas or label raw PM concentrations (`µg/m³`) as an "AQI Score".
   * **NEVER** fabricate, mock, or seed fake environmental observations into production code paths.
   * **NEVER** silently alter raw PM2.5/PM10 values merely for display.

---

## 1. Project Overview & Product North Star

* **Purpose:** Public multi-source air-quality visualization for Ulaanbaatar, Mongolia (COP17 Prototype).
* **Core User Question:** *"What is the air quality in this part of UB, and how recent is the information?"*
* **Primary Sources:** Official government monitoring data + community/user sensor data.
* **Default Map Center:** `[47.9184, 106.9177]` (Ulaanbaatar, Mongolia).
* **Default Map Zoom:** `12`.
* **Public Access:** No authentication, account creation, or login required for normal dashboard use.
* The platform complements official monitoring; it does **not** replace or impersonate official monitoring infrastructure.

The website should make it easy to understand:

1. **Where** measurements exist.
2. **What** PM2.5 / PM10 values are reported.
3. **When** each observation was recorded.
4. **What source** the observation came from.
5. **Where monitoring coverage exists or is sparse.**

---

## 2. Tech Stack

* **Framework:** Next.js 14+ (App Router, TypeScript)
* **Styling & UI:** Tailwind CSS, Lucide React icons
* **Mapping:** Leaflet, React-Leaflet, leaflet.heat, OpenStreetMap
* **Database:** Supabase (`@supabase/ssr`, PostgreSQL)

Do not replace the core stack without explicit instruction.

---

## 3. Architecture & File Structure

Recommended structure:

```text
app/
├── page.tsx
└── components/
    ├── AirQualityMap.tsx
    ├── HeatmapLayer.tsx
    ├── OfficialStationMarker.tsx
    ├── CommunitySensorMarker.tsx
    └── AirQualityLegend.tsx

utils/
└── supabase/
    ├── server.ts
    └── client.ts

lib/
└── air-quality/
    ├── types.ts
    ├── normalize.ts
    └── freshness.ts
```

This is a guideline, not a requirement to create every file immediately.

### Architecture principles

* Keep `app/page.tsx` a Server Component unless there is a concrete reason not to.
* Keep the Leaflet/browser-only boundary isolated to the map components.
* Keep source-specific database logic out of presentation components.
* Normalize data before passing it to the map/UI.
* Prefer small, focused components over one large application component.
* Reuse existing utilities/components before creating new abstractions.

---

## 4. Database Schema & Data Sources

### Raw community table (`aqi_readings`)

| Column       | Type               | Notes                               |
| ------------ | ------------------ | ----------------------------------- |
| `id`         | `bigint`           | Primary key                         |
| `sensor_id`  | `text`             | e.g. `"UB-GER-001"`                 |
| `lat`        | `double precision` | Latitude                            |
| `lng`        | `double precision` | Longitude                           |
| `pm25`       | `double precision` | Concentration in µg/m³; may be null |
| `pm10`       | `double precision` | Concentration in µg/m³; may be null |
| `created_at` | `timestamptz`      | Observation timestamp               |

### Data sources

The application may receive data from multiple sources.

At minimum:

* `official` — official government monitoring stations/data.
* `community` — community/user sensor observations.

The official government dataset may use a different table, query, schema, or external data source.

### Critical source rules

* Do not assume all sources use the same schema.
* Do not infer `official` vs `community` from UI behavior.
* Only mark an observation as `official` when its source is explicitly known to be official.
* Do not use one source's metadata to describe another source.
* Do not deduplicate observations across sources unless explicitly required.
* Do not average or merge observations across sources unless explicitly required by a defined product rule.

---

## 5. Canonical Application Data Model

### `lib/air-quality/types.ts`

```typescript
export type SourceType = 'official' | 'community';

export interface AirQualityObservation {
  sourceType: SourceType;
  sourceId: string;       // station_id or sensor_id
  latitude: number;
  longitude: number;
  pm25: number | null;    // µg/m³
  pm10: number | null;    // µg/m³
  observedAt: string;     // ISO timestamp
  stationName?: string;
}
```

The canonical type may be extended when the actual product requires more metadata, but these fields should remain stable.

### Normalization rule

Map and presentation components must accept:

```typescript
AirQualityObservation[]
```

rather than raw source-specific database rows.

Always normalize source data before passing it to presentation layers.

Preferred flow:

```text
Raw source data
      ↓
Source-specific query/transform
      ↓
Normalization
      ↓
AirQualityObservation[]
      ↓
Map / UI
```

The map should not contain logic for understanding multiple database schemas.

---

## 6. Data Integrity

### Required behavior

* Preserve raw PM2.5 and PM10 values.
* Preserve original timestamps.
* Preserve source type.
* Preserve source/station/sensor identity.
* Handle null values explicitly.
* Validate coordinates before rendering.
* Validate numeric fields before display.

### Prohibited behavior

```text
null PM2.5 → 0
```

```text
missing timestamp → current time
```

```text
unknown source → official
```

```text
fake development reading → production dashboard
```

Do not perform these transformations.

If a value is missing, show it as unavailable or exclude it from the relevant visualization.

---

## 7. Map & Visualization Rules

### Heatmap

* **Primary metric:** PM2.5.
* Do **not** combine PM2.5 and PM10 into one heatmap.
* PM10 may use a separate visualization or metric toggle.
* Heatmaps are visualizations derived from available observation points.
* A heatmap must **not** imply that an unmonitored location has a direct physical measurement.
* Do not describe heatmap colors as exact measured concentrations unless an explicit and documented interpolation method supports that claim.
* Do not fabricate or synthesize points to make the heatmap appear denser.

### Markers

Official government stations and community sensors **MUST** use visually distinct markers/icons or otherwise clearly distinguishable source styling.

The user should be able to determine whether a selected observation is:

* Official
* Community

without inspecting source code.

### Map center

```text
[47.9184, 106.9177]
```

### Zoom

```text
12
```

### OpenStreetMap

* Use OpenStreetMap for the base map where appropriate.
* Keep required OpenStreetMap/tile-provider attribution visible.
* Do not remove attribution.
* Do not assume unlimited tile usage.
* Do not claim OpenStreetMap data as project-owned data.

---

## 8. Data Display & Formatting

Always display explicit pollutant names and units.

Preferred:

```text
PM2.5: 42.3 µg/m³
```

Not:

```text
42.3333333333
```

### Formatting

* Do not display excessive decimal precision.
* Use a consistent formatting helper where practical.
* Preserve the underlying raw value in application state/data.
* Formatting for display must not modify the stored measurement.

Recommended display precision for typical particulate measurements:

```text
42.3 µg/m³
```

rather than:

```text
42.3333333 µg/m³
```

---

## 9. AQI Rules

Do not invent an AQI formula.

Raw particulate concentration is **not** the same thing as AQI.

If AQI is added later:

* explicitly define the standard being used;
* document the conversion methodology;
* keep the original PM2.5/PM10 value visible;
* represent the AQI as a derived value;
* do not imply that AQI was directly measured by the sensor/station.

Never display:

```text
AQI: 84
```

when the underlying data is simply:

```text
PM2.5: 84 µg/m³
```

unless a defined AQI conversion has actually been applied.

---

## 10. Freshness & Time Handling

### Centralized Freshness Logic

Use:

```text
lib/air-quality/freshness.ts
```

for freshness calculations.

Do not scatter hardcoded thresholds throughout UI components.

All components should use consistent freshness semantics.

Examples of conceptual states:

* `Recent`
* `Stale`
* `No recent data`
* `Unavailable`

Exact thresholds should be centralized and configured deliberately.

### Rules

* Always preserve the original observation timestamp.
* Never change an old observation's timestamp to make it appear current.
* Do not show stale observations as if they were live.
* Clearly distinguish "no recent data" from a genuinely low measurement.

---

## 11. Missing Data & Error States

### Missing values

If:

```typescript
pm25 === null
```

display:

```text
N/A
```

or omit the value from the relevant visualization.

Never render:

```text
0 µg/m³
```

for a missing value.

The same applies to PM10.

### Invalid coordinates

Do not render a map marker when latitude or longitude is invalid.

### Database failure

If Supabase fails:

* show a useful error/empty state;
* do not display a blank white screen;
* do not expose raw database exceptions to users;
* do not substitute fake values.

---

## 12. Supabase Queries

Prefer bounded, purposeful queries.

For the main map:

* fetch only required columns;
* avoid loading years of historical data unnecessarily;
* query recent/current observations where appropriate;
* avoid duplicate requests.

For historical views:

* use an explicit or bounded time range;
* paginate or aggregate when appropriate;
* avoid sending unnecessarily large datasets to the browser.

Do not use `select('*')` when only a small subset of columns is required.

---

## 13. Initial Data Flow

Preferred pattern:

```text
app/page.tsx
      ↓
Server-side Supabase query
      ↓
Normalize official + community records
      ↓
AirQualityObservation[]
      ↓
Dynamic AirQualityMap (client)
      ↓
Leaflet visualization
```

Do not fetch the same initial dataset independently on both server and client unless there is a specific reason.

---

## 14. Real-Time / Near-Real-Time Updates

The application may use:

* Supabase Realtime;
* bounded polling;
* server refresh;
* manual refresh.

Choose the simplest approach that satisfies the feature requirement.

If Realtime is used:

* subscribe only to needed data;
* prevent duplicate subscriptions;
* clean up subscriptions on unmount;
* avoid subscribing to unnecessarily large datasets.

Do not add realtime functionality merely because Supabase supports it.

---

## 15. Source-Aware Visualization

When official and community data appear together:

* preserve provenance in the data model;
* preserve source identity in markers/popups/panels;
* distinguish source types visually;
* do not imply that all measurements have identical calibration, accuracy, or sampling behavior.

Do **not** automatically assume:

```text
official = perfect
community = inaccurate
```

or:

```text
official = current
community = current
```

Represent the available evidence without unsupported claims.

---

## 16. Privacy

The application is public.

Do not expose unnecessary personal information.

Do not display:

* resident names;
* personal contact information;
* occupancy information;
* private profile information;

unless explicitly required.

If a community sensor corresponds to a private residence, exact location precision should be treated as an intentional privacy/product decision.

Do not accidentally expose private metadata through:

* map popups;
* URLs;
* API responses;
* logs;
* client-side state;
* debugging output.

---

## 17. Public Access

No account should be required for normal dashboard functionality.

Public users should be able to view the air-quality map without logging in.

Do not add:

* authentication;
* account creation;
* login screens;
* auth middleware;

unless explicitly requested.

---

## 18. Security

Public visibility does not mean unrestricted database access.

### Rules

* Never trust client input.
* Validate server-side inputs.
* Use appropriate Supabase Row Level Security.
* Never expose service-role credentials.
* Never expose unrestricted SQL execution.
* Never allow arbitrary database modifications from client-side code.
* Never allow users to spoof `sourceType: 'official'`.

If writes are introduced later, validate all:

* source IDs;
* coordinates;
* timestamps;
* PM2.5;
* PM10.

---

## 19. Component Responsibilities

Suggested responsibilities:

### `AirQualityMap.tsx`

* Map initialization
* Base map
* Layer composition
* Map interaction

### `HeatmapLayer.tsx`

* Heatmap creation/update
* Metric selection
* Heatmap lifecycle

### `OfficialStationMarker.tsx`

* Rendering official government station markers
* Official-source display information

### `CommunitySensorMarker.tsx`

* Rendering community sensor markers
* Community-source display information

### `AirQualityLegend.tsx`

* Explain source types
* Explain map/heatmap semantics
* Explain relevant visual encodings

Database queries and source normalization should not be embedded inside these presentation components unless there is a compelling reason.

---

## 20. Responsive Design

The dashboard must work on:

* Mobile
* Tablet
* Laptop
* Desktop

Do not design exclusively around a large desktop viewport.

On small screens, prioritize:

1. Current air-quality information
2. Map interaction
3. Sensor/station details
4. Secondary historical/contextual information

---

## 21. Accessibility

Use:

* semantic HTML;
* meaningful labels;
* keyboard-accessible controls;
* visible focus states;
* accessible buttons.

Do not rely exclusively on color for:

* source distinction;
* air-quality severity;
* status.

Where practical, provide textual equivalents for important map information.

---

## 22. Styling

Use:

* Tailwind CSS
* Lucide React

Prefer:

* clear hierarchy;
* readable typography;
* restrained visual design;
* consistent spacing;
* responsive layouts;
* simple controls.

Theme behavior:

* Light mode is the default for first-time visitors.
* Preserve an explicit light/dark preference stored by the user.
* Keep both themes legible and accessible; changes scoped to one theme must not unintentionally alter the other.

Do not introduce another UI framework without explicit approval.

---

## 23. Performance

The website should remain practical on ordinary mobile devices and network connections.

Prefer:

* server-side initial data fetching;
* dynamic loading of the map;
* bounded Supabase queries;
* limited client-side JavaScript;
* efficient marker rendering;
* efficient heatmap updates.

Avoid:

* loading the entire historical database into the browser;
* unnecessary polling;
* duplicate requests;
* duplicate realtime subscriptions;
* excessive React re-renders;
* large dependencies for trivial features.

---

## 24. Dependency Discipline

Do **NOT** install additional libraries such as:

* Redux
* Axios
* Zustand
* Material UI
* Mapbox
* another mapping library

without explicit permission.

Before adding any dependency:

1. Check whether the existing stack already solves the problem.
2. Prefer a small native implementation when reasonable.
3. Avoid duplicate libraries solving the same problem.
4. Keep the dependency footprint small.

---

## 25. No Unnecessary Architecture

Do not introduce:

* microservices;
* GraphQL;
* a second database;
* a separate backend;
* unnecessary API proxies;
* unnecessary global state;
* CMS infrastructure;
* authentication systems;
* a second mapping framework;

unless explicitly required.

The intended architecture is a **simple Next.js + Supabase public application**.

---

## 26. Raw vs Derived Data

Never confuse raw observations with derived values.

Examples of derived data:

* AQI
* averages
* rolling averages
* aggregates
* interpolated values
* smoothed values
* heatmap intensity
* trends

When deriving values:

* do not overwrite the raw measurement;
* keep the derived value conceptually separate;
* do not display the derived result as if it were directly measured.

---

## 27. Historical Data Integrity

Historical measurements must remain historical.

Do not:

* overwrite old records with newer values;
* replace old timestamps;
* delete observations merely because a newer observation exists;
* collapse distinct observations without an explicit aggregation requirement.

When showing historical data, identify:

* source;
* source/station/sensor ID;
* timestamp;
* metric.

---

## 28. Database Modification Discipline

Before changing the database:

1. Determine whether the feature can use the existing schema.
2. Avoid unnecessary migrations.
3. Preserve existing data.
4. Avoid destructive changes.
5. Update application types and normalization logic consistently.

Do not change the schema merely to make a component easier to implement.

---

## 29. Code Quality

Use TypeScript meaningfully.

Prefer:

* explicit domain types;
* null-safe handling;
* reusable utilities;
* clear names;
* small functions;
* centralized domain logic.

Avoid:

* unnecessary `any`;
* `@ts-ignore`;
* giant components;
* duplicated logic;
* magic constants;
* type casts used only to silence legitimate errors.

Never use:

```ts
// @ts-ignore
```

or:

```ts
const value: any = ...
```

as a shortcut around unresolved type problems.

---

## 30. Development Discipline

Before changing code:

1. Inspect the existing implementation.
2. Understand the current architecture.
3. Reuse existing components/utilities.
4. Make the smallest change that solves the requested task.
5. Avoid unrelated refactors.
6. Avoid unnecessary dependencies.
7. Preserve existing working behavior.

Do not rewrite the project simply because another architecture looks cleaner.

---

## 31. No Fabricated Product Requirements

Do not silently invent:

* new user roles;
* authentication;
* AQI standards;
* sensor metadata;
* government partnerships;
* additional data sources;
* scientific claims;
* privacy policies;
* hardware requirements;
* external services.

When something is unspecified, choose the simplest implementation consistent with the existing architecture.

Do not make irreversible architectural changes based solely on assumptions.

---

## 32. Testing & Edge Cases

When implementing meaningful data logic, consider:

* `null` PM2.5;
* `null` PM10;
* invalid coordinates;
* stale timestamps;
* empty datasets;
* mixed official/community records;
* missing source metadata;
* duplicate observations;
* database errors;
* realtime disconnects.

Do not assume all production data will be perfectly clean.

---

## 33. Validation

For meaningful code changes:

* run the project's available typecheck/lint/build checks;
* verify the affected UI;
* check client/server boundaries;
* check Leaflet SSR behavior;
* check Supabase imports and queries.

At minimum, use the project's existing validation scripts where available.

Never use `@ts-ignore`, `any`, or disabled lint rules to force a passing build.

---

## 34. Definition of Done

A feature is complete when it:

* follows the existing architecture;
* respects the Leaflet SSR boundary;
* uses the correct Supabase client;
* preserves source provenance;
* handles null/missing values correctly;
* handles stale data correctly;
* does not fabricate environmental data;
* uses explicit units;
* works responsively;
* does not introduce unnecessary dependencies;
* does not break unrelated functionality;
* passes available project validation checks.

---

## 35. Final Architecture

The intended high-level flow is:

```text
Official Government Data ──┐
                           │
Community/User Data ───────┤
                           ▼
                    Supabase / PostgreSQL
                           │
                           ▼
                  Normalize to
              AirQualityObservation[]
                           │
                           ▼
                     Next.js App
                           │
                           ▼
                Client Map Component
                           │
                           ▼
                Leaflet + OpenStreetMap
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
        Sensor/Station               Heatmap
           Markers
```

The application should remain a **simple, source-aware, public air-quality visualization platform for Ulaanbaatar**.

The web application is responsible for consuming, normalizing, storing, and visualizing air-quality data. Do not introduce assumptions about physical sensor hardware or firmware unless a specific web-development task requires them.
