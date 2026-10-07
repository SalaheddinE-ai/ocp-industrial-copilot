import * as React from "react";
import { X, Plus, Trash2, Upload, Link2, FileText, AlertCircle } from "lucide-react";
import {
  equipmentSchema, toFormValues, fromFormValues, formatBytes, MAX_ATTACHMENT_BYTES,
  type Equipment, type EquipmentFormValues,
} from "@/lib/equipment-store";

type Props = {
  open: boolean;
  initial?: Equipment | null;
  idTaken: (id: string) => boolean;
  onClose: () => void;
  onSubmit: (item: Equipment) => void;
};

const ATTACH_TYPES = ["Manual", "Procedure", "Datasheet", "Drawing", "Certificate", "Other"];

export function EquipmentForm({ open, initial, idTaken, onClose, onSubmit }: Props) {
  const editing = Boolean(initial);
  const [v, setV] = React.useState<EquipmentFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [fileError, setFileError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setV(toFormValues(initial));
      setErrors({});
      setFileError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof EquipmentFormValues>(k: K, val: EquipmentFormValues[K]) =>
    setV(p => ({ ...p, [k]: val }));

  const submit = () => {
    const parsed = equipmentSchema.safeParse(v);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) e[issue.path.join(".")] = issue.message;
      setErrors(e);
      return;
    }
    if (!editing && idTaken(parsed.data.id)) {
      setErrors({ id: "This component ID already exists" });
      return;
    }
    onSubmit(fromFormValues(parsed.data, initial ?? null));
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setFileError(null);
    const next = [...v.attachments];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setFileError(`"${f.name}" is ${formatBytes(f.size)} — max ${formatBytes(MAX_ATTACHMENT_BYTES)} per file. Attach it as a link instead.`);
        continue;
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      next.push({
        name: f.name,
        type: guessType(f.name),
        size: formatBytes(f.size),
        mime: f.type,
        dataUrl,
      });
    }
    setV(p => ({ ...p, attachments: next }));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-xl border border-border bg-surface-1 flex flex-col overflow-hidden">
        <header className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-border">
          <h2 className="text-[13px] font-semibold">
            {editing ? `Edit · ${initial!.name}` : "New equipment component"}
          </h2>
          <button onClick={onClose} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <Section title="Identification">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Component ID" error={errors["id"]}>
                <input
                  value={v.id}
                  disabled={editing}
                  onChange={e => set("id", e.target.value)}
                  placeholder="mechanicalSeal"
                  className={inputCls(errors["id"]) + (editing ? " opacity-60" : "")}
                />
              </Field>
              <Field label="Name" error={errors["name"]}>
                <input value={v.name} onChange={e => set("name", e.target.value)} placeholder="Mechanical Seal" className={inputCls(errors["name"])} />
              </Field>
              <Field label="Status" error={errors["status"]}>
                <select value={v.status} onChange={e => set("status", e.target.value as EquipmentFormValues["status"])} className={inputCls()}>
                  <option value="healthy">Healthy</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              <Field label="Manufacturer" error={errors["manufacturer"]}>
                <input value={v.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="KSB / Sulzer" className={inputCls(errors["manufacturer"])} />
              </Field>
            </div>
            <Field label="Function" error={errors["function"]}>
              <input value={v.function} onChange={e => set("function", e.target.value)} placeholder="Seals the shaft against process fluid leakage." className={inputCls(errors["function"])} />
            </Field>
            <Field label="Description" error={errors["description"]}>
              <textarea value={v.description ?? ""} onChange={e => set("description", e.target.value)} rows={2} className={inputCls(errors["description"]) + " resize-none py-2"} />
            </Field>
          </Section>

          <Section title="Specifications">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Material" error={errors["material"]}>
                <input value={v.material} onChange={e => set("material", e.target.value)} className={inputCls(errors["material"])} />
              </Field>
              <Field label="Dimensions" error={errors["dimensions"]}>
                <input value={v.dimensions} onChange={e => set("dimensions", e.target.value)} placeholder="Ø 420mm × 380mm" className={inputCls(errors["dimensions"])} />
              </Field>
              <Field label="Life expectancy" error={errors["lifeExpectancy"]}>
                <input value={v.lifeExpectancy} onChange={e => set("lifeExpectancy", e.target.value)} placeholder="25 years" className={inputCls(errors["lifeExpectancy"])} />
              </Field>
            </div>
          </Section>

          <Section title="Failure modes">
            <StringList
              values={v.failureModes}
              placeholder="Erosion, corrosion pitting…"
              onChange={arr => set("failureModes", arr)}
            />
          </Section>

          <Section title="Maintenance procedure">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Estimated time" error={errors["maintenanceTime"]}>
                <input value={v.maintenanceTime ?? ""} onChange={e => set("maintenanceTime", e.target.value)} placeholder="4h" className={inputCls(errors["maintenanceTime"])} />
              </Field>
              <Field label="Difficulty">
                <select value={v.difficulty} onChange={e => set("difficulty", e.target.value as EquipmentFormValues["difficulty"])} className={inputCls()}>
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </Field>
              <Field label="Torque spec" error={errors["torque"]}>
                <input value={v.torque ?? ""} onChange={e => set("torque", e.target.value)} placeholder="M20 → 380 Nm" className={inputCls(errors["torque"])} />
              </Field>
            </div>
            <StringList values={v.maintenanceSteps} placeholder="Isolate & drain…" ordered onChange={arr => set("maintenanceSteps", arr)} />
          </Section>

          <Section title="Spare parts">
            <div className="space-y-2">
              {v.parts.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_90px_32px] gap-2 items-start">
                  <div>
                    <input value={p.name} onChange={e => updateAt(setV, "parts", i, { ...p, name: e.target.value })} placeholder="Part name" className={inputCls(errors[`parts.${i}.name`])} />
                    <Err msg={errors[`parts.${i}.name`]} />
                  </div>
                  <div>
                    <input value={p.ref} onChange={e => updateAt(setV, "parts", i, { ...p, ref: e.target.value })} placeholder="REF-001" className={inputCls(errors[`parts.${i}.ref`]) + " font-mono"} />
                    <Err msg={errors[`parts.${i}.ref`]} />
                  </div>
                  <div>
                    <input type="number" min={0} value={p.stock} onChange={e => updateAt(setV, "parts", i, { ...p, stock: Number(e.target.value) })} className={inputCls(errors[`parts.${i}.stock`]) + " font-mono"} />
                    <Err msg={errors[`parts.${i}.stock`]} />
                  </div>
                  <IconBtn onClick={() => setV(s => ({ ...s, parts: s.parts.filter((_, j) => j !== i) }))} />
                </div>
              ))}
              <AddBtn label="Add spare part" onClick={() => setV(s => ({ ...s, parts: [...s.parts, { name: "", ref: "", stock: 0 }] }))} />
            </div>
          </Section>

          <Section title="Manuals, procedures & documents">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-surface-2 hover:border-border-strong text-[12px] transition-colors"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={1.5} /> Upload files
              </button>
              <button
                onClick={() => setV(s => ({ ...s, attachments: [...s.attachments, { name: "", type: "Manual", size: "link", url: "" }] }))}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-surface-2 hover:border-border-strong text-[12px] transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Attach link
              </button>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                max {formatBytes(MAX_ATTACHMENT_BYTES)} / file
              </span>
              <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv" className="hidden" onChange={e => void addFiles(e.target.files)} />
            </div>
            {fileError && (
              <p className="flex items-start gap-1.5 text-[11px] text-[color:var(--critical,#ef4444)]">
                <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" strokeWidth={1.5} />{fileError}
              </p>
            )}
            <div className="space-y-2">
              {v.attachments.map((a, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface-2 p-2.5 space-y-2">
                  <div className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <input value={a.name} onChange={e => updateAt(setV, "attachments", i, { ...a, name: e.target.value })} placeholder="Document name" className={inputCls(errors[`attachments.${i}.name`])} />
                    </div>
                    <select value={a.type} onChange={e => updateAt(setV, "attachments", i, { ...a, type: e.target.value })} className={inputCls()}>
                      {ATTACH_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <IconBtn onClick={() => setV(s => ({ ...s, attachments: s.attachments.filter((_, j) => j !== i) }))} />
                  </div>
                  <Err msg={errors[`attachments.${i}.name`]} />
                  {!a.dataUrl && (
                    <>
                      <input value={a.url ?? ""} onChange={e => updateAt(setV, "attachments", i, { ...a, url: e.target.value })} placeholder="https://docs.example.com/manual.pdf" className={inputCls(errors[`attachments.${i}.url`]) + " font-mono text-[11px]"} />
                      <Err msg={errors[`attachments.${i}.url`]} />
                    </>
                  )}
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {a.dataUrl ? `uploaded · ${a.size}` : "external link"}
                  </div>
                </div>
              ))}
              {v.attachments.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No manuals or procedures attached yet.</p>
              )}
            </div>
          </Section>
        </div>

        <footer className="shrink-0 h-13 px-4 py-2.5 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-border bg-surface-2 hover:border-border-strong text-[12px] transition-colors">
            Cancel
          </button>
          <button onClick={submit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[12px] font-medium transition-colors">
            {editing ? "Save changes" : "Create component"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function guessType(name: string) {
  const n = name.toLowerCase();
  if (n.includes("manual")) return "Manual";
  if (n.includes("proc") || n.includes("sop")) return "Procedure";
  if (n.includes("spec") || n.includes("data")) return "Datasheet";
  if (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg")) return "Drawing";
  return "Other";
}

function updateAt<K extends "parts" | "attachments">(
  setV: React.Dispatch<React.SetStateAction<EquipmentFormValues>>,
  key: K,
  index: number,
  value: EquipmentFormValues[K][number],
) {
  setV(s => ({ ...s, [key]: s[key].map((x, i) => (i === index ? value : x)) }) as EquipmentFormValues);
}

function inputCls(error?: string) {
  return `w-full h-8 px-2.5 rounded-md bg-surface-2 border text-[12px] placeholder:text-muted-foreground focus:outline-none transition-colors ${
    error ? "border-[color:var(--critical,#ef4444)]" : "border-border focus:border-border-strong"
  }`;
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-[10px] text-[color:var(--critical,#ef4444)]">{msg}</p>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1">{label}</label>
      {children}
      <Err msg={error} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function IconBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Remove" className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-[color:var(--critical,#ef4444)] hover:bg-accent transition-colors">
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
    </button>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-border hover:border-border-strong text-[11px] text-muted-foreground hover:text-foreground transition-colors">
      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
    </button>
  );
}

function StringList({
  values, onChange, placeholder, ordered,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string; ordered?: boolean }) {
  return (
    <div className="space-y-2">
      {values.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          {ordered && <span className="text-[10px] font-mono text-muted-foreground w-5">{String(i + 1).padStart(2, "0")}</span>}
          <input value={s} onChange={e => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className={inputCls()} />
          <IconBtn onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddBtn label="Add entry" onClick={() => onChange([...values, ""])} />
    </div>
  );
}
