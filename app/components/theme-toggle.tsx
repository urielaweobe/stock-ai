import { useEffect } from "react";
import { applyTheme, watchSystemTheme, type Theme } from "~/utils/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "./ui/select";
import { Laptop, Moon, Sun } from "lucide-react";

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export function ThemeSwitcher({ theme, setTheme }: ThemeSwitcherProps) {
  useEffect(() => {
    applyTheme(theme);

    if (theme === "system") {
      return watchSystemTheme((systemTheme) => {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(systemTheme);
      });
    }
  }, [theme]);

  const renderIcon = (theme: string | undefined) => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4 text-blue-400" />;
      case "system":
        return <Laptop className="h-4 w-4" />;
      default:
        return <Laptop className="h-4 w-4" />;
    }
  };

  return (
    <Select
      defaultValue={theme}
      onValueChange={(value) => setTheme(value as Theme)}
    >
      <SelectTrigger aria-label={`Theme: ${theme}`} className="h-9 cursor-pointer gap-1 rounded-xl px-2 shadow-none sm:gap-2 sm:px-3">
        {renderIcon(theme)}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light" className="flex items-center gap-2">
          Light
        </SelectItem>
        <SelectItem value="dark" className="flex items-center gap-2">
          Dark
        </SelectItem>
        <SelectItem value="system" className="flex items-center gap-2">
          System
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
