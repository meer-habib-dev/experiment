import { PixelRatio } from 'react-native';
import type { CanvasRef, RNCanvasContext } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type ArenaTier = 'Club' | 'Lower bowl' | 'Skyline';

export type ArenaSeat = {
  id: string;
  label: string;
  price: number;
  row: string;
  seat: number;
  section: number;
  tier: ArenaTier;
};

export type ArenaSection = {
  available: number;
  fromPrice: number;
  reserved: number;
  section: number;
  total: number;
};

export type ArenaWorldEvents = {
  onLimit: () => void;
  onReady: () => void;
  onSeatFocus: (seat: ArenaSeat | null) => void;
  onSeatPulse: (kind: 'added' | 'removed' | 'unavailable') => void;
  onSectionFocus: (section: ArenaSection | null) => void;
  onSelectionChange: (seats: ArenaSeat[]) => void;
};

type SeatRecord = ArenaSeat & {
  index: number;
  lift: number;
  position: THREE.Vector3;
  reserved: boolean;
  rotationY: number;
  selected: boolean;
  theta: number;
  tierIndex: number;
};

type TierDefinition = {
  baseRadiusX: number;
  baseRadiusZ: number;
  columns: number;
  name: ArenaTier;
  price: number;
  rowStep: number;
  rows: number;
  seatScale: number;
  yStart: number;
  yStep: number;
};

const MAX_SELECTION = 6;
const SECTION_COUNT = 18;
const AVAILABLE = new THREE.Color(0xd9faf4);
const RESERVED = new THREE.Color(0x63777f);
const SELECTED = new THREE.Color(0xd8ff36);
const TIERS: TierDefinition[] = [
  {
    baseRadiusX: 7.1,
    baseRadiusZ: 4.8,
    columns: 7,
    name: 'Lower bowl',
    price: 165,
    rowStep: 0.55,
    rows: 5,
    seatScale: 1.04,
    yStart: 0.72,
    yStep: 0.38,
  },
  {
    baseRadiusX: 10.25,
    baseRadiusZ: 7.1,
    columns: 8,
    name: 'Club',
    price: 118,
    rowStep: 0.56,
    rows: 4,
    seatScale: 0.94,
    yStart: 3.35,
    yStep: 0.4,
  },
  {
    baseRadiusX: 12.9,
    baseRadiusZ: 9.15,
    columns: 9,
    name: 'Skyline',
    price: 72,
    rowStep: 0.52,
    rows: 4,
    seatScale: 0.84,
    yStart: 5.56,
    yStep: 0.37,
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const nearestAngle = (from: number, target: number) =>
  from + Math.atan2(Math.sin(target - from), Math.cos(target - from));

const seeded = (seed: number) => {
  const value = Math.sin(seed * 91.713 + 17.19) * 43758.5453;
  return value - Math.floor(value);
};

const rowName = (tierIndex: number, row: number) =>
  String.fromCharCode(65 + tierIndex * 5 + row);

function createBox(
  width: number,
  height: number,
  depth: number,
  color: number,
  options: { emissive?: number; emissiveIntensity?: number; metalness?: number; roughness?: number } = {},
) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      metalness: options.metalness ?? 0.08,
      roughness: options.roughness ?? 0.7,
    }),
  );
}

export class ArenaWorld {
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  private cameraPhi = 0.74;
  private cameraPhiTarget = 0.74;
  private cameraRadius = 30;
  private cameraRadiusTarget = 30;
  private cameraTarget = new THREE.Vector3(0, 2.2, 0);
  private cameraTargetGoal = new THREE.Vector3(0, 2.2, 0);
  private cameraTheta = -0.82;
  private cameraThetaTarget = -0.82;
  private context: RNCanvasContext | null = null;
  private events: ArenaWorldEvents;
  private frame = 0;
  private focusedSection: number | null = null;
  private lastFrame = 0;
  private lastInteraction = 0;
  private lightRig: THREE.Group | null = null;
  private raycaster = new THREE.Raycaster();
  private renderer: THREE.WebGPURenderer | null = null;
  private running = false;
  private scene = new THREE.Scene();
  private seatBacks: THREE.InstancedMesh | null = null;
  private seatCushions: THREE.InstancedMesh | null = null;
  private selectionMarkers = new Map<number, THREE.Mesh>();
  private seats: SeatRecord[] = [];
  private stars: THREE.Points | null = null;
  private viewportHeight = 1;
  private viewportWidth = 1;

  constructor(events: ArenaWorldEvents) {
    this.events = events;
  }

  async initialize(canvasRef: CanvasRef, device: GPUDevice) {
    this.context = canvasRef.getContext('webgpu');
    if (!this.context) throw new Error('WebGPU canvas context is unavailable.');

    const canvas = this.context.canvas as HTMLCanvasElement;
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      throw new Error('WebGPU canvas has not been laid out yet.');
    }
    this.viewportWidth = canvas.clientWidth;
    this.viewportHeight = canvas.clientHeight;
    const renderScale = Math.min(PixelRatio.get(), 2.5);
    canvas.width = Math.max(1, Math.round(this.viewportWidth * renderScale));
    canvas.height = Math.max(1, Math.round(this.viewportHeight * renderScale));
    this.context.configure({
      alphaMode: 'premultiplied',
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });

    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      canvas: canvas as unknown as HTMLCanvasElement,
      context: this.context,
    });
    await this.renderer.init();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.updateProjectionMatrix();
    this.buildScene();
    this.updateCamera(true);
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.animate);
    this.events.onReady();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (drawable.geometry) geometries.add(drawable.geometry);
      if (Array.isArray(drawable.material)) drawable.material.forEach((material) => materials.add(material));
      else if (drawable.material) materials.add(drawable.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.renderer?.dispose();
    this.renderer = null;
  }

  start() {
    this.running = true;
    this.lastInteraction = performance.now();
    this.cameraRadiusTarget = 30;
    this.cameraPhiTarget = 0.74;
  }

  orbit(deltaX: number, deltaY: number) {
    this.running = true;
    this.lastInteraction = performance.now();
    this.cameraThetaTarget -= deltaX * 0.0062;
    this.cameraPhiTarget = clamp(this.cameraPhiTarget + deltaY * 0.0045, 0.49, 1.32);
  }

  zoom(scaleDelta: number) {
    this.lastInteraction = performance.now();
    this.cameraRadiusTarget = clamp(
      this.cameraRadiusTarget / Math.max(scaleDelta, 0.05),
      this.focusedSection === null ? 15.5 : 6.8,
      38,
    );
  }

  resetView() {
    this.lastInteraction = performance.now();
    this.focusedSection = null;
    this.cameraThetaTarget = nearestAngle(this.cameraThetaTarget, -0.82);
    this.cameraPhiTarget = 0.74;
    this.cameraRadiusTarget = 30;
    this.cameraTargetGoal.set(0, 2.2, 0);
    this.applySeatColors();
    this.events.onSectionFocus(null);
  }

  focusSectionAtNormalized(x: number, y: number) {
    const seat = this.seatAtNormalized(x, y);
    if (seat && this.focusedSection !== seat.section) this.focusSection(seat.section);
    else this.zoom(1.32);
  }

  focusSection(sectionNumber: number) {
    const sectionSeats = this.seats.filter((seat) => seat.section === sectionNumber);
    if (sectionSeats.length === 0) return;
    const center = sectionSeats.reduce(
      (sum, seat) => sum.add(seat.position),
      new THREE.Vector3(),
    ).multiplyScalar(1 / sectionSeats.length);
    const radialAngle = Math.atan2(center.z, center.x);
    this.focusedSection = sectionNumber;
    this.lastInteraction = performance.now();
    this.cameraThetaTarget = nearestAngle(this.cameraThetaTarget, radialAngle);
    this.cameraPhiTarget = 0.96;
    this.cameraRadiusTarget = 10.8;
    this.cameraTargetGoal.set(center.x * 0.78, center.y * 0.84, center.z * 0.78);
    this.applySeatColors();
    this.events.onSectionFocus(this.sectionDetails(sectionNumber));
  }

  previewSeat(id: string) {
    const seat = this.seats.find((candidate) => candidate.id === id);
    if (!seat) return;
    const radialAngle = Math.atan2(seat.position.z, seat.position.x);
    const radialDistance = Math.hypot(seat.position.x, seat.position.z);
    const targetHeight = 0.34;
    const cameraHeight = seat.position.y + 0.68;
    this.lastInteraction = performance.now();
    this.cameraThetaTarget = nearestAngle(this.cameraThetaTarget, radialAngle);
    this.cameraRadiusTarget = radialDistance;
    this.cameraPhiTarget = Math.acos(
      clamp((cameraHeight - targetHeight) / radialDistance, -0.9, 0.9),
    );
    this.cameraTargetGoal.set(0, targetHeight, 0);
  }

  clearSelection() {
    this.seats.forEach((seat) => {
      if (seat.selected) seat.selected = false;
    });
    this.events.onSeatFocus(null);
    this.emitSelection();
  }

  confirmSelection() {
    this.seats.forEach((seat) => {
      if (!seat.selected) return;
      seat.selected = false;
      seat.reserved = true;
    });
    this.events.onSeatFocus(null);
    this.emitSelection();
  }

  pickNormalized(x: number, y: number) {
    if (!this.running) return;
    const seat = this.seatAtNormalized(x, y);
    if (!seat) return;
    this.lastInteraction = performance.now();
    if (this.focusedSection !== seat.section) {
      this.focusSection(seat.section);
      return;
    }
    if (seat.reserved) {
      this.events.onSeatPulse('unavailable');
      return;
    }
    if (!seat.selected && this.selectedSeats().length >= MAX_SELECTION) {
      this.events.onLimit();
      return;
    }

    seat.selected = !seat.selected;
    if (seat.selected) this.ensureSelectionMarker(seat);
    this.events.onSeatPulse(seat.selected ? 'added' : 'removed');
    this.events.onSeatFocus(seat.selected ? this.serializeSeat(seat) : null);
    this.emitSelection();
  }

  private selectedSeats() {
    return this.seats.filter((seat) => seat.selected);
  }

  private seatAtNormalized(x: number, y: number) {
    if (!this.seatCushions || !this.seatBacks) return null;
    const point = new THREE.Vector2(clamp(x, 0, 1) * 2 - 1, -clamp(y, 0, 1) * 2 + 1);
    this.raycaster.setFromCamera(point, this.camera);
    const hit = this.raycaster
      .intersectObjects([this.seatCushions, this.seatBacks], false)
      .find((candidate) => Number.isInteger(candidate.instanceId));
    if (!hit || hit.instanceId === undefined) return null;
    return this.seats[hit.instanceId] ?? null;
  }

  private sectionDetails(sectionNumber: number): ArenaSection {
    const seats = this.seats.filter((seat) => seat.section === sectionNumber);
    const availableSeats = seats.filter((seat) => !seat.reserved);
    return {
      available: availableSeats.length,
      fromPrice: availableSeats.length
        ? Math.min(...availableSeats.map((seat) => seat.price))
        : 0,
      reserved: seats.length - availableSeats.length,
      section: sectionNumber,
      total: seats.length,
    };
  }

  private seatBaseColor(seat: SeatRecord) {
    const color = (seat.reserved ? RESERVED : AVAILABLE).clone();
    if (this.focusedSection !== null && seat.section !== this.focusedSection && !seat.selected) {
      color.multiplyScalar(0.34);
    }
    return color;
  }

  private applySeatColors() {
    if (!this.seatCushions || !this.seatBacks) return;
    this.seats.forEach((seat) => {
      const color = this.seatBaseColor(seat).lerp(SELECTED, seat.lift);
      this.seatCushions?.setColorAt(seat.index, color);
      this.seatBacks?.setColorAt(seat.index, color);
    });
    if (this.seatCushions.instanceColor) this.seatCushions.instanceColor.needsUpdate = true;
    if (this.seatBacks.instanceColor) this.seatBacks.instanceColor.needsUpdate = true;
  }

  private emitSelection() {
    this.events.onSelectionChange(
      this.selectedSeats()
        .sort((a, b) => a.section - b.section || a.row.localeCompare(b.row) || a.seat - b.seat)
        .map(({ id, label, price, row, seat, section, tier }) => ({
          id,
          label,
          price,
          row,
          seat,
          section,
          tier,
        })),
    );
  }

  private serializeSeat({ id, label, price, row, seat, section, tier }: SeatRecord): ArenaSeat {
    return { id, label, price, row, seat, section, tier };
  }

  private ensureSelectionMarker(seat: SeatRecord) {
    if (this.selectionMarkers.has(seat.index)) return;
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.022, 8, 32),
      new THREE.MeshBasicMaterial({ color: SELECTED, opacity: 0, transparent: true }),
    );
    marker.position.copy(seat.position);
    marker.rotation.x = Math.PI / 2;
    marker.visible = false;
    this.selectionMarkers.set(seat.index, marker);
    this.scene.add(marker);
  }

  private buildScene() {
    this.scene.background = new THREE.Color(0x07141c);
    this.scene.fog = new THREE.FogExp2(0x07141c, 0.009);
    this.scene.add(new THREE.HemisphereLight(0xd8f6ff, 0x10131a, 2.1));

    const key = new THREE.DirectionalLight(0xf4fbff, 3.1);
    key.position.set(-8, 15, 8);
    this.scene.add(key);
    const violet = new THREE.PointLight(0x8f5bff, 58, 38, 1.7);
    violet.position.set(-11, 9, -7);
    this.scene.add(violet);
    const cyan = new THREE.PointLight(0x16e8da, 48, 36, 1.8);
    cyan.position.set(10, 7, 6);
    this.scene.add(cyan);

    this.createArenaShell();
    this.createPitch();
    this.createSeats();
    this.createLightRig();
    this.createAtmosphere();
  }

  private createArenaShell() {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(14.8, 15.8, 0.9, 96),
      new THREE.MeshStandardMaterial({ color: 0x0a1219, metalness: 0.32, roughness: 0.7 }),
    );
    base.position.y = -0.55;
    base.scale.x = 1.38;
    this.scene.add(base);

    const decks = [
      { inner: 5.9, outer: 10, y: 0.14, color: 0x1d2c34 },
      { inner: 8.5, outer: 13.1, y: 2.8, color: 0x172730 },
      { inner: 11.2, outer: 15.4, y: 5.02, color: 0x13232b },
    ];
    decks.forEach((deck) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(deck.inner, deck.outer, 128),
        new THREE.MeshStandardMaterial({ color: deck.color, metalness: 0.16, roughness: 0.78 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.x = 1.39;
      mesh.position.y = deck.y;
      this.scene.add(mesh);
    });

    for (const radius of [10.05, 13.15, 15.45]) {
      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.055, 8, 128),
        new THREE.MeshBasicMaterial({ color: radius === 13.15 ? 0x9b6cff : 0x23dccd }),
      );
      ribbon.rotation.x = Math.PI / 2;
      ribbon.scale.x = 1.39;
      ribbon.position.y = radius === 10.05 ? 2.72 : radius === 13.15 ? 4.94 : 7.17;
      this.scene.add(ribbon);
    }

    for (let index = 0; index < SECTION_COUNT; index += 1) {
      const theta = (index / SECTION_COUNT) * Math.PI * 2;
      const pillar = createBox(0.14, 7.2, 0.14, 0x273741, { metalness: 0.76, roughness: 0.24 });
      pillar.position.set(Math.cos(theta) * 20.25, 3.25, Math.sin(theta) * 14.45);
      pillar.rotation.y = -theta;
      this.scene.add(pillar);
    }
  }

  private createPitch() {
    const pitch = createBox(10.5, 0.18, 5.8, 0x153e34, { roughness: 0.92 });
    pitch.position.y = 0.03;
    this.scene.add(pitch);

    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x69a88c, opacity: 0.13, transparent: true });
    for (let index = 0; index < 10; index += 1) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 5.62), stripeMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-4.72 + index * 1.05, 0.135, 0);
      this.scene.add(stripe);
    }

    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xd5ffe9, opacity: 0.72, transparent: true });
    const boundary = new THREE.Mesh(new THREE.BoxGeometry(10.05, 0.025, 0.045), lineMaterial);
    for (const z of [-2.56, 2.56]) {
      const line = boundary.clone();
      line.position.set(0, 0.16, z);
      this.scene.add(line);
    }
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 5.16), lineMaterial);
    for (const x of [-5, 5]) {
      const line = side.clone();
      line.position.set(x, 0.16, 0);
      this.scene.add(line);
    }
    const halfway = side.clone();
    halfway.position.set(0, 0.165, 0);
    this.scene.add(halfway);
    const center = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.76, 48), lineMaterial);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.17;
    this.scene.add(center);

    for (const x of [-5.28, 5.28]) {
      const goal = new THREE.Group();
      for (const z of [-0.72, 0.72]) {
        const post = createBox(0.06, 0.72, 0.06, 0xe5fff3, { emissive: 0x8be0bd, emissiveIntensity: 0.22 });
        post.position.set(x, 0.48, z);
        goal.add(post);
      }
      const bar = createBox(0.06, 0.06, 1.5, 0xe5fff3, { emissive: 0x8be0bd, emissiveIntensity: 0.22 });
      bar.position.set(x, 0.83, 0);
      goal.add(bar);
      this.scene.add(goal);
    }
  }

  private createSeats() {
    const seatCount = TIERS.reduce(
      (total, tier) => total + SECTION_COUNT * tier.rows * tier.columns,
      0,
    );
    const cushionGeometry = new RoundedBoxGeometry(0.32, 0.12, 0.34, 3, 0.055);
    cushionGeometry.translate(0, 0.19, -0.07);
    const backGeometry = new RoundedBoxGeometry(0.34, 0.42, 0.11, 3, 0.055);
    backGeometry.translate(0, 0.42, 0.13);
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.06,
      roughness: 0.54,
    });
    this.seatCushions = new THREE.InstancedMesh(cushionGeometry, seatMaterial, seatCount);
    this.seatBacks = new THREE.InstancedMesh(backGeometry, seatMaterial.clone(), seatCount);
    this.seatCushions.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.seatBacks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    let index = 0;
    TIERS.forEach((tier, tierIndex) => {
      for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex += 1) {
        const section = 101 + sectionIndex;
        const centerTheta = (sectionIndex / SECTION_COUNT) * Math.PI * 2;
        const sectionSpan = (Math.PI * 2) / SECTION_COUNT;
        for (let rowIndex = 0; rowIndex < tier.rows; rowIndex += 1) {
          const radiusX = tier.baseRadiusX + rowIndex * tier.rowStep;
          const radiusZ = tier.baseRadiusZ + rowIndex * tier.rowStep * 0.72;
          for (let column = 0; column < tier.columns; column += 1) {
            const offset = ((column + 1) / (tier.columns + 1) - 0.5) * sectionSpan * 0.86;
            const theta = centerTheta + offset;
            const position = new THREE.Vector3(
              Math.cos(theta) * radiusX * 1.38,
              tier.yStart + rowIndex * tier.yStep,
              Math.sin(theta) * radiusZ,
            );
            const reservedSeed = index * 7 + sectionIndex * 19 + rowIndex * 31 + tierIndex * 43;
            const reserved = seeded(reservedSeed) < 0.245;
            const row = rowName(tierIndex, rowIndex);
            const seatNumber = column + 1;
            const record: SeatRecord = {
              id: `${section}-${row}-${String(seatNumber).padStart(2, '0')}`,
              index,
              label: `${section} · ${row}${seatNumber}`,
              lift: 0,
              position,
              price: tier.price,
              reserved,
              rotationY: Math.PI / 2 - theta,
              row,
              seat: seatNumber,
              section,
              selected: false,
              theta,
              tier: tier.name,
              tierIndex,
            };
            this.seats.push(record);
            this.applySeatMatrix(record, 0, tier.seatScale);
            const color = reserved ? RESERVED : AVAILABLE;
            this.seatCushions!.setColorAt(index, color);
            this.seatBacks!.setColorAt(index, color);
            index += 1;
          }
        }
      }
    });
    this.seatCushions.instanceMatrix.needsUpdate = true;
    this.seatBacks.instanceMatrix.needsUpdate = true;
    if (this.seatCushions.instanceColor) this.seatCushions.instanceColor.needsUpdate = true;
    if (this.seatBacks.instanceColor) this.seatBacks.instanceColor.needsUpdate = true;
    this.scene.add(this.seatCushions, this.seatBacks);
  }

  private applySeatMatrix(seat: SeatRecord, lift: number, scale: number) {
    if (!this.seatCushions || !this.seatBacks) return;
    const dummy = new THREE.Object3D();
    dummy.position.copy(seat.position);
    dummy.position.y += lift * 0.42;
    dummy.rotation.y = seat.rotationY;
    const pop = scale * (1 + lift * 0.18);
    dummy.scale.setScalar(pop);
    dummy.updateMatrix();
    this.seatCushions.setMatrixAt(seat.index, dummy.matrix);
    this.seatBacks.setMatrixAt(seat.index, dummy.matrix);
  }

  private createLightRig() {
    this.lightRig = new THREE.Group();
    for (let index = 0; index < 8; index += 1) {
      const theta = (index / 8) * Math.PI * 2;
      const light = new THREE.SpotLight(index % 2 === 0 ? 0x6effea : 0xb78aff, 76, 32, 0.29, 0.82, 1.25);
      light.position.set(Math.cos(theta) * 13.8, 11.5, Math.sin(theta) * 9.8);
      light.target.position.set(Math.cos(theta + 1.2) * 2.2, 0, Math.sin(theta + 1.2) * 1.1);
      this.lightRig.add(light, light.target);
      const lamp = createBox(0.42, 0.18, 0.28, 0x18252d, { emissive: index % 2 === 0 ? 0x23decf : 0x8758ff, emissiveIntensity: 2.2 });
      lamp.position.copy(light.position);
      this.lightRig.add(lamp);
    }
    this.scene.add(this.lightRig);

    const halo = new THREE.Group();
    for (const [radius, tube, color] of [
      [1.68, 0.065, 0x66f7e3],
      [1.34, 0.035, 0x9d7cff],
    ] as const) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 10, 72),
        new THREE.MeshBasicMaterial({ color, opacity: 0.84, transparent: true }),
      );
      ring.rotation.x = Math.PI / 2;
      halo.add(ring);
    }
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xc8fff5,
        emissive: 0x46ddcb,
        emissiveIntensity: 1.4,
        metalness: 0.24,
        roughness: 0.2,
      }),
    );
    halo.add(core);
    for (const x of [-1.25, 1.25]) {
      const cable = createBox(0.025, 3.4, 0.025, 0x51636b, { metalness: 0.8, roughness: 0.24 });
      cable.position.set(x, 1.72, 0);
      halo.add(cable);
    }
    halo.position.y = 9.1;
    this.scene.add(halo);
  }

  private createAtmosphere() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const theta = seeded(index * 3 + 1) * Math.PI * 2;
      const radius = 12 + seeded(index * 3 + 2) * 17;
      positions[index * 3] = Math.cos(theta) * radius * 1.32;
      positions[index * 3 + 1] = 3 + seeded(index * 3 + 3) * 15;
      positions[index * 3 + 2] = Math.sin(theta) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xa9fff1, opacity: 0.45, size: 0.045, transparent: true }),
    );
    this.scene.add(this.stars);
  }

  private updateCamera(immediate = false) {
    if (immediate) {
      this.cameraTheta = this.cameraThetaTarget;
      this.cameraPhi = this.cameraPhiTarget;
      this.cameraRadius = this.cameraRadiusTarget;
      this.cameraTarget.copy(this.cameraTargetGoal);
    }
    const sinPhi = Math.sin(this.cameraPhi);
    this.camera.position.set(
      this.cameraTarget.x + this.cameraRadius * sinPhi * Math.cos(this.cameraTheta),
      this.cameraTarget.y + this.cameraRadius * Math.cos(this.cameraPhi),
      this.cameraTarget.z + this.cameraRadius * sinPhi * Math.sin(this.cameraTheta),
    );
    this.camera.lookAt(this.cameraTarget);
  }

  private animate = (now: number) => {
    const delta = clamp((now - this.lastFrame) / 1000, 0, 0.05);
    this.lastFrame = now;
    const idle = now - this.lastInteraction > 4200;
    if (idle && !this.running) this.cameraThetaTarget += delta * 0.055;
    const ease = 1 - Math.exp(-delta * 4.8);
    this.cameraTheta += (this.cameraThetaTarget - this.cameraTheta) * ease;
    this.cameraPhi += (this.cameraPhiTarget - this.cameraPhi) * ease;
    this.cameraRadius += (this.cameraRadiusTarget - this.cameraRadius) * ease;
    this.cameraTarget.lerp(this.cameraTargetGoal, ease);
    this.updateCamera();

    let seatsChanged = false;
    this.seats.forEach((seat) => {
      const target = seat.selected ? 1 : 0;
      if (Math.abs(target - seat.lift) >= 0.002) {
        seat.lift += (target - seat.lift) * Math.min(1, delta * 11);
        const tier = TIERS[seat.tierIndex];
        this.applySeatMatrix(seat, seat.lift, tier.seatScale);
        const color = this.seatBaseColor(seat).lerp(SELECTED, seat.lift);
        this.seatCushions?.setColorAt(seat.index, color);
        this.seatBacks?.setColorAt(seat.index, color);
        seatsChanged = true;
      }
      const marker = this.selectionMarkers.get(seat.index);
      if (marker) {
        marker.visible = seat.lift > 0.01;
        marker.position.y = seat.position.y + 0.1 + seat.lift * 0.42;
        const pulse = 0.94 + Math.sin(now * 0.006) * 0.06;
        marker.scale.setScalar((0.55 + seat.lift * 0.55) * pulse);
        (marker.material as THREE.MeshBasicMaterial).opacity = seat.lift * 0.9;
      }
    });
    if (seatsChanged) {
      if (this.seatCushions) {
        this.seatCushions.instanceMatrix.needsUpdate = true;
        if (this.seatCushions.instanceColor) this.seatCushions.instanceColor.needsUpdate = true;
      }
      if (this.seatBacks) {
        this.seatBacks.instanceMatrix.needsUpdate = true;
        if (this.seatBacks.instanceColor) this.seatBacks.instanceColor.needsUpdate = true;
      }
    }

    if (this.lightRig) this.lightRig.rotation.y += delta * 0.055;
    if (this.stars) this.stars.rotation.y -= delta * 0.012;
    this.renderer?.render(this.scene, this.camera);
    this.context?.present();
    this.frame = requestAnimationFrame(this.animate);
  };
}
