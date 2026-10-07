import * as React from "react";
import * as THREE from "three";
import {
  RotateCw,
  Move,
  ZoomIn,
  RefreshCcw,
  Layers,
  Scissors,
  Eye,
  Grid3x3,
  Ruler,
  Compass,
  Maximize2,
  MapPin,
  Trash2,
  Play,
  X,
  Palette,
  Info,
} from "lucide-react";
import { components as pumpComponents } from "@/lib/pump-data";
import type { SceneOp } from "@/lib/scene-ops";

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A batch of agent-planned scene ops to apply, tagged with a nonce so
   * the effect below fires exactly once per batch even if the same ops
   * are sent twice in a row (e.g. the user repeats a question). See
   * src/lib/scene-ops.ts and twin.tsx for where this comes from. */
  sceneCommand?: { nonce: number; ops: SceneOp[] } | null;
}

interface PartMesh {
  id: string;
  mesh: THREE.Object3D;
  home: THREE.Vector3;
  explodeDir: THREE.Vector3;
  originalMaterials: THREE.Material | THREE.Material[];
}

interface Annotation {
  id: string;
  partId: string;
  pos: [number, number, number];
  color: string;
  note: string;
  createdAt: number;
}

// Component engineering metadata is optional and comes from pump-data.ts.
// Any component missing these fields still renders fine -- the spec panel
// just shows fewer rows. Fill these in pump-data.ts as real datasheet
// values become available (bearing designation, seal type, torque specs...).
interface ComponentSpec {
  name?: string;
  designation?: string;
  material?: string;
  manufacturer?: string;
  partNumber?: string;
  dimensions?: string;
  torqueSpec?: string;
  serviceInterval?: string;
  notes?: string;
}

type Mode = "rotate" | "pan" | "zoom" | "pin" | "measure" | "angle";
type Axis = "x" | "y" | "z";
type LengthUnit = "mm" | "in";

const TOOLBAR: {
  id: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}[] = [
  { id: "rotate", icon: RotateCw, label: "Rotate (LMB)" },
  { id: "pan", icon: Move, label: "Pan (LMB)" },
  { id: "zoom", icon: ZoomIn, label: "Zoom (LMB drag)" },
  { id: "reset", icon: RefreshCcw, label: "Reset View" },
  { id: "explode", icon: Layers, label: "Exploded View" },
  { id: "section", icon: Scissors, label: "Section Cut" },
  { id: "transparency", icon: Eye, label: "Transparency" },
  { id: "wireframe", icon: Grid3x3, label: "Wireframe" },
  { id: "measure", icon: Ruler, label: "Distance Measurement" },
  { id: "angle", icon: Compass, label: "Angle Measurement" },
  { id: "pin", icon: MapPin, label: "Pin Annotation" },
  { id: "paint", icon: Palette, label: "Component Colors" },
  { id: "fullscreen", icon: Maximize2, label: "Fullscreen" },
];

const PIN_COLORS = [
  { hex: "#67e8f9", name: "Cyan" },
  { hex: "#facc15", name: "Amber" },
  { hex: "#f87171", name: "Red" },
  { hex: "#4ade80", name: "Green" },
  { hex: "#c084fc", name: "Purple" },
];

// Industrial paint schemes — default matches classic blue centrifugal pump units
const PAINT_PRESETS: { id: string; name: string; colors: Record<string, string> }[] = [
  {
    id: "blue",
    name: "Industrial Blue",
    colors: {
      basePlate: "#12539c",
      motor: "#1f6fc4",
      coupling: "#2b7fd4",
      shaft: "#c9ced6",
      bearingDE: "#0f4a8a",
      bearingNDE: "#0f4a8a",
      seal: "#23272c",
      casing: "#1a63b8",
      impeller: "#b8bcc2",
      wearRing: "#c19a5c",
      suctionFlange: "#144e93",
      dischargeFlange: "#144e93",
    },
  },
  {
    id: "steel",
    name: "Steel Grey",
    colors: {
      basePlate: "#4a4d52",
      motor: "#5a6068",
      coupling: "#9a9ea4",
      shaft: "#d0d3d8",
      bearingDE: "#666a70",
      bearingNDE: "#666a70",
      seal: "#2a2c30",
      casing: "#8a8f96",
      impeller: "#b8bcc2",
      wearRing: "#c19a5c",
      suctionFlange: "#7a7f86",
      dischargeFlange: "#7a7f86",
    },
  },
  {
    id: "safety",
    name: "Safety Yellow",
    colors: {
      basePlate: "#3a3d42",
      motor: "#d9a218",
      coupling: "#e6b52c",
      shaft: "#d0d3d8",
      bearingDE: "#7a6a2a",
      bearingNDE: "#7a6a2a",
      seal: "#2a2c30",
      casing: "#e0aa1e",
      impeller: "#c8ccd2",
      wearRing: "#c19a5c",
      suctionFlange: "#b4881a",
      dischargeFlange: "#b4881a",
    },
  },
];

const PAINT_ORDER: { id: string; label: string }[] = [
  { id: "casing", label: "Casing" },
  { id: "impeller", label: "Impeller" },
  { id: "shaft", label: "Shaft" },
  { id: "seal", label: "Mechanical Seal" },
  { id: "bearingDE", label: "Bearing DE" },
  { id: "bearingNDE", label: "Bearing NDE" },
  { id: "wearRing", label: "Wear Ring" },
  { id: "coupling", label: "Coupling" },
  { id: "motor", label: "Motor" },
  { id: "basePlate", label: "Base Plate" },
  { id: "suctionFlange", label: "Suction Flange" },
  { id: "dischargeFlange", label: "Discharge Flange" },
];

const COLOR_KEY = "ocp.pump.colors.v1";
const STORAGE_KEY = "ocp.pump.annotations.v1";
const UNIT_KEY = "ocp.pump.unit.v1";

// One scene unit == 1 real-world metre. Every length readout in the UI is
// derived from this single constant, so if the model is ever rebuilt at a
// different scale (e.g. to match a real P-104 datasheet), fixing this one
// number keeps every measurement, coordinate, and section-cut position
// correct without hunting down scattered *1000 conversions.
const SCENE_UNITS_TO_METERS = 1;

const AXIS_VECTORS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function metersToDisplay(meters: number, unit: LengthUnit): string {
  if (unit === "in") return `${(meters * 39.3701).toFixed(2)} in`;
  return `${(meters * 1000 * SCENE_UNITS_TO_METERS).toFixed(1)} mm`;
}

function formatAngle(deg: number): string {
  return `${deg.toFixed(1)}°`;
}

export function Viewer3D({ selectedId, onSelect, sceneCommand }: Props) {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const partsRef = React.useRef<PartMesh[]>([]);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const outlineRef = React.useRef<THREE.LineSegments | null>(null);
  const targetCamRef = React.useRef<THREE.Vector3 | null>(null);
  const targetLookRef = React.useRef<THREE.Vector3 | null>(null);
  const clipPlaneRef = React.useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));

  const [explode, setExplode] = React.useState(0);
  const [wireframe, setWireframe] = React.useState(false);
  const [transparent, setTransparent] = React.useState(false);
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [mode, setMode] = React.useState<Mode>("rotate");
  const [section, setSection] = React.useState(false);
  const [sectionAxis, setSectionAxis] = React.useState<Axis>("x");
  const [sectionOffset, setSectionOffset] = React.useState(0);
  const [pinColor, setPinColor] = React.useState(PIN_COLORS[0].hex);
  const [annotations, setAnnotations] = React.useState<Annotation[]>(() => {
    try {
      const raw = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Annotation[]) : [];
    } catch {
      return [];
    }
  });
  const [measurePoints, setMeasurePoints] = React.useState<[number, number, number][]>([]);
  const [anglePoints, setAnglePoints] = React.useState<[number, number, number][]>([]);
  const [unit, setUnit] = React.useState<LengthUnit>(() => {
    try {
      const raw = typeof window !== "undefined" && window.localStorage.getItem(UNIT_KEY);
      return raw === "in" ? "in" : "mm";
    } catch {
      return "mm";
    }
  });
  const [cursorWorld, setCursorWorld] = React.useState<[number, number, number]>([0, 0, 0]);
  const [pendingPin, setPendingPin] = React.useState<{
    partId: string;
    pos: [number, number, number];
  } | null>(null);
  const [pendingNote, setPendingNote] = React.useState("");
  const [showList, setShowList] = React.useState(true);
  const [showSpecs, setShowSpecs] = React.useState(true);
  const [partColors, setPartColors] = React.useState<Record<string, string>>(
    PAINT_PRESETS[0].colors,
  );
  const [showPaint, setShowPaint] = React.useState(false);
  const [sceneReady, setSceneReady] = React.useState(false);

  // Load saved colors client-side (avoids SSR/hydration mismatch)
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLOR_KEY);
      if (raw) setPartColors({ ...PAINT_PRESETS[0].colors, ...JSON.parse(raw) });
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(UNIT_KEY, unit);
    } catch {}
  }, [unit]);

  // Apply colors to the 3D meshes (materials are cloned per part so each is independent)
  React.useEffect(() => {
    partsRef.current.forEach((p) => {
      const hex = partColors[p.id];
      if (!hex) return;
      p.mesh.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        let mat = mesh.material as THREE.MeshStandardMaterial;
        if (Array.isArray(mesh.material)) return;
        if (!mat.userData.perPart) {
          mat = mat.clone() as THREE.MeshStandardMaterial;
          mat.userData.perPart = true;
          mesh.material = mat;
        }
        mat.color.set(hex);
        // Painted castings read as coated surfaces; rotating steel stays metallic
        const bare = p.id === "shaft" || p.id === "impeller" || p.id === "wearRing";
        mat.metalness = bare ? 0.8 : 0.25;
        mat.roughness = bare ? 0.25 : 0.55;
        mat.needsUpdate = true;
      });
    });
  }, [partColors, sceneReady]);

  const setPartColor = (id: string, hex: string) => {
    setPartColors((prev) => {
      const next = { ...prev, [id]: hex };
      try {
        window.localStorage.setItem(COLOR_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const applyPreset = (id: string) => {
    const preset = PAINT_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPartColors(preset.colors);
    try {
      window.localStorage.setItem(COLOR_KEY, JSON.stringify(preset.colors));
    } catch {}
  };

  const STATE_COLORS: Record<string, string> = {
    healthy: "#22c55e",
    warning: "#f59e0b",
    critical: "#ef4444",
  };

  // Apply agent-planned scene ops (see src/lib/scene-ops.ts). Keyed on
  // sceneCommand.nonce rather than the ops array itself so a repeated
  // identical command (e.g. the user asks the same thing twice) still
  // re-fires -- a plain object/array in the dependency array would only
  // re-trigger on reference change, which a fresh nonce guarantees and a
  // fresh-but-equal ops array would not.
  React.useEffect(() => {
    if (!sceneCommand) return;
    for (const op of sceneCommand.ops) {
      if (op.type === "focus_component") {
        onSelect(op.component_id);
      } else if (op.type === "set_view_mode") {
        if (op.mode === "exploded") {
          setExplode(1);
          setSection(false);
        } else if (op.mode === "section") {
          setSection(true);
        } else {
          setExplode(0);
          setSection(false);
        }
      } else if (op.type === "set_component_state") {
        const hex = STATE_COLORS[op.state];
        if (hex) setPartColor(op.component_id, hex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneCommand?.nonce]);

  const modeRef = React.useRef(mode);
  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Persist annotations
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
    } catch {}
  }, [annotations]);

  // Keep the clipping plane in sync with the chosen axis + offset. Mutating
  // the existing Plane instance in place (rather than replacing the ref) is
  // enough -- three.js reads normal/constant off the same object reference
  // every frame, so this doesn't require touching renderer.clippingPlanes.
  React.useEffect(() => {
    const normal = AXIS_VECTORS[sectionAxis];
    clipPlaneRef.current.normal.copy(normal);
    clipPlaneRef.current.constant = sectionOffset;
  }, [sectionAxis, sectionOffset]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1c20);
    sceneRef.current = scene;

    const w = mount.clientWidth;
    const h = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(4.5, 2.8, 5.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(6, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-6, 3, -4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x88aacc, 0.5);
    rim.position.set(0, 4, -8);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const grid = new THREE.GridHelper(20, 40, 0x333333, 0x252525);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    grid.position.y = -1.4;
    scene.add(grid);

    const metal = (color: number, rough = 0.4) =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: rough });

    const casingMat = metal(0x8a8f96, 0.35);
    const impellerMat = metal(0xb8bcc2, 0.25);
    const shaftMat = metal(0xd0d3d8, 0.15);
    const bearingMat = metal(0x666a70, 0.3);
    const sealMat = new THREE.MeshStandardMaterial({
      color: 0x2a2c30,
      metalness: 0.3,
      roughness: 0.6,
    });
    const flangeMat = metal(0x7a7f86, 0.4);
    const baseMat = metal(0x4a4d52, 0.7);
    const motorMat = metal(0x5a6068, 0.5);
    const couplingMat = metal(0x9a9ea4, 0.3);

    const parts: PartMesh[] = [];
    const add = (
      id: string,
      mesh: THREE.Object3D,
      home: THREE.Vector3,
      dir: THREE.Vector3,
      mat: THREE.Material | THREE.Material[],
    ) => {
      mesh.position.copy(home);
      mesh.castShadow = true;
      mesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).castShadow = true;
          (o as THREE.Mesh).receiveShadow = true;
        }
      });
      mesh.userData.partId = id;
      scene.add(mesh);
      parts.push({ id, mesh, home: home.clone(), explodeDir: dir.clone(), originalMaterials: mat });
    };

    const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 1.4), baseMat);
    add("basePlate", base, new THREE.Vector3(0, -1.15, 0), new THREE.Vector3(0, -1, 0), baseMat);

    const motorGroup = new THREE.Group();
    const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 32), motorMat);
    motorBody.rotation.z = Math.PI / 2;
    motorGroup.add(motorBody);
    const motorFan = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 24), bearingMat);
    motorFan.rotation.z = Math.PI / 2;
    motorFan.position.x = 0.9;
    motorGroup.add(motorFan);
    const feet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.8), baseMat);
    feet.position.y = -0.6;
    motorGroup.add(feet);
    add("motor", motorGroup, new THREE.Vector3(1.7, -0.4, 0), new THREE.Vector3(2, 0, 0), motorMat);

    const coup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 24), couplingMat);
    coup.rotation.z = Math.PI / 2;
    add(
      "coupling",
      coup,
      new THREE.Vector3(0.85, -0.4, 0),
      new THREE.Vector3(1, 0.5, 0),
      couplingMat,
    );

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 24), shaftMat);
    shaft.rotation.z = Math.PI / 2;
    add("shaft", shaft, new THREE.Vector3(0.15, -0.4, 0), new THREE.Vector3(0, 1.5, 0), shaftMat);

    const bde = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 24), bearingMat);
    bde.rotation.z = Math.PI / 2;
    add(
      "bearingDE",
      bde,
      new THREE.Vector3(0.55, -0.4, 0),
      new THREE.Vector3(0.5, 1.2, 0),
      bearingMat,
    );

    const bnde = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 24), bearingMat);
    bnde.rotation.z = Math.PI / 2;
    add(
      "bearingNDE",
      bnde,
      new THREE.Vector3(-0.25, -0.4, 0),
      new THREE.Vector3(-0.5, 1.2, 0),
      bearingMat,
    );

    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), sealMat);
    seal.rotation.z = Math.PI / 2;
    add("seal", seal, new THREE.Vector3(-0.55, -0.4, 0), new THREE.Vector3(-1, 0.8, 0), sealMat);

    const casingGroup = new THREE.Group();
    const volute = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.32, 24, 48), casingMat);
    volute.rotation.y = Math.PI / 2;
    casingGroup.add(volute);
    const casingShell = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 32), casingMat);
    casingShell.rotation.z = Math.PI / 2;
    casingGroup.add(casingShell);
    add(
      "casing",
      casingGroup,
      new THREE.Vector3(-1.1, -0.4, 0),
      new THREE.Vector3(-1.2, 0, 0),
      casingMat,
    );

    const impGroup = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 24), impellerMat);
    hub.rotation.z = Math.PI / 2;
    impGroup.add(hub);
    for (let i = 0; i < 6; i++) {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.14), impellerMat);
      const a = (i / 6) * Math.PI * 2;
      vane.position.set(0, Math.sin(a) * 0.22, Math.cos(a) * 0.22);
      vane.rotation.x = a;
      impGroup.add(vane);
    }
    add(
      "impeller",
      impGroup,
      new THREE.Vector3(-1.1, -0.4, 0),
      new THREE.Vector3(-1.8, 0.6, 0),
      impellerMat,
    );

    const wr = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 12, 40), metal(0xc19a5c, 0.35));
    wr.rotation.y = Math.PI / 2;
    add(
      "wearRing",
      wr,
      new THREE.Vector3(-1.1, -0.4, 0),
      new THREE.Vector3(-2.2, -0.4, 0),
      wr.material as THREE.Material,
    );

    const sf = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 24), flangeMat);
    add(
      "suctionFlange",
      sf,
      new THREE.Vector3(-1.1, -0.4, 0.75),
      new THREE.Vector3(-1.2, 0, 2),
      flangeMat,
    );

    const df = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 24), flangeMat);
    df.rotation.set(0, 0, 0);
    add(
      "dischargeFlange",
      df,
      new THREE.Vector3(-1.1, 0.5, 0),
      new THREE.Vector3(-1.2, 2, 0),
      flangeMat,
    );

    partsRef.current = parts;
    setSceneReady(true);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const collectMeshes = () => {
      const meshes: THREE.Object3D[] = [];
      parts.forEach((p) =>
        p.mesh.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes.push(o);
        }),
      );
      return meshes;
    };

    const pickAt = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(collectMeshes(), false);
      return hits[0] ?? null;
    };

    // Cursor tracking for X/Y/Z
    const onHover = (ev: MouseEvent) => {
      const hit = pickAt(ev);
      if (hit) {
        const p = hit.point;
        setCursorWorld([p.x, p.y, p.z]);
      } else {
        // fallback: ray-plane at y=-1.4
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.4);
        const target = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, target)) {
          setCursorWorld([target.x, target.y, target.z]);
        }
      }
    };
    renderer.domElement.addEventListener("mousemove", onHover);

    const onClick = (ev: MouseEvent) => {
      if (didDrag) return;
      const m = modeRef.current;
      const hit = pickAt(ev);
      if (m === "pin") {
        if (hit) {
          let o: THREE.Object3D | null = hit.object;
          while (o && !o.userData.partId) o = o.parent;
          const pid = o?.userData.partId as string | undefined;
          if (pid) {
            const p = hit.point;
            setPendingPin({ partId: pid, pos: [p.x, p.y, p.z] });
            setPendingNote("");
          }
        }
        return;
      }
      if (m === "measure") {
        if (hit) {
          const p = hit.point;
          setMeasurePoints((prev) => {
            const next =
              prev.length >= 2
                ? ([[p.x, p.y, p.z]] as [number, number, number][])
                : [...prev, [p.x, p.y, p.z] as [number, number, number]];
            return next;
          });
        }
        return;
      }
      if (m === "angle") {
        if (hit) {
          const p = hit.point;
          setAnglePoints((prev) => {
            const next =
              prev.length >= 3
                ? ([[p.x, p.y, p.z]] as [number, number, number][])
                : [...prev, [p.x, p.y, p.z] as [number, number, number]];
            return next;
          });
        }
        return;
      }
      // default: select
      if (hit) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.partId) o = o.parent;
        if (o?.userData.partId) onSelect(o.userData.partId);
      } else {
        onSelect(null);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    let isDown = false;
    let isRight = false;
    let didDrag = false;
    let px = 0,
      py = 0;
    let theta = Math.atan2(camera.position.x, camera.position.z);
    let phi = Math.acos(camera.position.y / camera.position.length());
    let radius = camera.position.length();
    const target = new THREE.Vector3(0, 0, 0);

    const updateCam = () => {
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.position.set(x, y, z);
      camera.lookAt(target);
    };
    updateCam();

    const onDown = (e: MouseEvent) => {
      isDown = true;
      isRight = e.button === 2;
      px = e.clientX;
      py = e.clientY;
      didDrag = false;
    };
    const onUp = () => {
      isDown = false;
      setTimeout(() => {
        didDrag = false;
      }, 0);
    };
    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = e.clientX - px,
        dy = e.clientY - py;
      if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
      px = e.clientX;
      py = e.clientY;
      const m = modeRef.current;
      const doPan = isRight || m === "pan";
      const doZoom = m === "zoom" && !isRight;
      if (doPan) {
        const panSpeed = 0.005 * radius;
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        target.addScaledVector(right, -dx * panSpeed);
        target.addScaledVector(up, dy * panSpeed);
      } else if (doZoom) {
        radius = Math.max(2, Math.min(20, radius + dy * 0.02));
      } else {
        theta -= dx * 0.005;
        phi = Math.max(0.15, Math.min(Math.PI - 0.15, phi - dy * 0.005));
      }
      setAutoRotate(false);
      updateCam();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(2, Math.min(20, radius + e.deltaY * 0.005));
      updateCam();
    };
    const onCtx = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", onCtx);

    // Expose camera focus helper via ref-like closure
    focusRef.current = (pos: THREE.Vector3, dist = 3) => {
      const dir = new THREE.Vector3(1, 0.6, 1.2).normalize();
      targetCamRef.current = pos.clone().add(dir.multiplyScalar(dist));
      targetLookRef.current = pos.clone();
      setAutoRotate(false);
    };

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      if (autoRotateRef.current) {
        theta += dt * 0.15;
        updateCam();
      }

      if (targetCamRef.current && targetLookRef.current) {
        camera.position.lerp(targetCamRef.current, 0.08);
        target.lerp(targetLookRef.current, 0.08);
        camera.lookAt(target);
        const off = camera.position.clone().sub(target);
        radius = off.length();
        phi = Math.acos(off.y / radius);
        theta = Math.atan2(off.x, off.z);
        if (camera.position.distanceTo(targetCamRef.current) < 0.05) {
          targetCamRef.current = null;
          targetLookRef.current = null;
        }
      }

      const amt = explodeRef.current;
      parts.forEach((p) => {
        const desired = p.home.clone().add(p.explodeDir.clone().multiplyScalar(amt));
        p.mesh.position.lerp(desired, 0.15);
      });

      if (outlineRef.current) {
        const t = performance.now() * 0.003;
        (outlineRef.current.material as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(t) * 0.3;
      }

      // Update overlay label positions
      updateOverlayRef.current?.();

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      const W = mount.clientWidth,
        H = mount.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("mousemove", onHover);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoRotateRef = React.useRef(autoRotate);
  const explodeRef = React.useRef(explode);
  const focusRef = React.useRef<((pos: THREE.Vector3, dist?: number) => void) | null>(null);
  const updateOverlayRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);
  React.useEffect(() => {
    explodeRef.current = explode;
  }, [explode]);

  // Apply wireframe / transparency
  React.useEffect(() => {
    partsRef.current.forEach((p) => {
      p.mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && "wireframe" in m) {
          m.wireframe = wireframe;
          m.transparent = transparent;
          m.opacity = transparent ? 0.35 : 1;
          m.needsUpdate = true;
        }
      });
    });
  }, [wireframe, transparent]);

  // Section clipping
  React.useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.clippingPlanes = section ? [clipPlaneRef.current] : [];
  }, [section]);

  // Selection handling
  React.useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    if (outlineRef.current) {
      scene.remove(outlineRef.current);
      outlineRef.current.geometry.dispose();
      (outlineRef.current.material as THREE.Material).dispose();
      outlineRef.current = null;
    }
    if (!selectedId) return;
    const part = partsRef.current.find((p) => p.id === selectedId);
    if (!part) return;

    const box = new THREE.Box3().setFromObject(part.mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const boxGeo = new THREE.BoxGeometry(size.x * 1.08, size.y * 1.08, size.z * 1.08);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.9,
      }),
    );
    line.position.copy(center);
    scene.add(line);
    outlineRef.current = line;

    const distance = Math.max(size.length() * 2.2, 2.5);
    focusRef.current?.(center, distance);
  }, [selectedId]);

  // 3D annotation pin meshes + measurement/angle geometry
  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const group = new THREE.Group();
    group.name = "annotation-pins";
    annotations.forEach((a) => {
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(a.color) }),
      );
      pin.position.set(a.pos[0], a.pos[1], a.pos[2]);
      pin.userData.annId = a.id;
      group.add(pin);

      const ringGeo = new THREE.RingGeometry(0.08, 0.11, 24);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(a.color),
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.copy(pin.position);
      ring.userData.face = "camera";
      group.add(ring);
    });
    // Distance measurement line
    if (measurePoints.length === 2) {
      const [a, b] = measurePoints;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...a),
        new THREE.Vector3(...b),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfacc15 }));
      group.add(line);
      const endpoint = (p: [number, number, number]) => {
        const s = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
        );
        s.position.set(...p);
        group.add(s);
      };
      endpoint(a);
      endpoint(b);
    } else if (measurePoints.length === 1) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
      );
      s.position.set(...measurePoints[0]);
      group.add(s);
    }
    // Angle measurement: two rays sharing a vertex (point 2) -- useful for
    // shaft/coupling alignment checks and bracket/fitting angle callouts.
    if (anglePoints.length >= 2) {
      const [p1, p2] = anglePoints;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p1),
        new THREE.Vector3(...p2),
      ]);
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc084fc })));
    }
    if (anglePoints.length === 3) {
      const [, p2, p3] = anglePoints;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p2),
        new THREE.Vector3(...p3),
      ]);
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc084fc })));
    }
    anglePoints.forEach((p) => {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xc084fc }),
      );
      s.position.set(...p);
      group.add(s);
    });
    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    };
  }, [annotations, measurePoints, anglePoints]);

  // Overlay label update — imperative for perf
  React.useEffect(() => {
    const overlay = overlayRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!overlay || !camera || !renderer) return;

    const project = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        left: (v.x * 0.5 + 0.5) * rect.width,
        top: (-v.y * 0.5 + 0.5) * rect.height,
        visible: v.z < 1,
      };
    };

    updateOverlayRef.current = () => {
      const children = overlay.querySelectorAll<HTMLElement>("[data-anchor]");
      children.forEach((el) => {
        const x = parseFloat(el.dataset.x || "0");
        const y = parseFloat(el.dataset.y || "0");
        const z = parseFloat(el.dataset.z || "0");
        const p = project(x, y, z);
        el.style.transform = `translate(-50%, -100%) translate(${p.left}px, ${p.top - 10}px)`;
        el.style.opacity = p.visible ? "1" : "0";
      });
    };

    return () => {
      updateOverlayRef.current = null;
    };
  }, [annotations, measurePoints, anglePoints]);

  const handleTool = (id: string) => {
    if (id === "reset") {
      targetCamRef.current = new THREE.Vector3(4.5, 2.8, 5.5);
      targetLookRef.current = new THREE.Vector3(0, 0, 0);
      setAutoRotate(true);
      onSelect(null);
      setMeasurePoints([]);
      setAnglePoints([]);
    } else if (id === "explode") setExplode((e) => (e > 0 ? 0 : 1));
    else if (id === "wireframe") setWireframe((w) => !w);
    else if (id === "transparency") setTransparent((t) => !t);
    else if (id === "section") setSection((s) => !s);
    else if (id === "measure") {
      setMode((m) => (m === "measure" ? "rotate" : "measure"));
      setMeasurePoints([]);
    } else if (id === "angle") {
      setMode((m) => (m === "angle" ? "rotate" : "angle"));
      setAnglePoints([]);
    } else if (id === "pin") setMode((m) => (m === "pin" ? "rotate" : "pin"));
    else if (id === "rotate" || id === "pan" || id === "zoom") setMode(id as Mode);
    else if (id === "paint") setShowPaint((v) => !v);
    else if (id === "fullscreen") mountRef.current?.requestFullscreen?.();
  };

  const commitPin = () => {
    if (!pendingPin) return;
    const ann: Annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      partId: pendingPin.partId,
      pos: pendingPin.pos,
      color: pinColor,
      note: pendingNote.trim() || "Untitled observation",
      createdAt: Date.now(),
    };
    setAnnotations((prev) => [...prev, ann]);
    setPendingPin(null);
    setPendingNote("");
    setMode("rotate");
  };

  const deleteAnnotation = (id: string) =>
    setAnnotations((prev) => prev.filter((a) => a.id !== id));

  const replayAnnotation = (a: Annotation) => {
    onSelect(a.partId);
    // slight delay to override selection focus
    setTimeout(() => {
      focusRef.current?.(new THREE.Vector3(...a.pos), 1.8);
    }, 50);
  };

  const measureDistanceMeters =
    measurePoints.length === 2
      ? Math.hypot(
          measurePoints[0][0] - measurePoints[1][0],
          measurePoints[0][1] - measurePoints[1][1],
          measurePoints[0][2] - measurePoints[1][2],
        ) * SCENE_UNITS_TO_METERS
      : null;

  // Angle at the shared vertex (anglePoints[1]) between the rays to
  // anglePoints[0] and anglePoints[2].
  const angleDegrees =
    anglePoints.length === 3
      ? (() => {
          const [p1, p2, p3] = anglePoints;
          const v1 = new THREE.Vector3(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]);
          const v2 = new THREE.Vector3(p3[0] - p2[0], p3[1] - p2[1], p3[2] - p2[2]);
          if (v1.lengthSq() === 0 || v2.lengthSq() === 0) return null;
          const cos = v1.dot(v2) / (v1.length() * v2.length());
          return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
        })()
      : null;

  const selectedName = selectedId ? pumpComponents[selectedId]?.name : null;
  const selectedSpec: ComponentSpec | undefined = selectedId
    ? (pumpComponents[selectedId] as ComponentSpec | undefined)
    : undefined;
  const specRows: [string, string][] = selectedSpec
  ? [
      ["Designation", selectedSpec.designation],
      ["Material", selectedSpec.material],
      ["Manufacturer", selectedSpec.manufacturer],
      ["Part No.", selectedSpec.partNumber],
      ["Dimensions", selectedSpec.dimensions],
      ["Torque spec", selectedSpec.torqueSpec],
      ["Service interval", selectedSpec.serviceInterval],
    ].filter(
      (row): row is [string, string] => Boolean(row[1])
    )
  : [];

  const cursorClass =
    mode === "pin" || mode === "angle"
      ? "cursor-crosshair"
      : mode === "measure"
        ? "cursor-crosshair"
        : mode === "pan"
          ? "cursor-grab"
          : mode === "zoom"
            ? "cursor-ns-resize"
            : "cursor-default";

  return (
    <div className="flex flex-col h-full bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-surface-2/60">
        {TOOLBAR.map((t) => {
          const active =
            (t.id === "explode" && explode > 0) ||
            (t.id === "wireframe" && wireframe) ||
            (t.id === "transparency" && transparent) ||
            (t.id === "section" && section) ||
            (t.id === "measure" && mode === "measure") ||
            (t.id === "angle" && mode === "angle") ||
            (t.id === "pin" && mode === "pin") ||
            (t.id === "rotate" && mode === "rotate") ||
            (t.id === "pan" && mode === "pan") ||
            (t.id === "zoom" && mode === "zoom") ||
            (t.id === "paint" && showPaint);
          return (
            <button
              key={t.id}
              onClick={() => handleTool(t.id)}
              title={t.label}
              className={`p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${
                active ? "bg-accent text-foreground" : ""
              }`}
            >
              <t.icon className="h-4 w-4" strokeWidth={1.5} />
            </button>
          );
        })}
        {mode === "pin" && (
          <div className="ml-2 flex items-center gap-1 pl-2 border-l border-border">
            {PIN_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setPinColor(c.hex)}
                title={c.name}
                className={`h-4 w-4 rounded-full border transition-transform ${pinColor === c.hex ? "scale-125 border-foreground" : "border-border"}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}
        {section && (
          <div className="ml-2 flex items-center gap-2 pl-2 border-l border-border">
            {(["x", "y", "z"] as Axis[]).map((axis) => (
              <button
                key={axis}
                onClick={() => {
                       setSectionOffset(0);
                      setSectionAxis(axis);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  sectionAxis === axis
                    ? "border-[color:var(--cyan)] text-[color:var(--cyan)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {axis.toUpperCase()}
              </button>
            ))}
            <input
              type="range"
              min={-2}
              max={2}
              step={0.01}
              value={sectionOffset}
              onChange={(e) => setSectionOffset(parseFloat(e.target.value))}
              className="w-24 accent-[color:var(--cyan)]"
              title={`Cut plane offset along ${sectionAxis.toUpperCase()}`}
            />
            <span className="text-[10px] font-mono text-muted-foreground w-14">
              {metersToDisplay(sectionOffset, unit)}
            </span>
          </div>
        )}
        <button
          onClick={() => setUnit((u) => (u === "mm" ? "in" : "mm"))}
          title="Toggle length units"
          className="ml-2 px-1.5 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          {unit}
        </button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground font-mono">
          <span>P-104 · Centrifugal Pump</span>
          <span className="h-4 w-px bg-border" />
          <span className="capitalize">Mode · {mode}</span>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={mountRef} className={`absolute inset-0 ${cursorClass}`} />

        {/* Overlay for annotation labels & measurement */}
        <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden">
          {annotations.map((a) => (
            <div
              key={a.id}
              data-anchor="1"
              data-x={a.pos[0]}
              data-y={a.pos[1]}
              data-z={a.pos[2]}
              className="pointer-events-auto absolute top-0 left-0 flex flex-col items-center gap-1"
              style={{ willChange: "transform" }}
            >
              <div
                className="px-2 py-1 rounded-md text-[10px] font-medium text-black shadow-lg max-w-[180px] truncate"
                style={{ backgroundColor: a.color }}
                title={a.note}
              >
                {a.note}
              </div>
              <div className="h-3 w-px" style={{ backgroundColor: a.color }} />
            </div>
          ))}
          {measureDistanceMeters !== null && (
            <div
              data-anchor="1"
              data-x={(measurePoints[0][0] + measurePoints[1][0]) / 2}
              data-y={(measurePoints[0][1] + measurePoints[1][1]) / 2}
              data-z={(measurePoints[0][2] + measurePoints[1][2]) / 2}
              className="absolute top-0 left-0 px-2 py-1 rounded-md text-[10px] font-mono bg-[color:var(--warning)] text-black shadow-lg"
            >
              {metersToDisplay(measureDistanceMeters, unit)}
            </div>
          )}
          {angleDegrees !== null && (
            <div
              data-anchor="1"
              data-x={anglePoints[1][0]}
              data-y={anglePoints[1][1]}
              data-z={anglePoints[1][2]}
              className="absolute top-0 left-0 px-2 py-1 rounded-md text-[10px] font-mono bg-[#c084fc] text-black shadow-lg"
            >
              {formatAngle(angleDegrees)}
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 text-[11px] font-mono text-muted-foreground">
          <div className="px-2 py-1 rounded-md glass">FPS · 60 · WebGL2</div>
          <div className="px-2 py-1 rounded-md glass">Model · pump_p104.glb</div>
          {section && (
            <div className="px-2 py-1 rounded-md glass text-[color:var(--warning)]">
              Section · {sectionAxis.toUpperCase()} = {metersToDisplay(sectionOffset, unit)}
            </div>
          )}
          {mode === "measure" && (
            <div className="px-2 py-1 rounded-md glass text-[color:var(--warning)]">
              Measure · click 2 points {measurePoints.length}/2
            </div>
          )}
          {mode === "angle" && (
            <div className="px-2 py-1 rounded-md glass text-[#c084fc]">
              Angle · click vertex then 2 rays {anglePoints.length}/3
            </div>
          )}
          {mode === "pin" && (
            <div className="px-2 py-1 rounded-md glass text-[color:var(--cyan)]">
              Pin · click a component
            </div>
          )}
        </div>

        {selectedName && (
          <div className="absolute top-3 right-3 w-64 rounded-md glass border border-border/60 text-xs overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 border-b border-border/60"
              onClick={() => setShowSpecs((v) => !v)}
            >
              <span className="text-[color:var(--cyan)]">◆</span>
              <span className="font-medium truncate">{selectedName}</span>
              <Info className="h-3 w-3 ml-auto text-muted-foreground shrink-0" strokeWidth={1.5} />
            </button>
            {showSpecs && specRows.length > 0 && (
              <div className="px-3 py-2 space-y-1">
                {specRows.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
                    <span className="text-[10px] font-mono text-right">{value}</span>
                  </div>
                ))}
              </div>
            )}
            {showSpecs && specRows.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/70">
                No datasheet fields on file for this component yet.
              </div>
            )}
          </div>
        )}

        {/* Paint / colors panel (top-left under HUD) */}
        {showPaint && (
          <div className="absolute top-3 left-40 w-64 max-h-[80%] flex flex-col rounded-md glass border border-border/60 text-xs">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
              <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="font-medium">Component Colors</span>
              <button
                onClick={() => setShowPaint(false)}
                className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40">
              {PAINT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className="px-2 py-1 rounded text-[10px] border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto scrollbar-thin flex-1">
              {PAINT_ORDER.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 hover:bg-surface-2/40 cursor-pointer"
                >
                  <span
                    className="h-4 w-4 rounded border border-border shrink-0"
                    style={{ backgroundColor: partColors[p.id] }}
                  />
                  <span className="flex-1 truncate text-[11px]">{p.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {partColors[p.id]}
                  </span>
                  <input
                    type="color"
                    value={partColors[p.id] ?? "#888888"}
                    onChange={(e) => setPartColor(p.id, e.target.value)}
                    className="h-5 w-5 opacity-0 absolute pointer-events-auto"
                    style={{ width: 0, height: 0 }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Annotations panel (bottom-right) */}
        <div className="absolute bottom-14 right-3 w-64 max-h-[45%] flex flex-col rounded-md glass border border-border/60 text-xs">
          <button
            className="flex items-center gap-2 px-3 py-2 border-b border-border/60 text-muted-foreground hover:text-foreground"
            onClick={() => setShowList((v) => !v)}
          >
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="font-medium">Annotations</span>
            <span className="ml-auto font-mono text-[10px]">{annotations.length}</span>
          </button>
          {showList && (
            <div className="overflow-y-auto scrollbar-thin flex-1">
              {annotations.length === 0 && (
                <div className="px-3 py-3 text-[11px] text-muted-foreground/70">
                  No annotations. Activate <span className="text-foreground">Pin</span> and click a
                  part.
                </div>
              )}
              {annotations.map((a) => (
                <div
                  key={a.id}
                  className="group flex items-start gap-2 px-3 py-2 border-b border-border/40 hover:bg-surface-2/40"
                >
                  <span
                    className="mt-0.5 h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium truncate">{a.note}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {pumpComponents[a.partId]?.name ?? a.partId} ·{" "}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => replayAnnotation(a)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent text-muted-foreground hover:text-[color:var(--cyan)]"
                    title="Replay"
                  >
                    <Play className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => deleteAnnotation(a.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent text-muted-foreground hover:text-[color:var(--danger,#f87171)]"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coord bar */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-6 px-4 py-1.5 rounded-full glass text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          <span>
            <span className="text-[color:var(--cyan)]">X</span>{" "}
            {metersToDisplay(cursorWorld[0] * SCENE_UNITS_TO_METERS, unit)}
          </span>
          <span>
            <span className="text-[color:var(--cyan)]">Y</span>{" "}
            {metersToDisplay(cursorWorld[1] * SCENE_UNITS_TO_METERS, unit)}
          </span>
          <span>
            <span className="text-[color:var(--cyan)]">Z</span>{" "}
            {metersToDisplay(cursorWorld[2] * SCENE_UNITS_TO_METERS, unit)}
          </span>
          <span className="h-3 w-px bg-border" />
          <span>Units · {unit}</span>
        </div>

        {/* Pin note modal */}
        {pendingPin && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="w-[380px] rounded-lg border border-border bg-surface-1 shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <MapPin className="h-4 w-4" style={{ color: pinColor }} strokeWidth={1.5} />
                <div className="text-sm font-medium">New annotation</div>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  {pumpComponents[pendingPin.partId]?.name ?? pendingPin.partId}
                </span>
                <button
                  onClick={() => setPendingPin(null)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {PIN_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setPinColor(c.hex)}
                      className={`h-5 w-5 rounded-full border transition-transform ${pinColor === c.hex ? "scale-125 border-foreground" : "border-border"}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <textarea
                  autoFocus
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="Describe the observation (e.g. Visible pitting near vane leading edge)…"
                  className="w-full h-24 px-3 py-2 text-sm rounded-md bg-surface-2 border border-border focus:outline-none focus:border-[color:var(--cyan)] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitPin();
                    if (e.key === "Escape") setPendingPin(null);
                  }}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPendingPin(null)}
                    className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={commitPin}
                    className="px-3 py-1.5 text-xs rounded-md bg-foreground text-background hover:opacity-90"
                  >
                    Save pin
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}