import { useState } from "react";
import { Link, NavLink } from "react-router";
import { ChartNoAxesCombined } from "lucide-react";
import { cn } from "~/lib/utils";
import { getStoredTheme, type Theme } from "~/utils/theme";
import { ThemeSwitcher } from "./theme-toggle";

const navigationItems = [
  {
    to: "/",
    label: "Research",
    end: true,
  },
  {
    to: "/compare-stocks",
    label: "Compare",
  },
];

export function AppHeader() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3 sm:gap-6 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-700 text-white dark:bg-indigo-400 dark:text-slate-950">
            <ChartNoAxesCombined className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden min-[375px]:inline">Stock AI</span>
          <span className="sr-only min-[375px]:hidden">Stock AI home</span>
        </Link>

        <nav aria-label="Stock research" className="mx-auto flex items-center gap-0.5 rounded-xl bg-muted p-1 sm:mx-0 sm:w-fit">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              prefetch="intent"
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-4",
                  isActive &&
                    "bg-background text-foreground shadow-sm"
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
