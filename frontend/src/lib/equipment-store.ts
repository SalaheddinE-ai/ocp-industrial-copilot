import * as React from "react";
import { z } from "zod";
import { componentList, type Component, type Status } from "./pump-data";

const STORAGE_KEY = "ocp.equipment.overrides.v1";
export const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024; // 1.5 MB per file (browser storage)

export interface Attachment {
  name: string;
  type: string; // Manual | Procedure | Datasheet | Other
  size: string;
  mime?: string;
  dataUrl?: string; // present when the file was uploaded, absent when only linked
  url?: string; // external link
}

/** Equipment record = a pump component enriched with editable attachments. */
export type Equipment = Component & { attachments?: Attachment[]; custom?: boolean };

const partSchema = z.object({
  name: z.string().trim().min(1, "Part name is required").max(80),
  ref: z.string().trim().min(1, "Reference is required").max(40),
  stock: z.coerce.number().int("Whole numbers only").min(0, "Cannot be negative").max(99999),
});

export const equipmentSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, "ID must be at least 2 characters")
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, - or _ only"),
  name: z.string().trim().min(2, "Name is required").max(80, "Max 80 characters"),
  status: z.enum(["healthy", "warning", "critical"]),
  function: z.string().trim().min(5, "Describe the function (min 5 chars)").max(200),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  material: z.string().trim().min(2, "Material is required").max(120),
  dimensions: z.string().trim().min(1, "Dimensions are required").max(80),
  manufacturer: z.string().trim().min(1, "Manufacturer is required").max(80),
  lifeExpectancy: z.string().trim().min(1, "Life expectancy is required").max(40),
  failureModes: z.array(z.string().trim().min(1)).max(20),
  maintenanceSteps: z.array(z.string().trim().min(1)).max(30),
  maintenanceTime: z.string().trim().max(20).optional().or(z.literal("")),
  difficulty: z.enum(["Low", "Medium", "High"]),
  torque: z.string().trim().max(60).optional().or(z.literal("")),
  parts: z.array(partSchema).max(30),
  attachments: z
    .array(
      z.object({
        name: z.string().trim().min(1, "File name is required").max(120),
        type: z.string().trim().min(1).max(40),
        size: z.string(),
        mime: z.string().optional(),
        dataUrl: z.string().optional(),
        url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
      }),
    )
    .max(30),
});

export type EquipmentFormValues = z.infer<typeof equipmentSchema>;

export function toFormValues(c?: Equipment | null): EquipmentFormValues {
  return {
    id: c?.id ?? "",
    name: c?.name ?? "",
    status: (c?.status ?? "healthy") as Status,
    function: c?.function ?? "",
    description: c?.description ?? "",
    material: c?.material ?? "",
    dimensions: c?.dimensions ?? "",
    manufacturer: c?.manufacturer ?? "",
    lifeExpectancy: c?.lifeExpectancy ?? "",
    failureModes: c?.failureModes ?? [],
    maintenanceSteps: c?.maintenance?.steps ?? [],
    maintenanceTime: c?.maintenance?.time ?? "",
    difficulty: c?.maintenance?.difficulty ?? "Medium",
    torque: c?.maintenance?.torque ?? "",
    parts: c?.parts ?? [],
    attachments:
      c?.attachments ??
      (c?.documents ?? []).map(d => ({ name: d.name, type: d.type, size: d.size })),
  };
}

export function fromFormValues(v: EquipmentFormValues, base?: Equipment | null): Equipment {
  const fallback = base ?? componentList[0]!;
  return {
    ...fallback,
    id: v.id,
    name: v.name,
    status: v.status,
    function: v.function,
    description: v.description || v.function,
    principle: base?.principle ?? v.function,
    material: v.material,
    dimensions: v.dimensions,
    manufacturer: v.manufacturer,
    lifeExpectancy: v.lifeExpectancy,
    failureModes: v.failureModes,
    symptoms: base?.symptoms ?? [],
    causes: base?.causes ?? [],
    inspection: base?.inspection ?? { checklist: [], tools: [], tolerances: "—" },
    maintenance: {
      steps: v.maintenanceSteps,
      time: v.maintenanceTime || "—",
      difficulty: v.difficulty,
      ppe: base?.maintenance?.ppe ?? [],
      torque: v.torque || "—",
    },
    safety: base?.safety ?? { loto: [], hazards: [], equipment: [] },
    parts: v.parts,
    documents: v.attachments.map(a => ({ name: a.name, type: a.type, size: a.size })),
    attachments: v.attachments.map(a => ({ ...a, url: a.url || undefined })),
    history: base?.history ?? [],
    custom: base?.custom ?? !componentList.some(c => c.id === v.id),
  };
}

type Overrides = { edited: Record<string, Equipment>; deleted: string[] };

function read(): Overrides {
  if (typeof window === "undefined") return { edited: {}, deleted: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { edited: {}, deleted: [] };
    const parsed = JSON.parse(raw) as Overrides;
    return { edited: parsed.edited ?? {}, deleted: parsed.deleted ?? [] };
  } catch {
    return { edited: {}, deleted: [] };
  }
}

function merge(o: Overrides): Equipment[] {
  const base: Equipment[] = componentList.map(c => ({ ...c }));
  const list = base
    .filter(c => !o.deleted.includes(c.id))
    .map(c => (o.edited[c.id] ? o.edited[c.id]! : c));
  const extras = Object.values(o.edited).filter(e => !componentList.some(c => c.id === e.id));
  return [...list, ...extras];
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useEquipment() {
  const [overrides, setOverrides] = React.useState<Overrides>({ edited: {}, deleted: [] });

  React.useEffect(() => {
    setOverrides(read());
  }, []);

  const persist = React.useCallback((next: Overrides) => {
    setOverrides(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }, []);

  const list = React.useMemo(() => merge(overrides), [overrides]);

  const save = React.useCallback(
    (item: Equipment) =>
      persist({
        edited: { ...overrides.edited, [item.id]: item },
        deleted: overrides.deleted.filter(id => id !== item.id),
      }),
    [overrides, persist],
  );

  const remove = React.useCallback(
    (id: string) => {
      const edited = { ...overrides.edited };
      delete edited[id];
      return persist({ edited, deleted: [...new Set([...overrides.deleted, id])] });
    },
    [overrides, persist],
  );

  const exists = React.useCallback((id: string) => list.some(c => c.id === id), [list]);

  return { list, save, remove, exists };
}
