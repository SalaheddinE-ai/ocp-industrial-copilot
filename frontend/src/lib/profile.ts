import * as React from "react";

export type Profile = {
  name: string;
  role: string;
  email: string;
  site: string;
};

const KEY = "ocp.profile.v1";

export const DEFAULT_PROFILE: Profile = {
  name: "A. El Fassi",
  role: "Maintenance Eng.",
  email: "a.elfassi@ocpgroup.ma",
  site: "Jorf Lasfar",
};

export function initials(name: string) {
  const parts = name.trim().split(/[\s.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const listeners = new Set<(p: Profile) => void>();
let current: Profile = DEFAULT_PROFILE;
let loaded = false;

function load(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_PROFILE;
}

export function useProfile() {
  const [profile, setProfile] = React.useState<Profile>(current);

  React.useEffect(() => {
    if (!loaded) {
      loaded = true;
      current = load();
    }
    setProfile(current);
    listeners.add(setProfile);
    return () => { listeners.delete(setProfile); };
  }, []);

  const save = React.useCallback((patch: Partial<Profile>) => {
    current = { ...current, ...patch };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch { /* ignore */ }
    listeners.forEach((l) => l(current));
  }, []);

  const reset = React.useCallback(() => {
    current = DEFAULT_PROFILE;
    try {
      window.localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    listeners.forEach((l) => l(current));
  }, []);

  return { profile, save, reset };
}
