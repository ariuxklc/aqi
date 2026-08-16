# Ulaanbaatar Air Quality Platform

A public, source-aware map of PM2.5 and PM10 observations in Ulaanbaatar. The application uses Next.js App Router, Supabase, Tailwind CSS, and Leaflet.

The interface defaults to light mode for first-time visitors. The top-right theme control switches between light and dark basemaps and preserves the visitor's explicit preference in local storage.

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Useful validation commands:

```bash
npm run lint
npm run build
```

## Environment

Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` may be used instead of `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The server client accepts either public-key name. Do not expose a Supabase service-role key.

## Database

The production query reads community observations from `aqi_readings`:

| Column | PostgreSQL type | Meaning |
| --- | --- | --- |
| `id` | `bigint` | Primary key |
| `sensor_id` | `text` | Stable community sensor identifier |
| `lat` | `double precision` | Latitude |
| `lng` | `double precision` | Longitude |
| `pm25` | `double precision`, nullable | Raw PM2.5 concentration in µg/m³ |
| `pm10` | `double precision`, nullable | Raw PM10 concentration in µg/m³ |
| `created_at` | `timestamptz` | Original observation time |

Official observations are read separately from `official_aqi_readings`:

| Column | PostgreSQL type | Meaning |
| --- | --- | --- |
| `id` | `bigint` | Primary key |
| `station_id` | `text` | Stable official station identifier |
| `station_name` | `text`, nullable | Public station name |
| `lat` | `double precision` | Latitude |
| `lng` | `double precision` | Longitude |
| `pm25` | `double precision`, nullable | Raw PM2.5 concentration in µg/m³ |
| `pm10` | `double precision`, nullable | Raw PM10 concentration in µg/m³ |
| `observed_at` | `timestamptz` | Original observation time |

Enable appropriate Row Level Security for public read-only access to both tables. Each query selects only its required fields and retains one latest eligible record per source ID before both canonical arrays are combined.

## Data provenance

Every canonical observation retains its source type, source ID, coordinates, raw PM values, and original timestamp. Missing PM values remain `null` and display as `N/A`; raw concentrations are never presented as an AQI score.

The `aqi_readings` query path always produces community observations. The independently controlled `official_aqi_readings` query path always produces official observations. The application never guesses source provenance from names or measurements. Development-only fixtures may appear when both database sources are available but empty; the UI labels them clearly, and production never substitutes fabricated readings.

The colored ambient halo is a derived spatial visualization based only on available station readings for the selected PM2.5 or PM10 metric. It is not a direct measurement at unmonitored locations.

## Historical playback

Use the bottom control deck to choose a date and scrub the day in 15-minute increments. The URL stores the selected instant in the `timestamp` query parameter. Slider movement stays local while dragging and requests a new server snapshot only when the control is released or keyboard interaction ends.

Historical queries include observations at or before the selected instant, retain the latest eligible reading per sensor, and evaluate freshness relative to that snapshot. **Live Mode** removes the timestamp parameter and returns to current conditions.
