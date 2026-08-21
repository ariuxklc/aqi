"use client";

import {
  CalendarRange,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Layers3,
  ListFilter,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  createProposedCommunityReportRecords,
  REPORT_MAX_DATE,
  REPORT_MIN_DATE,
  type AirQualityReportRecord,
} from "@/lib/air-quality/reports";
import { PROPOSED_COMMUNITY_NODES } from "@/lib/air-quality/proposed";

type DatasetSource = "combined" | "official" | "community";
type Granularity = "raw" | "hourly";

interface ExportRecord {
  timestamp: string;
  station_id: string;
  station_name: string;
  station_type: string;
  location_name: string;
  pm2_5: number | null;
  pm10: number | null;
}

interface ReportExportProps {
  observedRecords: AirQualityReportRecord[];
}

function getUlaanbaatarDate(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function getHourTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  parsed.setUTCMinutes(0, 0, 0);
  return parsed.toISOString();
}

function average(values: Array<number | null>): number | null {
  const validValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (validValues.length === 0) return null;
  return (
    Math.round(
      (validValues.reduce((total, value) => total + value, 0) /
        validValues.length) *
        10,
    ) / 10
  );
}

function toHourlyAverages(
  records: AirQualityReportRecord[],
): AirQualityReportRecord[] {
  const groupedRecords = new Map<
    string,
    { record: AirQualityReportRecord; pm25: Array<number | null>; pm10: Array<number | null> }
  >();

  for (const record of records) {
    const timestamp = getHourTimestamp(record.timestamp);
    const key = `${timestamp}|${record.stationId}|${record.stationType}`;
    const grouped = groupedRecords.get(key);

    if (grouped) {
      grouped.pm25.push(record.pm25);
      grouped.pm10.push(record.pm10);
      continue;
    }

    groupedRecords.set(key, {
      record: { ...record, timestamp },
      pm25: [record.pm25],
      pm10: [record.pm10],
    });
  }

  return Array.from(groupedRecords.values()).map(({ record, pm25, pm10 }) => ({
    ...record,
    pm25: average(pm25),
    pm10: average(pm10),
  }));
}

function createExportRecords(records: AirQualityReportRecord[]): ExportRecord[] {
  return records.map((record) => ({
    timestamp: record.timestamp,
    station_id: record.stationId,
    station_name: record.stationName,
    station_type: record.stationType,
    location_name: record.locationName,
    pm2_5: record.pm25,
    pm10: record.pm10,
  }));
}

function escapeCsv(value: string | number | null): string {
  if (value === null) return "";
  const stringValue = String(value);
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

const NEIGHBORHOODS = [
  "All neighborhoods",
  "Official Network",
  ...PROPOSED_COMMUNITY_NODES.map((node) => node.neighborhood),
] as const;

export default function ReportExport({ observedRecords }: ReportExportProps) {
  const [source, setSource] = useState<DatasetSource>("combined");
  const [granularity, setGranularity] = useState<Granularity>("hourly");
  const [startDate, setStartDate] = useState(REPORT_MIN_DATE);
  const [endDate, setEndDate] = useState(REPORT_MAX_DATE);
  const [neighborhood, setNeighborhood] = useState<string>("All neighborhoods");
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const scenarioRecords =
      source === "official"
        ? []
        : createProposedCommunityReportRecords(startDate, endDate);
    const records = [...observedRecords, ...scenarioRecords].filter((record) => {
      const localDate = getUlaanbaatarDate(record.timestamp);
      const sourceMatches =
        source === "combined" || record.sourceType === source;
      const neighborhoodMatches =
        neighborhood === "All neighborhoods" ||
        (neighborhood === "Official Network"
          ? record.sourceType === "official"
          : record.locationName === neighborhood);

      return (
        sourceMatches &&
        neighborhoodMatches &&
        localDate >= startDate &&
        localDate <= endDate
      );
    });

    const withGranularity =
      granularity === "hourly" ? toHourlyAverages(records) : records;

    return withGranularity.sort(
      (first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp),
    );
  }, [endDate, granularity, neighborhood, observedRecords, source, startDate]);

  const exportRecords = useMemo(
    () => createExportRecords(filteredRecords),
    [filteredRecords],
  );
  const observedCount = filteredRecords.filter(
    (record) => record.dataStatus === "observed",
  ).length;
  const simulatedCount = filteredRecords.length - observedCount;

  function handleDateChange(
    value: string,
    field: "start" | "end",
  ) {
    if (field === "start") {
      setStartDate(value);
      if (value > endDate) setEndDate(value);
      return;
    }

    setEndDate(value);
    if (value < startDate) setStartDate(value);
  }

  function exportCsv() {
    const headers = [
      "timestamp",
      "station_id",
      "station_name",
      "station_type",
      "location_name",
      "pm2_5",
      "pm10",
    ] as const;
    const csv = [
      headers.join(","),
      ...exportRecords.map((record) =>
        headers.map((header) => escapeCsv(record[header])).join(","),
      ),
    ].join("\n");

    downloadFile(
      `ub-air-quality_${startDate}_${endDate}_${granularity}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
    setDownloadNotice(`Downloaded ${exportRecords.length.toLocaleString()} records as CSV.`);
  }

  function exportJson() {
    downloadFile(
      `ub-air-quality_${startDate}_${endDate}_${granularity}.json`,
      JSON.stringify(exportRecords, null, 2),
      "application/json;charset=utf-8",
    );
    setDownloadNotice(`Downloaded ${exportRecords.length.toLocaleString()} records as JSON.`);
  }

  return (
    <div className="space-y-6">
      <section className="aq-reports-header grid gap-4 border-y border-zinc-800 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <div className="aq-reports-badge flex items-center gap-2 text-cyan-300">
            <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]">
              Public data access
            </p>
          </div>
          <h1 className="aq-reports-title mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Reports and exports
          </h1>
          <p className="aq-reports-subtitle mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Shape a presentation-ready dataset for research, planning, or civic
            advocacy. Raw official records and the proposed community scenario
            remain distinct in every result.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="aq-stat-observed border-l border-cyan-400/50 pl-3 text-zinc-400">
            <span className="aq-stat-number block font-bold text-cyan-200">{observedCount.toLocaleString()}</span>
            observed records
          </div>
          <div className="aq-stat-proposed border-l border-amber-400/50 pl-3 text-zinc-400">
            <span className="aq-stat-number block font-bold text-amber-200">{simulatedCount.toLocaleString()}</span>
            proposed records
          </div>
        </div>
      </section>

      <section className="aq-reports-filters grid gap-x-8 gap-y-5 border-b border-zinc-800 pb-6 lg:grid-cols-2">
        <label className="block">
          <span className="aq-filter-label mb-2 flex items-center gap-2 text-xs font-bold text-zinc-200">
            <Layers3 aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
            Dataset source
          </span>
          <div className="aq-source-selector grid grid-cols-3 gap-1 rounded-md border border-zinc-700 bg-zinc-900 p-1">
            {([
              ["combined", "Combined"],
              ["official", "Official"],
              ["community", "Community"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSource(value)}
                aria-pressed={source === value}
                className={`aq-source-btn min-h-9 rounded px-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  source === value
                    ? "aq-source-btn--active bg-cyan-400 text-zinc-950 shadow-sm"
                    : "aq-source-btn--inactive text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="aq-filter-label mb-2 flex items-center gap-2 text-xs font-bold text-zinc-200">
            <ListFilter aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
            Data granularity
          </span>
          <select
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as Granularity)}
            className="aq-input h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
          >
            <option value="hourly">Hourly averages</option>
            <option value="raw">Raw readings</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="aq-filter-label mb-2 flex items-center gap-2 text-xs font-bold text-zinc-200">
              <CalendarRange aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
              From
            </span>
            <input
              type="date"
              min={REPORT_MIN_DATE}
              max={REPORT_MAX_DATE}
              value={startDate}
              onChange={(event) => handleDateChange(event.target.value, "start")}
              className="aq-input h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
            />
          </label>
          <label className="block">
            <span className="aq-filter-label mb-2 block text-xs font-bold text-zinc-200">To</span>
            <input
              type="date"
              min={REPORT_MIN_DATE}
              max={REPORT_MAX_DATE}
              value={endDate}
              onChange={(event) => handleDateChange(event.target.value, "end")}
              className="aq-input h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
            />
          </label>
        </div>

        <label className="block">
          <span className="aq-filter-label mb-2 flex items-center gap-2 text-xs font-bold text-zinc-200">
            <ListFilter aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
            Neighborhood
          </span>
          <select
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            className="aq-input h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
          >
            {NEIGHBORHOODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="aq-reports-actions grid gap-5 border-b border-zinc-800 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="aq-records-count text-lg font-bold text-white">
            {exportRecords.length.toLocaleString()} records ready
          </p>
          <p className="aq-records-desc mt-1 text-sm text-zinc-400">
            Fields: timestamp, station ID, station name, station type, location,
            PM2.5 and PM10.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exportRecords.length === 0}
            className="aq-export-csv inline-flex h-11 items-center gap-2 rounded-md bg-cyan-400 px-4 text-sm font-bold text-zinc-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={exportRecords.length === 0}
            className="aq-export-json inline-flex h-11 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <FileJson aria-hidden="true" className="h-4 w-4 text-cyan-300" />
            Export JSON
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Dataset preview" className="aq-table-card overflow-hidden rounded-xl border border-zinc-800">
          <div className="aq-table-header border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
              Dataset preview
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="aq-table-thead bg-zinc-900 text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Timestamp</th>
                  <th className="px-4 py-3 font-bold">Station</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">PM2.5</th>
                  <th className="px-4 py-3 font-bold">PM10</th>
                </tr>
              </thead>
              <tbody className="aq-table-tbody divide-y divide-zinc-800 text-zinc-300">
                {exportRecords.slice(0, 7).map((record) => (
                  <tr key={`${record.timestamp}-${record.station_id}`}>
                    <td className="aq-table-time whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-400">
                      {record.timestamp.replace("T", " ").replace(".000Z", "Z")}
                    </td>
                    <td className="aq-table-station px-4 py-3 font-semibold text-zinc-100">{record.station_name}</td>
                    <td className="px-4 py-3">
                      <span className={record.station_type === "proposed_community_node" ? "aq-badge-proposed text-amber-200" : "aq-badge-official text-cyan-200"}>
                        {record.station_type}
                      </span>
                    </td>
                    <td className="aq-table-num px-4 py-3 tabular-nums">{record.pm2_5 ?? "--"}</td>
                    <td className="aq-table-num px-4 py-3 tabular-nums">{record.pm10 ?? "--"}</td>
                  </tr>
                ))}
                {exportRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                      No records match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="aq-provenance-card rounded-xl border-l-4 border-amber-400/50 bg-zinc-900/30 p-4">
          <div className="flex items-center gap-2 text-amber-200">
            <Info aria-hidden="true" className="h-4 w-4" />
            <h2 className="text-sm font-bold">Provenance note</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            Official records come from the July 17 - August 18 historical
            network. Community records in this presentation are simulated
            proposal data, identifiable by <code className="aq-provenance-code">proposed_community_node</code>.
          </p>
          {downloadNotice && (
            <p role="status" className="aq-download-notice mt-4 text-xs font-semibold text-cyan-200">
              {downloadNotice}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
