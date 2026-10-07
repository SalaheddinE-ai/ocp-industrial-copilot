import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon, Sun, Moon, Trash2, RotateCcw, Monitor } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings · OCP Maroc Industrial Copilot" },
      { name: "description", content: "Configure appearance, units, viewer defaults and local data for the OCP Maroc industrial copilot workspace." },
      { property: "og:title", content: "Settings · OCP Maroc Industrial Copilot" },
      { property: "og:description", content: "Configure appearance, units, viewer defaults and local data for the OCP Maroc industrial copilot workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const PREFS_KEY = "ocp.prefs.v1";
type Prefs = { units: "metric" | "imperial"; grid: boolean; labels: boolean; trace: boolean };
const DEFAULTS: Prefs = { units: "metric", grid: true, labels: true, trace: true };

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = React.useState<Prefs>(DEFAULTS);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    toast.success("Preferences saved");
  };

  const clear = (key: string, label: string) => {
    if (!window.confirm(`Clear ${label}? This cannot be undone.`)) return;
    window.localStorage.removeItem(key);
    toast.success(`${label} cleared`);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-5 space-y-4 max-w-[900px]">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-cyan" strokeWidth={1.5} /> Settings
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Workspace preferences, stored on this device.
              </p>
            </div>

            <Section title="Appearance" desc="Theme applied across the whole workspace.">
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <ThemeCard active={theme === "dark"} onClick={() => setTheme("dark")} icon={Moon} label="Dark" hint="Control-room default" />
                <ThemeCard active={theme === "light"} onClick={() => setTheme("light")} icon={Sun} label="Light" hint="Bright workshop" />
              </div>
            </Section>

            <Section title="Units & viewer" desc="Defaults for the digital twin and measurements.">
              <Row label="Measurement units">
                <div className="flex gap-1">
                  {(["metric", "imperial"] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => update({ units: u })}
                      className={`h-8 px-3 rounded-md text-xs border transition-colors ${
                        prefs.units === u
                          ? "border-border-strong bg-surface-3"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {u === "metric" ? "Metric (mm)" : "Imperial (in)"}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Show ground grid"><Toggle on={prefs.grid} onChange={v => update({ grid: v })} /></Row>
              <Row label="Show annotation labels"><Toggle on={prefs.labels} onChange={v => update({ labels: v })} /></Row>
              <Row label="Copilot trace terminal"><Toggle on={prefs.trace} onChange={v => update({ trace: v })} /></Row>
            </Section>

            <Section title="Local data" desc="Everything is stored in this browser.">
              <DataRow label="Equipment overrides" onClear={() => clear("ocp.equipment.overrides.v1", "Equipment overrides")} />
              <DataRow label="3D annotations" onClear={() => clear("ocp.annotations.v1", "3D annotations")} />
              <DataRow label="Component colors" onClear={() => clear("ocp.colors.v1", "Component colors")} />
              <button
                onClick={() => {
                  if (!window.confirm("Reset all preferences to defaults?")) return;
                  setPrefs(DEFAULTS);
                  window.localStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULTS));
                  setTheme("dark");
                  toast.success("Preferences reset");
                }}
                className="mt-1 inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} /> Reset preferences
              </button>
            </Section>

            <Section title="Workspace" desc="Read-only deployment information.">
              <Row label="Site"><span className="text-sm text-muted-foreground">OCP Maroc · Jorf Lasfar</span></Row>
              <Row label="Asset"><span className="text-sm text-muted-foreground font-mono">P-104 · Centrifugal pump</span></Row>
              <Row label="Build">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground font-mono">
                  <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} /> v2.4 · Beta
                </span>
              </Row>
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-t border-border first:border-t-0 pt-3 first:pt-0">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function DataRow({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Row label={label}>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:text-critical hover:border-critical/60 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Clear
      </button>
    </Row>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`h-5 w-9 rounded-full transition-colors relative ${on ? "bg-cyan" : "bg-surface-3"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ThemeCard({
  active, onClick, icon: Icon, label, hint,
}: { active: boolean; onClick: () => void; icon: typeof Sun; label: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${
        active ? "border-cyan bg-surface-2" : "border-border hover:bg-accent/50"
      }`}
    >
      <Icon className="h-4 w-4 mb-2" strokeWidth={1.5} />
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}
