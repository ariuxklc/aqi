"use client";

import {
  FileBarChart2,
  Map,
  Menu,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";

interface NavigationItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const NAVIGATION: readonly NavigationItem[] = [
  {
    href: "/",
    label: "Air quality map",
    description: "Explore the network",
    icon: Map,
  },
  {
    href: "/reports",
    label: "Data reports",
    description: "Filter and export records",
    icon: FileBarChart2,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isLightTheme = theme === "light";

  useEffect(() => {
    if (window.innerWidth >= 640) {
      setIsOpen(true);
    }
  }, []);

  return (
    <aside className="pointer-events-none absolute left-3 top-3 z-[1000]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Collapse workspace menu" : "Expand workspace menu"}
        aria-expanded={isOpen}
        aria-controls="workspace-menu"
        title={isOpen ? "Collapse workspace menu" : "Expand workspace menu"}
        className="aq-sidebar-toggle pointer-events-auto grid h-10 w-10 place-items-center rounded-lg border border-zinc-700/80 bg-zinc-950/95 text-zinc-100 shadow-xl shadow-black/30 backdrop-blur-xl transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <div
        id="workspace-menu"
        aria-hidden={!isOpen}
        className={`aq-sidebar-panel mt-2 flex max-h-[calc(100vh-4.5rem)] w-56 origin-top-left flex-col rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-3 text-zinc-100 shadow-2xl shadow-black/30 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out ${
          isOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-4 opacity-0"
        }`}
      >
          <p className="aq-sidebar-label px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Primary navigation">
            {NAVIGATION.map(({ href, label, description, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => {
                    if (window.innerWidth < 640) {
                      setIsOpen(false);
                    }
                  }}
                  className={`group flex items-center gap-3 rounded-md px-2.5 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                    isActive
                      ? "aq-sidebar-link--active bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-950/20"
                      : "aq-sidebar-link text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" strokeWidth={2.4} />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold">{label}</span>
                    <span className={`aq-sidebar-description mt-0.5 block text-[10px] ${isActive ? "text-zinc-700" : "text-zinc-500"}`}>
                      {description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="aq-sidebar-footer mt-auto border-t border-zinc-800 px-2 pt-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="aq-sidebar-theme-control flex h-9 w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-bold text-zinc-100 transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <span className="inline-flex items-center gap-2">
                {isLightTheme ? (
                  <Sun aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <Moon aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
                )}
                {isLightTheme ? "Light mode" : "Dark mode"}
              </span>
              <span className="text-[10px] font-medium text-zinc-500">Switch</span>
            </button>
          </div>
      </div>
    </aside>
  );
}
