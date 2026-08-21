import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const DATA_DIR = path.resolve("data");
const BATCH_SIZE = 500;
const SQL_BATCH_SIZE = 100;
const POLLUTANT_KEYS = ["pm25", "pm10", "o3", "no2", "co", "so2"];

const COLUMN_INDEX = {
  pm10: 1,
  pm25: 3,
  o3: 5,
  no2: 7,
  co: 9,
  so2: 11,
};

// Coordinate provenance:
// - Legacy NAMEM/APRD stations use DMS coordinates from:
//   "Assessment of COVID-19 Impacts on Air Quality in Ulaanbaatar, Mongolia..."
//   Aerosol and Air Quality Research, Table 2.
// - Added UB network points use the mongolstats UB AQ station table where noted.
// - Named-place installs use public place coordinates for the named site.
const STATION_COORDINATES = {
  "1-r khoroolol": {
    stationId: "ub-1-r-khoroolol",
    stationName: "1-r khoroolol",
    lat: 47.9188,
    lng: 106.8478,
    coordinateSource: "AAQR Table 2, 1-r khoroolol",
  },
  "1-p khoroolol": {
    stationId: "ub-1-r-khoroolol",
    stationName: "1-r khoroolol",
    lat: 47.9188,
    lng: 106.8478,
    coordinateSource: "AAQR Table 2, 1-r khoroolol",
  },
  "Urgakh naran": {
    stationId: "ub-urgakh-naran",
    stationName: "Urgakh naran",
    lat: 47.8665,
    lng: 107.118,
    coordinateSource: "AAQR Table 2, Urgakh naran",
  },
  Sharkhad: {
    stationId: "ub-sharkhad",
    stationName: "Sharkhad",
    lat: 47.93375,
    lng: 107.0103,
    coordinateSource: "mongolstats UB AQ station table",
  },
  "Amgalan-3": {
    stationId: "ub-amgalan-3",
    stationName: "Amgalan",
    lat: 47.9135,
    lng: 106.998,
    coordinateSource: "AAQR Table 2, Amgalan",
  },
  "Mongol Temuulel school": {
    stationId: "ub-17-mongol-temuulel-school",
    stationName: "Mongol Temuulel school (UB-17)",
    lat: 47.9132,
    lng: 106.9977,
    coordinateSource:
      "Approximate: Mongol Aspiration/Temuulel School, BZD 36, Hunnu Street/Dunjingarav area",
  },
  "Tolgoit-1": {
    stationId: "ub-tolgoit-1",
    stationName: "Tolgoit",
    lat: 47.9223,
    lng: 106.7944,
    coordinateSource: "AAQR Table 2, Tolgoit",
  },
  "Bayankhoshuu-6": {
    stationId: "ub-bayankhoshuu-6",
    stationName: "Bayankhoshuu",
    lat: 47.9578,
    lng: 106.823,
    coordinateSource: "AAQR Table 2, Bayankhoshuu",
  },
  "Kindergarten 79": {
    stationId: "ub-19-kindergarten-79",
    stationName: "Kindergarten 79 (UB-19)",
    lat: 47.9095,
    lng: 106.824,
    coordinateSource:
      "Approximate: SHD 18th khoroo, 5 shar area public kindergarten listing",
  },
  "100 ail": {
    stationId: "ub-100-ail",
    stationName: "100 ail",
    lat: 47.933,
    lng: 106.9214,
    coordinateSource: "AAQR Table 2, 100 ail",
  },
  "5 buudal": {
    stationId: "ub-5-buudal",
    stationName: "5 buudal",
    lat: 47.9545,
    lng: 106.914833,
    coordinateSource: "mongolstats UB AQ station table",
  },
  "Dambadarjaa-5": {
    stationId: "ub-dambadarjaa-5",
    stationName: "Dambadarjaa",
    lat: 47.98825,
    lng: 106.951167,
    coordinateSource: "mongolstats UB AQ station table",
  },
  "Misheel Expo": {
    stationId: "ub-misheel-expo",
    stationName: "Misheel Expo",
    lat: 47.894,
    lng: 106.8822,
    coordinateSource: "AAQR Table 2, Misheel",
  },
  "Vitafit Milk": {
    stationId: "ub-vitafit-milk",
    stationName: "Vitafit Milk",
    lat: 47.9051,
    lng: 106.8419,
    coordinateSource: "AAQR Table 2, Mongol gazar / Khan-Uul 20th khoroo install",
  },
  "Bogd Khaan Palace Museum": {
    stationId: "ub-bogd-khaan-palace-museum",
    stationName: "Bogd Khaan Palace Museum",
    lat: 47.89734,
    lng: 106.90705,
    coordinateSource: "Named-place coordinate, Bogd Khaan Palace Museum",
  },
  Yarmag: {
    stationId: "ub-yarmag",
    stationName: "Yarmag",
    lat: 47.864,
    lng: 106.8053,
    coordinateSource: "Approximate: Yarmag central area near Naadamchdiin zam",
  },
  "Nisekh-4": {
    stationId: "ub-nisekh-4",
    stationName: "Nisekh",
    lat: 47.8644,
    lng: 106.7783,
    coordinateSource: "AAQR Table 2, Nisekh",
  },
  Khailaast: {
    stationId: "ub-khailaast",
    stationName: "Khailaast",
    lat: 47.963528,
    lng: 106.893889,
    coordinateSource: "mongolstats UB AQ station table",
  },
  "Baruun 4 zam": {
    stationId: "ub-baruun-4-zam",
    stationName: "Baruun 4 zam",
    lat: 47.9155,
    lng: 106.8945,
    coordinateSource: "AAQR Table 2, Baruun 4 zam",
  },
  "MNTV-2": {
    stationId: "ub-mntv-2",
    stationName: "MNB / MNTV-2",
    lat: 47.91847,
    lng: 106.88228,
    coordinateSource: "PAH/PM station table, MNB",
  },
  "Kindergarten 133": {
    stationId: "ub-18-kindergarten-133",
    stationName: "Kindergarten 133 (UB-18)",
    lat: 47.921,
    lng: 106.879,
    coordinateSource: "Approximate: BGD 9th khoroo public kindergarten listing",
  },
  Nalaikh: {
    stationId: "ub-nalaikh",
    stationName: "Nalaikh",
    lat: 47.7736,
    lng: 107.2657,
    coordinateSource: "Approximate: Nalaikh 7th khoroo official station area",
  },
  "Бөхийн өргөө": {
    stationId: "ub-bukhiin-urguu",
    stationName: "Bukhiin urguu",
    lat: 47.9176,
    lng: 106.9375,
    coordinateSource: "AAQR Table 2, Bukhiin urguu",
  },
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...valueParts] = line.split("=");
        return [key, valueParts.join("=").replace(/^["']|["']$/g, "")];
      }),
  );
}

function stationKeyFromTitle(title) {
  const trimmed = String(title ?? "").trim();
  const parenIndex = trimmed.indexOf(" (");
  return parenIndex === -1 ? trimmed : trimmed.slice(0, parenIndex).trim();
}

function parseMeasurement(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));

  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseObservedAt(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }

  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour] = match;
  return `${year}-${month}-${day}T${hour}:00:00+08:00`;
}

function getXlsFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DATA_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith(".xls"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function parseWorkbook(fileName) {
  const workbook = XLSX.readFile(path.join(DATA_DIR, fileName), {
    cellDates: true,
    raw: true,
  });
  const sheet = workbook.Sheets.Sheet1 ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const stationTitle = rows[0]?.[0];
  const stationKey = stationKeyFromTitle(stationTitle);
  const station = STATION_COORDINATES[stationKey];
  if (!station) {
    throw new Error(
      [
        `No coordinate mapping for "${stationKey}" from ${fileName}.`,
        "Add this station to STATION_COORDINATES before importing so provenance and coordinates stay explicit.",
      ].join(" "),
    );
  }

  const payload = [];
  for (const row of rows.slice(4)) {
    const observedAt = parseObservedAt(row[0]);
    if (!observedAt) {
      continue;
    }

    payload.push({
      station_id: station.stationId,
      station_name: station.stationName,
      lat: station.lat,
      lng: station.lng,
      pm25: parseMeasurement(row[COLUMN_INDEX.pm25]),
      pm10: parseMeasurement(row[COLUMN_INDEX.pm10]),
      o3: parseMeasurement(row[COLUMN_INDEX.o3]),
      no2: parseMeasurement(row[COLUMN_INDEX.no2]),
      co: parseMeasurement(row[COLUMN_INDEX.co]),
      so2: parseMeasurement(row[COLUMN_INDEX.so2]),
      observed_at: observedAt,
    });
  }

  return {
    fileName,
    stationKey,
    station,
    payload,
  };
}

function summarize(parsedFiles, payload) {
  const byStation = parsedFiles.map(({ fileName, stationKey, station, payload: rows }) => {
    const nonEmptyRows = rows.filter((row) =>
      POLLUTANT_KEYS.some((key) => row[key] !== null),
    );

    return {
      fileName,
      stationKey,
      stationId: station.stationId,
      stationName: station.stationName,
      lat: station.lat,
      lng: station.lng,
      coordinateSource: station.coordinateSource,
      rows: rows.length,
      nonEmptyRows: nonEmptyRows.length,
      firstObservedAt: rows.at(-1)?.observed_at ?? null,
      lastObservedAt: rows[0]?.observed_at ?? null,
    };
  });

  const missingValueCounts = POLLUTANT_KEYS.map((key) => ({
    key,
    nulls: payload.filter((row) => row[key] === null).length,
    values: payload.filter((row) => row[key] !== null).length,
  }));

  return {
    fileCount: parsedFiles.length,
    rowCount: payload.length,
    stationCount: new Set(payload.map((row) => row.station_id)).size,
    byStation,
    missingValueCounts,
  };
}

function printSummary(summary) {
  console.log("");
  console.log("Official AQI import preview");
  console.log("---------------------------");
  console.log(`Files: ${summary.fileCount}`);
  console.log(`Rows parsed: ${summary.rowCount}`);
  console.log(`Stations: ${summary.stationCount}`);

  if (summary.byStation.length > 0) {
    console.log("");
    console.table(
      summary.byStation.map((station) => ({
        file: station.fileName,
        station: station.stationName,
        rows: station.rows,
        with_values: station.nonEmptyRows,
        first: station.firstObservedAt,
        last: station.lastObservedAt,
      })),
    );
  }

  console.log("Pollutant value counts:");
  console.table(summary.missingValueCounts);
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "null";
    }

    return String(value);
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function toInsertSql(rows) {
  const columns = [
    "station_id",
    "station_name",
    "lat",
    "lng",
    "pm25",
    "pm10",
    "o3",
    "no2",
    "co",
    "so2",
    "observed_at",
  ];

  const values = rows
    .map(
      (row) =>
        `(${columns
          .map((column) => sqlString(row[column]))
          .join(", ")})`,
    )
    .join(",\n");

  return `insert into public.official_aqi_readings (${columns.join(", ")})\nvalues\n${values};\n`;
}

function writeSqlBatches(payload, sqlDir) {
  fs.rmSync(sqlDir, { recursive: true, force: true });
  fs.mkdirSync(sqlDir, { recursive: true });

  fs.writeFileSync(
    path.join(sqlDir, "000_clear.sql"),
    [
      "delete from public.official_aqi_readings where observed_at is not null;",
      "",
    ].join("\n"),
  );

  for (let index = 0; index < payload.length; index += SQL_BATCH_SIZE) {
    const batchNumber = String(index / SQL_BATCH_SIZE + 1).padStart(3, "0");
    fs.writeFileSync(
      path.join(sqlDir, `${batchNumber}_insert_official_aqi_readings.sql`),
      toInsertSql(payload.slice(index, index + SQL_BATCH_SIZE)),
    );
  }

  fs.writeFileSync(
    path.join(sqlDir, "999_verify.sql"),
    [
      "select",
      "  count(*)::int as official_rows,",
      "  count(distinct station_id)::int as official_stations,",
      "  min(observed_at) as first_observed_at,",
      "  max(observed_at) as last_observed_at",
      "from public.official_aqi_readings;",
      "",
      "select count(*)::int as community_rows from public.aqi_readings;",
      "",
    ].join("\n"),
  );
}

async function deleteAllRows(supabase, tableName, timestampColumn) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .not(timestampColumn, "is", null);

  if (error) {
    throw new Error(`Failed to clear ${tableName}: ${error.message}`);
  }
}

async function insertInBatches(supabase, tableName, rows) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await supabase.from(tableName).insert(batch);
    if (error) {
      throw new Error(
        `Failed to insert ${tableName} batch ${index / BATCH_SIZE + 1}: ${error.message}`,
      );
    }
    console.log(`Inserted ${Math.min(index + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }
}

function rowKey(row) {
  const observedAt = new Date(row.observed_at);

  if (Number.isNaN(observedAt.valueOf())) {
    return `${row.station_id}|${row.observed_at}`;
  }

  return `${row.station_id}|${observedAt.toISOString()}`;
}

function dateRangeForRows(rows) {
  const timestamps = rows
    .map((row) => new Date(row.observed_at))
    .filter((date) => !Number.isNaN(date.valueOf()))
    .map((date) => date.valueOf());

  if (timestamps.length === 0) {
    return null;
  }

  return {
    first: new Date(Math.min(...timestamps)).toISOString(),
    last: new Date(Math.max(...timestamps)).toISOString(),
  };
}

async function getExistingOfficialKeys(supabase, rows) {
  const range = dateRangeForRows(rows);
  if (!range) {
    return new Set();
  }

  const existingKeys = new Set();
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("official_aqi_readings")
      .select("station_id, observed_at")
      .gte("observed_at", range.first)
      .lte("observed_at", range.last)
      .range(start, start + pageSize - 1);

    if (error) {
      throw new Error(`Failed to check existing official rows: ${error.message}`);
    }

    for (const row of data) {
      existingKeys.add(rowKey(row));
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return existingKeys;
}

async function appendOfficialRows(supabase, rows) {
  const existingKeys = await getExistingOfficialKeys(supabase, rows);
  const rowsToInsert = rows.filter((row) => !existingKeys.has(rowKey(row)));
  const skippedRows = rows.length - rowsToInsert.length;

  console.log(`Existing matching rows skipped: ${skippedRows}`);

  if (rowsToInsert.length === 0) {
    console.log("No new official rows to import.");
    return { insertedRows: 0, skippedRows };
  }

  console.log(`Importing new official rows: ${rowsToInsert.length}`);
  await insertInBatches(supabase, "official_aqi_readings", rowsToInsert);
  return { insertedRows: rowsToInsert.length, skippedRows };
}

async function verifySeed(supabase) {
  const { count: officialRows, error: officialCountError } = await supabase
    .from("official_aqi_readings")
    .select("station_id", { count: "exact", head: true });

  if (officialCountError) {
    throw new Error(`Failed to count official rows: ${officialCountError.message}`);
  }

  const stationIds = new Set();
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data: stationRows, error: stationError } = await supabase
      .from("official_aqi_readings")
      .select("station_id")
      .range(start, start + pageSize - 1);

    if (stationError) {
      throw new Error(`Failed to verify station IDs: ${stationError.message}`);
    }

    for (const row of stationRows) {
      stationIds.add(row.station_id);
    }

    if (stationRows.length < pageSize) {
      break;
    }
  }

  const { data: rangeRows, error: rangeError } = await supabase
    .from("official_aqi_readings")
    .select("observed_at")
    .order("observed_at", { ascending: true })
    .limit(1);

  if (rangeError) {
    throw new Error(`Failed to verify first timestamp: ${rangeError.message}`);
  }

  const { data: latestRows, error: latestError } = await supabase
    .from("official_aqi_readings")
    .select("observed_at")
    .order("observed_at", { ascending: false })
    .limit(1);

  if (latestError) {
    throw new Error(`Failed to verify latest timestamp: ${latestError.message}`);
  }

  const { count: communityRows, error: communityCountError } = await supabase
    .from("aqi_readings")
    .select("sensor_id", { count: "exact", head: true });

  if (communityCountError) {
    throw new Error(`Failed to count community rows: ${communityCountError.message}`);
  }

  return {
    officialRows,
    officialStations: stationIds.size,
    firstObservedAt: rangeRows[0]?.observed_at ?? null,
    lastObservedAt: latestRows[0]?.observed_at ?? null,
    communityRows,
  };
}

async function seedWithRpc(supabase, rows, { clearExisting }) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await supabase.rpc("codex_seed_official_aqi", {
      payload: batch,
      clear_existing: clearExisting && index === 0,
    });

    if (error) {
      throw new Error(`Failed RPC seed batch ${index / BATCH_SIZE + 1}: ${error.message}`);
    }

    console.log(`Seeded ${Math.min(index + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }

  const { data, error } = await supabase.rpc("codex_verify_official_aqi");
  if (error) {
    throw new Error(`Failed RPC verification: ${error.message}`);
  }

  console.log(JSON.stringify(data, null, 2));
}

function printHelp() {
  console.log(`
Usage:
  node scripts/seed-official-aqi.mjs
  node scripts/seed-official-aqi.mjs --import
  node scripts/seed-official-aqi.mjs --replace-official
  node scripts/seed-official-aqi.mjs --verify

Default:
  Preview every .xls file in data/ without writing to Supabase.

Options:
  --import            Append new official rows and skip station/timestamp duplicates.
  --replace-official  Clear official_aqi_readings, then import every parsed row.
  --replace-all       Legacy mode: clear both official_aqi_readings and aqi_readings.
  --execute-rpc       Use the Supabase RPC importer, replacing official rows.
  --execute           Legacy alias for --replace-all.
  --verify            Print current Supabase row counts/date ranges.
  --write-sql-dir DIR Write SQL batches for manual import.
  --json              Print the dry-run summary as JSON.
  --help              Show this help.
`);
}

async function main() {
  const shouldShowHelp = process.argv.includes("--help") || process.argv.includes("-h");
  if (shouldShowHelp) {
    printHelp();
    return;
  }

  const shouldExecute = process.argv.includes("--execute");
  const shouldImport = process.argv.includes("--import");
  const shouldReplaceOfficial = process.argv.includes("--replace-official");
  const shouldReplaceAll = process.argv.includes("--replace-all") || shouldExecute;
  const shouldExecuteRpc = process.argv.includes("--execute-rpc");
  const shouldVerify = process.argv.includes("--verify");
  const shouldPrintJson = process.argv.includes("--json");
  const sqlDirArgIndex = process.argv.indexOf("--write-sql-dir");
  const sqlDir =
    sqlDirArgIndex === -1 ? null : path.resolve(process.argv.at(sqlDirArgIndex + 1) ?? "");
  const envFile = readEnvFile(path.resolve(".env.local"));
  const supabaseUrl = process.env.SUPABASE_URL ?? envFile.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    envFile.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    envFile.SUPABASE_SECRET_KEY;

  const xlsFiles = getXlsFiles();
  if (xlsFiles.length === 0 && !shouldVerify) {
    console.log(`No .xls files found in ${DATA_DIR}. Add files there, then run this again.`);
    return;
  }

  const parsedFiles = xlsFiles.map(parseWorkbook);
  const payload = parsedFiles.flatMap(({ payload: rows }) => rows);
  const summary = summarize(parsedFiles, payload);

  if (shouldPrintJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (!shouldVerify) {
    printSummary(summary);
  }

  if (sqlDir) {
    writeSqlBatches(payload, sqlDir);
    console.log(`Wrote SQL batches to ${sqlDir}`);
  }

  if (!shouldImport && !shouldReplaceOfficial && !shouldReplaceAll && !shouldExecuteRpc && !shouldVerify) {
    console.log("");
    console.log("Dry run only. Re-run with --import to add new rows to Supabase.");
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --execute.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (shouldVerify) {
    console.log(JSON.stringify(await verifySeed(supabase), null, 2));
    return;
  }

  if (shouldExecuteRpc) {
    await seedWithRpc(supabase, payload, { clearExisting: true });
    console.log("Done.");
    return;
  }

  if (shouldImport) {
    await appendOfficialRows(supabase, payload);
    console.log(JSON.stringify(await verifySeed(supabase), null, 2));
    console.log("Done.");
    return;
  }

  console.log("Clearing official_aqi_readings...");
  await deleteAllRows(supabase, "official_aqi_readings", "observed_at");

  if (shouldReplaceAll) {
    console.log("Clearing aqi_readings...");
    await deleteAllRows(supabase, "aqi_readings", "created_at");
  }

  console.log("Seeding official_aqi_readings...");
  await insertInBatches(supabase, "official_aqi_readings", payload);

  console.log(JSON.stringify(await verifySeed(supabase), null, 2));
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
