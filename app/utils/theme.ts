export type Theme = "light" | "dark" | "system";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"; // SSR fallback
  return (localStorage.getItem("theme") as Theme) || "system";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");

  let resolvedTheme: "light" | "dark";
  if (theme === "system") {
    resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else {
    resolvedTheme = theme;
  }

  root.classList.add(resolvedTheme);
  root.setAttribute("data-theme", resolvedTheme);
  localStorage.setItem("theme", theme);
}

export function watchSystemTheme(callback: (theme: "light" | "dark") => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handler = () => {
    callback(mediaQuery.matches ? "dark" : "light");
  };

  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}
