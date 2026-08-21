import type { NextConfig } from "next";

// React Leaflet manages the map panes imperatively and is incompatible with
// React Activity, which Next enables when cacheComponents is turned on.
const nextConfig: NextConfig = {};

export default nextConfig;
