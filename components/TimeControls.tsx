"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Radio,
  RotateCcw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ULAANBAATAR_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_SNAPSHOT_MINUTES = 23 * 60 + 45;
const TIME_TICKS = [0, 240, 480, 720, 960, 1200, MAX_SNAPSHOT_MINUTES] as const;

interface UlaanbaatarDateTime {
  date: string;
  minutes: number;
}

function getUlaanbaatarDateTime(timestamp?: string | null): UlaanbaatarDateTime {
  const parsed = timestamp ? new Date(timestamp) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const shifted = new Date(safeDate.getTime() + ULAANBAATAR_OFFSET_MS);
  const iso = shifted.toISOString();

  return {
    date: iso.slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function getMaximumMinutesForDate(
  date: string,
  now: UlaanbaatarDateTime,
): number {
  if (date < now.date) return MAX_SNAPSHOT_MINUTES;
  if (date > now.date) return 0;
  return Math.min(
    MAX_SNAPSHOT_MINUTES,
    Math.floor(now.minutes / 15) * 15,
  );
}

function toTimestamp(date: string, minutes: number): string {
  const startOfDay = new Date(`${date}T00:00:00+08:00`);
  return new Date(startOfDay.getTime() + minutes * 60_000).toISOString();
}

function shiftCalendarDate(date: string, dayOffset: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shiftedDate = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return shiftedDate.toISOString().slice(0, 10);
}

export default function TimeControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const controlsRef = useRef<HTMLElement>(null);
  const drawerPointerStartY = useRef<number | null>(null);
  const handledDrawerGesture = useRef(false);
  const selectedTimestamp = searchParams.get("timestamp");
  const [selectedDate, setSelectedDate] = useState(
    () => getUlaanbaatarDateTime(selectedTimestamp).date,
  );
  const [selectedMinutes, setSelectedMinutes] = useState(
    () => {
      const target = getUlaanbaatarDateTime(selectedTimestamp);
      return Math.min(
        target.minutes,
        getMaximumMinutesForDate(target.date, getUlaanbaatarDateTime()),
      );
    },
  );
  const [hasPendingScrub, setHasPendingScrub] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [nowInUlaanbaatar, setNowInUlaanbaatar] = useState(() =>
    getUlaanbaatarDateTime(),
  );
  const lastCommittedTimestamp = useRef<string | null>(selectedTimestamp);
  const isHistorical = Boolean(selectedTimestamp);
  const isViewingSnapshot = isHistorical || hasPendingScrub;
  const sliderMaximum = getMaximumMinutesForDate(
    selectedDate,
    nowInUlaanbaatar,
  );
  const availableTrackPercent =
    (sliderMaximum / MAX_SNAPSHOT_MINUTES) * 100;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const controlsElement = controlsRef.current;
    if (!controlsElement) return;

    const updateMapControlOffset = () => {
      const controlsTop = controlsElement.getBoundingClientRect().top;
      const bottomOffset = Math.max(0, window.innerHeight - controlsTop + 10);
      document.documentElement.style.setProperty(
        "--aq-map-control-bottom",
        `${bottomOffset}px`,
      );
    };

    const resizeObserver = new ResizeObserver(updateMapControlOffset);
    resizeObserver.observe(controlsElement);
    window.addEventListener("resize", updateMapControlOffset);
    updateMapControlOffset();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMapControlOffset);
      document.documentElement.style.removeProperty(
        "--aq-map-control-bottom",
      );
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowInUlaanbaatar(getUlaanbaatarDateTime());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const target = getUlaanbaatarDateTime(selectedTimestamp);
    setSelectedDate(target.date);
    setSelectedMinutes(
      Math.min(
        target.minutes,
        getMaximumMinutesForDate(target.date, getUlaanbaatarDateTime()),
      ),
    );
    setHasPendingScrub(false);
    lastCommittedTimestamp.current = selectedTimestamp;
  }, [selectedTimestamp]);

  function setHistoricalTime(date: string, minutes: number) {
    if (!date) return;
    const timestamp = toTimestamp(date, minutes);

    if (timestamp === lastCommittedTimestamp.current) {
      setHasPendingScrub(false);
      return;
    }

    lastCommittedTimestamp.current = timestamp;
    const params = new URLSearchParams(searchParams.toString());
    params.set("timestamp", timestamp);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  function handleDateChange(date: string) {
    if (!date) return;
    const nextMinutes = Math.min(
      selectedMinutes,
      getMaximumMinutesForDate(date, getUlaanbaatarDateTime()),
    );
    setSelectedDate(date);
    setSelectedMinutes(nextMinutes);
    setHistoricalTime(date, nextMinutes);
  }

  function moveDateBy(dayOffset: number) {
    handleDateChange(shiftCalendarDate(selectedDate, dayOffset));
  }

  function handleTimeChange(minutes: number) {
    setSelectedMinutes(minutes);
    setHasPendingScrub(true);
  }

  function commitTimeChange(minutes: number) {
    setSelectedMinutes(minutes);
    setHistoricalTime(selectedDate, minutes);
  }

  function returnToLiveMode() {
    setHasPendingScrub(false);
    lastCommittedTimestamp.current = null;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("timestamp");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function handleDrawerPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    drawerPointerStartY.current = event.clientY;
    handledDrawerGesture.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDrawerPointerUp(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    const startY = drawerPointerStartY.current;
    drawerPointerStartY.current = null;
    if (startY === null) return;

    const distance = event.clientY - startY;
    if (Math.abs(distance) < 28) return;

    handledDrawerGesture.current = true;
    setIsCollapsed(distance > 0);
  }

  function toggleDrawer() {
    if (handledDrawerGesture.current) {
      handledDrawerGesture.current = false;
      return;
    }
    setIsCollapsed((current) => !current);
  }

  return (
    <section
      ref={controlsRef}
      aria-label="Historical time controls"
      className={`aq-time-controls relative w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 text-white shadow-2xl backdrop-blur-md ${isCollapsed ? "p-2 sm:p-4" : "p-4"}`}
    >
      {hasMounted && (
        <div
          id="aq-source-toggle-slot"
          className="absolute -top-12 right-0 z-10"
        />
      )}

      <button
        type="button"
        onClick={toggleDrawer}
        onPointerDown={handleDrawerPointerDown}
        onPointerUp={handleDrawerPointerUp}
        onPointerCancel={() => {
          drawerPointerStartY.current = null;
        }}
        aria-expanded={!isCollapsed}
        aria-controls="historical-control-content"
        className={`aq-drawer-toggle mx-auto flex h-6 w-16 touch-none items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:hidden ${isCollapsed ? "" : "mb-2"}`}
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-zinc-500" />
        <span className="sr-only">
          {isCollapsed ? "Show time controls" : "Hide time controls"}
        </span>
      </button>

      <div
        id="historical-control-content"
        className={`${isCollapsed ? "hidden sm:flex" : "flex"} flex-col gap-4 lg:flex-row lg:items-end`}
      >
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:min-w-72">
            <label
              className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300"
              htmlFor="snapshot-date"
            >
              <CalendarDays aria-hidden="true" className="h-4 w-4 text-emerald-400" />
              Snapshot date
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveDateBy(-1)}
                aria-label="Previous day"
                className="aq-date-step grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-white transition hover:border-emerald-500 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </button>
              <input
                id="snapshot-date"
                type="date"
                value={selectedDate}
                max={nowInUlaanbaatar.date}
                onChange={(event) => handleDateChange(event.target.value)}
                className="dark-date-input h-11 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-center text-sm font-semibold text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />
              <button
                type="button"
                onClick={() => moveDateBy(1)}
                disabled={selectedDate >= nowInUlaanbaatar.date}
                aria-label="Next day"
                className="aq-date-step grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-white transition hover:border-emerald-500 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={returnToLiveMode}
            className="inline-flex h-11 items-center justify-center gap-2 self-center rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-zinc-950 sm:self-auto"
          >
            {isViewingSnapshot ? (
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Radio aria-hidden="true" className="h-4 w-4" />
            )}
            Live Mode
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="snapshot-time"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300"
            >
              <Clock3 aria-hidden="true" className="h-4 w-4 text-emerald-400" />
              24-hour time scrubber
            </label>
            <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100" role="status">
              {isViewingSnapshot ? (
                <>
                  Viewing Snapshot at{" "}
                  <strong className="font-extrabold text-white">
                    {formatMinutes(selectedMinutes)}
                  </strong>
                </>
              ) : (
                <strong className="font-extrabold text-emerald-300">
                  Viewing live conditions
                </strong>
              )}
            </div>
          </div>

          <div className="relative h-[22px] w-full">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-2 h-1.5 rounded-full border border-zinc-700 bg-zinc-800"
            />
            <input
              id="snapshot-time"
              type="range"
              min="0"
              max={sliderMaximum}
              step="15"
              value={selectedMinutes}
              disabled={sliderMaximum === 0}
              onChange={(event) => handleTimeChange(Number(event.target.value))}
              onPointerUp={(event) =>
                commitTimeChange(Number(event.currentTarget.value))
              }
              onPointerCancel={(event) =>
                commitTimeChange(Number(event.currentTarget.value))
              }
              onKeyUp={(event) =>
                commitTimeChange(Number(event.currentTarget.value))
              }
              onBlur={(event) =>
                commitTimeChange(Number(event.currentTarget.value))
              }
              className="time-scrubber absolute left-0 top-0 block disabled:cursor-not-allowed disabled:opacity-50"
              style={{ width: `${availableTrackPercent}%` }}
              aria-valuetext={formatMinutes(selectedMinutes)}
            />
          </div>
          <div className="relative mt-1.5 h-4 text-[10px] font-semibold tabular-nums text-zinc-200 sm:text-xs" aria-hidden="true">
            {TIME_TICKS.map((tick) => (
              <span
                key={tick}
                className={`absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full ${tick > sliderMaximum ? "text-zinc-600" : "text-zinc-200"}`}
                style={{ left: `${(tick / MAX_SNAPSHOT_MINUTES) * 100}%` }}
              >
                {formatMinutes(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
