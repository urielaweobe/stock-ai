import { useState } from "react";
import { NavLink } from "react-router";
import { cn } from "~/lib/utils";
import { getStoredTheme, type Theme } from "~/utils/theme";
import { ThemeSwitcher } from "./theme-toggle";

const navigationItems = [
  {
    to: "/",
    label: "Home",
    end: true,
  },
  {
    to: "/compare-stocks",
    label: "Compare Stocks",
  },
];

export function AppHeader() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur dark:bg-gray-900/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-gray-950">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              prefetch="render"
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                  isActive &&
                    "bg-slate-900 text-white hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:text-slate-900"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <ThemeSwitcher theme={theme} setTheme={setTheme} />
      </div>
    </header>
  );
}
