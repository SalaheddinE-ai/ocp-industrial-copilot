import * as React from "react";

const KEY = "ocp.theme";
export type Theme = "dark" | "light";

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  for (const el of [document.documentElement, document.body]) {
    el.classList.toggle("dark", theme === "dark");
    el.classList.toggle("light", theme === "light");
  }
}

export function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

/** Theme state persisted in localStorage; synced across components via a storage-like event. */
export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>("dark");

  React.useEffect(() => {
    const t = readTheme();
    setThemeState(t);
    applyTheme(t);
    const onChange = () => setThemeState(readTheme());
    window.addEventListener("ocp-theme", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("ocp-theme", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    window.localStorage.setItem(KEY, t);
    applyTheme(t);
    setThemeState(t);
    window.dispatchEvent(new Event("ocp-theme"));
  }, []);

  const toggle = React.useCallback(
    () => setTheme(readTheme() === "dark" ? "light" : "dark"),
    [setTheme],
  );

  return { theme, setTheme, toggle };
}
