"use client";

import { Radio, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";

const ULAANBAATAR_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_SNAPSHOT_MINUTES = 23 * 60 + 45;
const WHEEL_ITEM_HEIGHT = 34;
const WHEEL_PADDING_ITEMS = 1;

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

function formatWheelNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

function getDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDate(year: number, month: number, day: number): string {
  return [
    year.toString().padStart(4, "0"),
    formatWheelNumber(month),
    formatWheelNumber(day),
  ].join("-");
}

function clampDateParts(
  year: number,
  month: number,
  day: number,
  maxDate: string,
): string {
  const maxParts = getDateParts(maxDate);
  const clampedYear = Math.min(year, maxParts.year);
  const clampedMonth =
    clampedYear === maxParts.year
      ? Math.min(month, maxParts.month)
      : month;
  const monthDayLimit =
    clampedYear === maxParts.year && clampedMonth === maxParts.month
      ? maxParts.day
      : getDaysInMonth(clampedYear, clampedMonth);
  const clampedDay = Math.min(day, monthDayLimit);

  return buildDate(clampedYear, clampedMonth, clampedDay);
}

function clampDateString(date: string, maxDate: string): string {
  const parts = getDateParts(date);
  return clampDateParts(parts.year, parts.month, parts.day, maxDate);
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

function clampSnapshotMinutes(
  date: string,
  minutes: number,
  now: UlaanbaatarDateTime,
): number {
  return Math.min(
    Math.floor(minutes / 15) * 15,
    getMaximumMinutesForDate(date, now),
  );
}

function toTimestamp(date: string, minutes: number): string {
  const startOfDay = new Date(`${date}T00:00:00+08:00`);
  return new Date(startOfDay.getTime() + minutes * 60_000).toISOString();
}

interface WheelOption {
  value: number;
  label: string;
}

interface WheelPickerProps {
  label: string;
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
}

const WheelPicker = memo(function WheelPicker({
  label,
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: WheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const isUserInteracting = useRef(false);
  const isMouseDragging = useRef(false);
  const lastDragY = useRef(0);
  const wheelResetTimer = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const lastIndexRef = useRef(selectedIndex);
  const valueRef = useRef(value);
  const activeIndex = Math.min(options.length - 1, previewIndex);
  const activeValue = options[activeIndex]?.value ?? value;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    lastIndexRef.current = selectedIndex;
    setPreviewIndex(selectedIndex);

    if (isUserInteracting.current) return;

    const scroller = scrollRef.current;
    if (!scroller) return;

    const targetScrollTop = selectedIndex * WHEEL_ITEM_HEIGHT;
    if (Math.abs(scroller.scrollTop - targetScrollTop) > 1) {
      scroller.scrollTop = targetScrollTop;
    }
  }, [selectedIndex, options.length]);

  useEffect(() => {
    return () => {
      if (scrollEndTimer.current !== null) {
        window.clearTimeout(scrollEndTimer.current);
      }
      if (wheelResetTimer.current !== null) {
        window.clearTimeout(wheelResetTimer.current);
      }
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  function selectOptionAtIndex(index: number, smooth = true) {
    if (options.length === 0) return;

    const nextIndex = Math.min(options.length - 1, Math.max(0, index));
    const nextValue = options[nextIndex]?.value;
    const scroller = scrollRef.current;

    lastIndexRef.current = nextIndex;
    setPreviewIndex(nextIndex);

    if (scroller) {
      scroller.scrollTo({
        top: nextIndex * WHEEL_ITEM_HEIGHT,
        behavior: smooth ? "smooth" : "auto",
      });
    }

    if (nextValue !== undefined && nextValue !== valueRef.current) {
      valueRef.current = nextValue;
      onChange(nextValue);
    }
  }

  function handleScroll() {
    const scroller = scrollRef.current;
    if (!scroller || options.length === 0 || isMouseDragging.current) return;

    isUserInteracting.current = true;

    if (rafId.current !== null) {
      window.cancelAnimationFrame(rafId.current);
    }

    rafId.current = window.requestAnimationFrame(() => {
      if (!scroller || isMouseDragging.current) return;
      const nextIndex = Math.min(
        options.length - 1,
        Math.max(0, Math.round(scroller.scrollTop / WHEEL_ITEM_HEIGHT)),
      );

      if (nextIndex !== lastIndexRef.current) {
        lastIndexRef.current = nextIndex;
        setPreviewIndex(nextIndex);
      }
    });

    if (scrollEndTimer.current !== null) {
      window.clearTimeout(scrollEndTimer.current);
    }

    scrollEndTimer.current = window.setTimeout(() => {
      isUserInteracting.current = false;
      if (!scroller || isMouseDragging.current) return;

      const settledIndex = Math.min(
        options.length - 1,
        Math.max(0, Math.round(scroller.scrollTop / WHEEL_ITEM_HEIGHT)),
      );
      const settledValue = options[settledIndex]?.value;

      if (settledValue !== undefined && settledValue !== valueRef.current) {
        valueRef.current = settledValue;
        onChange(settledValue);
      }
    }, 120);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (options.length === 0) return;

    isUserInteracting.current = true;

    // Detect discrete notched mouse wheel (deltaMode 1=lines or 2=pages, or standard 100/120px notch deltas)
    const isDiscreteNotch =
      event.deltaMode !== 0 ||
      (Math.abs(event.deltaY) >= 80 && event.deltaY % 20 === 0);

    if (isDiscreteNotch) {
      event.preventDefault();
      const step = event.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.min(
        options.length - 1,
        Math.max(0, lastIndexRef.current + step),
      );
      if (nextIndex !== lastIndexRef.current) {
        selectOptionAtIndex(nextIndex, true);
      }

      if (wheelResetTimer.current !== null) {
        window.clearTimeout(wheelResetTimer.current);
      }
      wheelResetTimer.current = window.setTimeout(() => {
        isUserInteracting.current = false;
      }, 180);
      return;
    }

    // For laptop trackpads: do NOT preventDefault.
    // Let the browser handle fluid native momentum scrolling with GPU acceleration.
    if (wheelResetTimer.current !== null) {
      window.clearTimeout(wheelResetTimer.current);
    }
    wheelResetTimer.current = window.setTimeout(() => {
      isUserInteracting.current = false;
    }, 180);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        selectOptionAtIndex(lastIndexRef.current + 1, true);
        break;
      case "ArrowUp":
        event.preventDefault();
        selectOptionAtIndex(lastIndexRef.current - 1, true);
        break;
      case "Home":
        event.preventDefault();
        selectOptionAtIndex(0, true);
        break;
      case "End":
        event.preventDefault();
        selectOptionAtIndex(options.length - 1, true);
        break;
    }
  }

  const hasDraggedDistance = useRef(0);
  const dragStartY = useRef(0);
  const lastDragTime = useRef(0);
  const dragVelocity = useRef(0);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) return;

    const scroller = scrollRef.current;
    if (!scroller) return;

    isUserInteracting.current = true;
    isMouseDragging.current = true;
    setIsDragging(true);
    hasDraggedDistance.current = 0;
    dragStartY.current = event.clientY;
    lastDragY.current = event.clientY;
    lastDragTime.current = performance.now();
    dragVelocity.current = 0;

    scroller.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const scroller = scrollRef.current;
    if (!isMouseDragging.current || !scroller) return;

    const dy = lastDragY.current - event.clientY;
    hasDraggedDistance.current += Math.abs(event.clientY - dragStartY.current);

    const now = performance.now();
    const dt = Math.max(1, now - lastDragTime.current);
    dragVelocity.current = dy / dt;
    lastDragY.current = event.clientY;
    lastDragTime.current = now;

    scroller.scrollTop += dy;

    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(scroller.scrollTop / WHEEL_ITEM_HEIGHT)),
    );
    if (nextIndex !== lastIndexRef.current) {
      lastIndexRef.current = nextIndex;
      setPreviewIndex(nextIndex);
    }
  }

  function finishPointerDrag(event: React.PointerEvent<HTMLDivElement>) {
    const scroller = scrollRef.current;
    if (!isMouseDragging.current || !scroller) return;

    isMouseDragging.current = false;
    setIsDragging(false);
    if (scroller.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }

    if (hasDraggedDistance.current <= 4) {
      isUserInteracting.current = false;
      return;
    }

    const clampedFlick = Math.max(-120, Math.min(120, dragVelocity.current * 40));
    const targetScrollTop = scroller.scrollTop + clampedFlick;
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(targetScrollTop / WHEEL_ITEM_HEIGHT)),
    );
    selectOptionAtIndex(nextIndex, true);

    setTimeout(() => {
      isUserInteracting.current = false;
    }, 180);
  }

  function handleItemClick(optionIndex: number) {
    if (hasDraggedDistance.current > 4) return;
    selectOptionAtIndex(optionIndex, true);
  }

  return (
    <div className={`aq-wheel-column min-w-0 ${className}`}>
      <span className="sr-only">
        {label}
      </span>
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`${ariaLabel}-${activeValue}`}
        tabIndex={0}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        className={`aq-wheel-scroller relative z-10 cursor-grab select-none overflow-y-auto overscroll-contain px-0.5 text-center tabular-nums active:cursor-grabbing ${isDragging ? "aq-wheel-scroller--dragging" : ""}`}
      >
        <div
          aria-hidden="true"
          style={{ height: WHEEL_ITEM_HEIGHT * WHEEL_PADDING_ITEMS }}
        />
        {options.map((option, optionIndex) => {
          const distance = Math.abs(optionIndex - activeIndex);
          const isSelected = optionIndex === activeIndex;

          const distanceClass = isSelected
            ? "aq-wheel-item--active scale-100 text-[22px] font-black text-emerald-400 opacity-100"
            : distance === 1
              ? "aq-wheel-item--near scale-90 text-[13px] text-zinc-400 opacity-60 font-semibold"
              : "aq-wheel-item--far scale-75 text-[11px] text-zinc-500 opacity-25 font-normal";

          return (
            <div
              id={`${ariaLabel}-${option.value}`}
              key={option.value}
              role="option"
              aria-selected={isSelected}
              onClick={() => handleItemClick(optionIndex)}
              className={`aq-wheel-item flex cursor-pointer select-none items-center justify-center transition-all duration-100 ${distanceClass}`}
            >
              {option.label}
            </div>
          );
        })}
        <div
          aria-hidden="true"
          style={{ height: WHEEL_ITEM_HEIGHT * WHEEL_PADDING_ITEMS }}
        />
      </div>
    </div>
  );
});

export default function TimeControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const controlsRef = useRef<HTMLElement>(null);
  const drawerPointerStartY = useRef<number | null>(null);
  const handledDrawerGesture = useRef(false);
  const selectedTimestamp = searchParams.get("timestamp");
  const [selectedDate, setSelectedDate] = useState(
    () => {
      const now = getUlaanbaatarDateTime();
      return clampDateString(
        getUlaanbaatarDateTime(selectedTimestamp).date,
        now.date,
      );
    },
  );
  const [selectedMinutes, setSelectedMinutes] = useState(
    () => {
      const now = getUlaanbaatarDateTime();
      const target = getUlaanbaatarDateTime(selectedTimestamp);
      const date = clampDateString(target.date, now.date);
      return clampSnapshotMinutes(
        date,
        target.minutes,
        now,
      );
    },
  );
  const [hasPendingScrub, setHasPendingScrub] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
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
  const selectedDateParts = getDateParts(selectedDate);
  const selectedHour = Math.floor(selectedMinutes / 60);
  const selectedMinute = selectedMinutes % 60;
  const maxDateParts = getDateParts(nowInUlaanbaatar.date);

  const yearOptions = useMemo<WheelOption[]>(() => {
    const startYear = Math.max(2020, maxDateParts.year - 6);
    return Array.from(
      { length: maxDateParts.year - startYear + 1 },
      (_, index) => {
        const year = startYear + index;
        return { value: year, label: year.toString() };
      },
    );
  }, [maxDateParts.year]);

  const monthOptions = useMemo<WheelOption[]>(() => {
    const maxMonth =
      selectedDateParts.year === maxDateParts.year ? maxDateParts.month : 12;
    return Array.from({ length: maxMonth }, (_, index) => {
      const month = index + 1;
      return { value: month, label: formatWheelNumber(month) };
    });
  }, [maxDateParts.month, maxDateParts.year, selectedDateParts.year]);

  const dayOptions = useMemo<WheelOption[]>(() => {
    const daysInMonth = getDaysInMonth(
      selectedDateParts.year,
      selectedDateParts.month,
    );
    const maxDay =
      selectedDateParts.year === maxDateParts.year &&
      selectedDateParts.month === maxDateParts.month
        ? maxDateParts.day
        : daysInMonth;

    return Array.from({ length: maxDay }, (_, index) => {
      const day = index + 1;
      return { value: day, label: formatWheelNumber(day) };
    });
  }, [
    maxDateParts.day,
    maxDateParts.month,
    maxDateParts.year,
    selectedDateParts.month,
    selectedDateParts.year,
  ]);

  const hourOptions = useMemo<WheelOption[]>(() => {
    const maxHour = Math.floor(sliderMaximum / 60);
    return Array.from({ length: maxHour + 1 }, (_, hour) => ({
      value: hour,
      label: formatWheelNumber(hour),
    }));
  }, [sliderMaximum]);

  const minuteOptions = useMemo<WheelOption[]>(() => {
    const maxMinuteForHour =
      selectedHour === Math.floor(sliderMaximum / 60)
        ? sliderMaximum % 60
        : 45;
    return [0, 15, 30, 45]
      .filter((minute) => minute <= maxMinuteForHour)
      .map((minute) => ({
        value: minute,
        label: formatWheelNumber(minute),
      }));
  }, [selectedHour, sliderMaximum]);

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
    const now = getUlaanbaatarDateTime();
    const target = getUlaanbaatarDateTime(selectedTimestamp);
    const date = clampDateString(target.date, now.date);
    setSelectedDate(date);
    setSelectedMinutes(
      clampSnapshotMinutes(
        date,
        target.minutes,
        now,
      ),
    );
    setHasPendingScrub(false);
    lastCommittedTimestamp.current = selectedTimestamp;
  }, [selectedTimestamp]);

  const routerDebounceTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (routerDebounceTimer.current !== null) {
        window.clearTimeout(routerDebounceTimer.current);
      }
    };
  }, []);

  function setHistoricalTime(
    date: string,
    minutes: number,
    immediate = false,
  ) {
    if (!date) return;
    const timestamp = toTimestamp(date, minutes);

    if (timestamp === lastCommittedTimestamp.current) {
      setHasPendingScrub(false);
      return;
    }

    if (routerDebounceTimer.current !== null) {
      window.clearTimeout(routerDebounceTimer.current);
    }

    const commit = () => {
      lastCommittedTimestamp.current = timestamp;
      setHasPendingScrub(false);
      const params = new URLSearchParams(searchParams.toString());
      params.set("timestamp", timestamp);
      router.replace(`/?${params.toString()}`, { scroll: false });
    };

    if (immediate) {
      commit();
    } else {
      setHasPendingScrub(true);
      routerDebounceTimer.current = window.setTimeout(commit, 350);
    }
  }

  function handleDateChange(date: string) {
    if (!date) return;
    const nextMinutes = clampSnapshotMinutes(
      date,
      selectedMinutes,
      getUlaanbaatarDateTime(),
    );
    setSelectedDate(date);
    setSelectedMinutes(nextMinutes);
    setHistoricalTime(date, nextMinutes, false);
  }

  function handleDateWheelChange(
    part: "year" | "month" | "day",
    value: number,
  ) {
    const parts = getDateParts(selectedDate);
    const nextDate = clampDateParts(
      part === "year" ? value : parts.year,
      part === "month" ? value : parts.month,
      part === "day" ? value : parts.day,
      nowInUlaanbaatar.date,
    );
    handleDateChange(nextDate);
  }

  function handleTimeWheelChange(part: "hour" | "minute", value: number) {
    const nextHour = part === "hour" ? value : selectedHour;
    const nextMinute = part === "minute" ? value : selectedMinute;
    const nextMinutes = clampSnapshotMinutes(
      selectedDate,
      nextHour * 60 + nextMinute,
      nowInUlaanbaatar,
    );
    setSelectedMinutes(nextMinutes);
    setHasPendingScrub(true);
    setHistoricalTime(selectedDate, nextMinutes, false);
  }

  function returnToLiveMode() {
    if (routerDebounceTimer.current !== null) {
      window.clearTimeout(routerDebounceTimer.current);
    }
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
      className={`aq-time-controls relative mx-auto w-full max-w-[44rem] rounded-xl border border-zinc-800/70 bg-zinc-950/75 text-white shadow-xl shadow-black/25 backdrop-blur-md ${isCollapsed ? "p-2 sm:p-3" : "p-2.5 sm:p-3"}`}
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
        className={`${isCollapsed ? "hidden sm:flex" : "flex"} w-full flex-col gap-2`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black tabular-nums text-zinc-100">
              {selectedDate} <span className="text-zinc-500">·</span>{" "}
              {formatMinutes(selectedMinutes)}
            </p>
          </div>
          <button
            type="button"
            onClick={returnToLiveMode}
            className="aq-live-button inline-flex h-6.5 items-center justify-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 text-[11px] font-bold text-emerald-100 shadow-sm shadow-emerald-950/20 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            {isViewingSnapshot ? (
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Radio aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Live
          </button>
        </div>

        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.74fr)]">
          <div className="min-w-0">
            <div className="mb-0.5 grid grid-cols-[1.32fr_0.84fr_0.84fr] px-2 text-center text-[8.5px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <span>Year</span>
              <span>Month</span>
              <span>Day</span>
            </div>
            <div className="aq-wheel-chassis relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 px-1.5 py-1.5 shadow-lg shadow-black/25 sm:px-2.5">
              <div aria-hidden="true" className="aq-wheel-track absolute inset-x-0 top-1/2 h-[34px] -translate-y-1/2 border-y border-white/10 bg-emerald-400/10" />
              <div className="aq-wheel-grid relative z-10 grid grid-cols-[1.32fr_0.84fr_0.84fr] items-center gap-0.5 sm:gap-1.5">
                <WheelPicker
                  label="Year"
                  options={yearOptions}
                  value={selectedDateParts.year}
                  onChange={(value) => handleDateWheelChange("year", value)}
                  ariaLabel="snapshot-year"
                  className="min-w-[3.4rem]"
                />
                <WheelPicker
                  label="Month"
                  options={monthOptions}
                  value={selectedDateParts.month}
                  onChange={(value) => handleDateWheelChange("month", value)}
                  ariaLabel="snapshot-month"
                />
                <WheelPicker
                  label="Day"
                  options={dayOptions}
                  value={selectedDateParts.day}
                  onChange={(value) => handleDateWheelChange("day", value)}
                  ariaLabel="snapshot-day"
                />
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-0.5 grid grid-cols-[1fr_auto_1fr] px-2 text-center text-[8.5px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <span>Hour</span>
              <span className="w-4" />
              <span>Min</span>
            </div>
            <div className="aq-wheel-chassis relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 px-1.5 py-1.5 shadow-lg shadow-black/25 sm:px-2.5">
              <div aria-hidden="true" className="aq-wheel-track absolute inset-x-0 top-1/2 h-[34px] -translate-y-1/2 border-y border-white/10 bg-emerald-400/10" />
              <div className="aq-wheel-grid relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-0.5 sm:gap-1.5">
                <WheelPicker
                  label="Hour"
                  options={hourOptions}
                  value={selectedHour}
                  onChange={(value) => handleTimeWheelChange("hour", value)}
                  ariaLabel="snapshot-hour"
                />
                <span aria-hidden="true" className="aq-wheel-divider w-3.5 self-center text-center text-lg font-black text-zinc-500">
                  :
                </span>
                <WheelPicker
                  label="Minute"
                  options={minuteOptions}
                  value={selectedMinute}
                  onChange={(value) => handleTimeWheelChange("minute", value)}
                  ariaLabel="snapshot-minute"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sr-only" role="status">
          {isViewingSnapshot ? "Historical snapshot selected" : "Live conditions selected"}
        </div>
      </div>
    </section>
  );
}
