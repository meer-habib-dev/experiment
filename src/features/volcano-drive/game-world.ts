import { PixelRatio } from 'react-native';
import type { CanvasRef, RNCanvasContext } from 'react-native-webgpu';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three/webgpu';

export type PickupKind = 'coin' | 'turbo' | 'magnet';

export type GameWorldEvents = {
  onCheckpoint: (level: number, bonus: number) => void;
  onCrashSettled: (score: number) => void;
  onCrashStart: (score: number) => void;
  onMagnetChange: (active: boolean) => void;
  onNearMiss: () => void;
  onPickup: (kind: PickupKind, value: number) => void;
  onScore: (score: number) => void;
  onTurboChange: (active: boolean) => void;
};

type TrafficCar = {
  baseX: number;
  mesh: THREE.Group;
  nearMissed: boolean;
  phase: number;
  speed: number;
  weave: number;
};

type Pickup = {
  kind: PickupKind;
  mesh: THREE.Group;
};

const ROAD_LENGTH = 12;
const ROAD_SEGMENTS = 11;
const ROAD_WIDTH = 10;
const PLAYER_Z = 5.2;
const BEST_SCORE = 570;
const PARTICLE_COUNT = 220;
const COLORS = {
  asphalt: 0x100e12,
  lane: 0xffe1c8,
  shoulder: 0xff997a,
  orange: 0xf06a18,
  orangeLight: 0xffa52b,
  lava: 0xff4b16,
  mountain: 0x160f14,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function createBox(
  width: number,
  height: number,
  depth: number,
  color: number,
  roughness = 0.72,
) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 }),
  );
}

function createCar(color: number, player = false) {
  const car = new THREE.Group();
  const body = createBox(1.35, 0.46, 2.35, color, 0.58);
  body.position.y = 0.42;
  car.add(body);

  const hood = createBox(1.18, 0.2, 0.72, color, 0.58);
  hood.position.set(0, 0.7, -0.73);
  car.add(hood);

  const cabin = createBox(0.92, 0.52, 1.02, color, 0.48);
  cabin.position.set(0, 0.88, 0.18);
  car.add(cabin);

  const glass = createBox(0.72, 0.025, 0.54, 0x14161d, 0.25);
  glass.position.set(0, 1.155, 0.08);
  car.add(glass);

  const rearGlass = createBox(0.74, 0.18, 0.05, 0x212630, 0.25);
  rearGlass.position.set(0, 0.94, 0.72);
  rearGlass.rotation.x = -0.35;
  car.add(rearGlass);

  for (const x of [-0.45, 0.45]) {
    const tail = createBox(0.28, 0.15, 0.07, 0xff172d, 0.2);
    tail.name = 'tail-light';
    tail.position.set(x, 0.48, 1.2);
    car.add(tail);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.42, transparent: true }),
  );
  shadow.name = 'car-shadow';
  shadow.position.set(0, -0.065, 0.12);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.72, 1.28, 1);
  car.add(shadow);

  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.9 });
  const tireGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.18, 12);
  for (const x of [-0.68, 0.68]) {
    for (const z of [-0.7, 0.72]) {
      const tire = new THREE.Mesh(tireGeometry, tireMaterial);
      tire.position.set(x, 0.28, z);
      tire.rotation.z = Math.PI / 2;
      car.add(tire);
    }
  }

  if (player) {
    const glow = new THREE.PointLight(0xff2514, 8, 7, 2);
    glow.position.set(0, 0.2, 1.75);
    car.add(glow);

    for (const x of [-0.38, 0.38]) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.85, 10),
        new THREE.MeshBasicMaterial({ color: 0xff6a14 }),
      );
      flame.name = 'turbo-flame';
      flame.position.set(x, 0.36, 1.66);
      flame.rotation.x = -Math.PI / 2;
      flame.visible = false;
      car.add(flame);
    }
  }

  return car;
}

function createCoin() {
  const group = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.16, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffcb22,
      emissive: 0x8a4600,
      emissiveIntensity: 0.42,
      metalness: 0.55,
      roughness: 0.28,
    }),
  );
  coin.rotation.x = Math.PI / 2;
  group.add(coin);
  const mark = createBox(0.08, 0.48, 0.18, 0xfff2a3, 0.25);
  mark.position.z = 0.09;
  group.add(mark);
  return group;
}

function createMagnet() {
  const group = new THREE.Group();
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.15, 10, 22, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xe91f45, roughness: 0.42 }),
  );
  arc.rotation.z = Math.PI;
  group.add(arc);
  for (const x of [-0.44, 0.44]) {
    const arm = createBox(0.3, 0.48, 0.26, x < 0 ? 0xe91f45 : 0xe91f45, 0.42);
    arm.position.set(x, -0.18, 0);
    group.add(arm);
    const cap = createBox(0.31, 0.16, 0.28, 0xe9edf5, 0.32);
    cap.position.set(x, -0.46, 0);
    group.add(cap);
  }
  return group;
}

function createTurbo() {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0.12, 0.72);
  shape.lineTo(-0.38, 0.02);
  shape.lineTo(-0.03, 0.02);
  shape.lineTo(-0.2, -0.72);
  shape.lineTo(0.48, 0.14);
  shape.lineTo(0.1, 0.14);
  shape.closePath();
  const bolt = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({
      color: 0xffe51f,
      emissive: 0xd97500,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    }),
  );
  group.add(bolt);
  return group;
}

function createCheckpoint() {
  const checkpoint = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb9232c, roughness: 0.72 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6eee2, roughness: 0.72 });
  for (const x of [-4.9, 4.9]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.1, 0.24), red);
    pole.position.set(x, 1.55, 0);
    checkpoint.add(pole);
  }
  for (let index = 0; index < 10; index += 1) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.46, 0.25),
      index % 2 === 0 ? white : red,
    );
    tile.position.set(-4.55 + index * 1.01, 3.05, 0);
    checkpoint.add(tile);
  }
  return checkpoint;
}

export class VolcanoDriveWorld {
  readonly bestScore = BEST_SCORE;

  private ash: THREE.Points | null = null;
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
  private cameraTarget = new THREE.Vector3(0, 0.42, -12);
  private checkpoint = createCheckpoint();
  private checkpointCount = 0;
  private context: RNCanvasContext | null = null;
  private crashSettled = false;
  private crashSide = 1;
  private crashStartedAt = 0;
  private currentSpeed = 0;
  private distanceScore = 0;
  private events: GameWorldEvents;
  private frame = 0;
  private level = 1;
  private magnetField = new THREE.Group();
  private magnetUntil = 0;
  private particleColors = new Float32Array(PARTICLE_COUNT * 3);
  private particleCursor = 0;
  private particleDrag = new Float32Array(PARTICLE_COUNT);
  private particleGeometry = new THREE.BufferGeometry();
  private particleGravity = new Float32Array(PARTICLE_COUNT);
  private particleLife = new Float32Array(PARTICLE_COUNT);
  private particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  private particles: THREE.Points | null = null;
  private particleVelocity = new Float32Array(PARTICLE_COUNT * 3);
  private pickups: Pickup[] = [];
  private player = createCar(COLORS.orange, true);
  private playerVelocityX = 0;
  private playerX = 0;
  private renderer: THREE.WebGPURenderer | null = null;
  private road: THREE.Group[] = [];
  private running = false;
  private scene = new THREE.Scene();
  private score = 0;
  private shake = 0;
  private steeringInput: SharedValue<number>;
  private traffic: TrafficCar[] = [];
  private turboUntil = 0;
  private wasMagnet = false;
  private wasTurbo = false;

  constructor(events: GameWorldEvents, steeringInput: SharedValue<number>) {
    this.events = events;
    this.steeringInput = steeringInput;
  }

  async initialize(canvasRef: CanvasRef, device: GPUDevice) {
    this.context = canvasRef.getContext('webgpu');
    if (!this.context) {
      throw new Error('WebGPU canvas context is unavailable.');
    }

    const canvas = this.context.canvas as HTMLCanvasElement;
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      throw new Error('WebGPU canvas has not been laid out yet.');
    }
    const renderScale = Math.min(PixelRatio.get(), 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * renderScale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * renderScale));
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
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.buildScene();
    this.animate(performance.now());
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.renderer?.dispose();
    this.renderer = null;
  }

  restart() {
    this.score = 0;
    this.distanceScore = 0;
    this.level = 1;
    this.checkpointCount = 0;
    this.turboUntil = 0;
    this.magnetUntil = 0;
    this.wasTurbo = false;
    this.wasMagnet = false;
    this.crashSettled = false;
    this.crashStartedAt = 0;
    this.currentSpeed = 0;
    this.shake = 0;
    this.playerX = 0;
    this.playerVelocityX = 0;
    this.steeringInput.value = 0;
    this.player.position.set(0, 0.08, PLAYER_Z);
    this.player.rotation.set(0, 0, 0);
    this.magnetField.visible = false;
    this.checkpoint.position.z = -68;
    this.traffic.forEach((car, index) => this.respawnCar(car, -30 - index * 12, index));
    this.pickups.forEach((pickup, index) => this.respawnPickup(pickup, -32 - index * 17));
    this.clearParticles();
    this.events.onScore(0);
    this.events.onMagnetChange(false);
    this.events.onTurboChange(false);
    this.running = true;
  }

  private buildScene() {
    this.scene.background = new THREE.Color(0x210b10);
    this.scene.fog = new THREE.FogExp2(0x210b10, 0.018);
    this.camera.position.set(0, 6.7, 12.5);
    this.camera.lookAt(0, 0.35, -12);

    const ambient = new THREE.HemisphereLight(0xffb19b, 0x12090e, 2.25);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd2b0, 3.8);
    key.position.set(-5, 12, 7);
    this.scene.add(key);

    this.buildBackdrop();
    this.buildRoad();
    this.player.position.set(0, 0.08, PLAYER_Z);
    this.scene.add(this.player);

    const magnetMaterial = new THREE.MeshBasicMaterial({
      color: 0x45f27b,
      opacity: 0.52,
      transparent: true,
    });
    for (const radius of [1.35, 1.8]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 8, 40), magnetMaterial);
      ring.rotation.x = Math.PI / 2;
      this.magnetField.add(ring);
    }
    this.magnetField.visible = false;
    this.scene.add(this.magnetField);
    this.buildParticleSystem();

    const trafficColors = [0xffe9ed, 0x42d878, 0x4cbef7, 0xef386d, 0xff493f, 0xe6e7d8];
    for (let index = 0; index < 10; index += 1) {
      const mesh = createCar(trafficColors[index % trafficColors.length]);
      mesh.scale.setScalar(0.9 + (index % 3) * 0.04);
      const car: TrafficCar = {
        baseX: 0,
        mesh,
        nearMissed: false,
        phase: index * 0.81,
        speed: 0,
        weave: 0,
      };
      this.respawnCar(car, -30 - index * 12, index);
      this.traffic.push(car);
      this.scene.add(mesh);
    }

    const kinds: PickupKind[] = ['turbo', 'coin', 'coin', 'magnet', 'coin', 'turbo'];
    kinds.forEach((kind, index) => {
      const mesh = kind === 'coin' ? createCoin() : kind === 'magnet' ? createMagnet() : createTurbo();
      mesh.scale.setScalar(kind === 'coin' ? 0.95 : 0.82);
      const pickup = { kind, mesh };
      this.respawnPickup(pickup, -29 - index * 18);
      this.pickups.push(pickup);
      this.scene.add(mesh);
    });

    this.checkpoint.position.set(0, 0, -68);
    this.scene.add(this.checkpoint);
  }

  private buildBackdrop() {
    const volcano = new THREE.Mesh(
      new THREE.ConeGeometry(14, 20, 5),
      new THREE.MeshStandardMaterial({ color: COLORS.mountain, roughness: 1 }),
    );
    volcano.position.set(0, 7.2, -87);
    volcano.rotation.y = 0.32;
    this.scene.add(volcano);

    const lava = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 2.2, 0.65, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.lava }),
    );
    lava.position.set(0, 17.1, -87);
    this.scene.add(lava);

    const ashPositions: number[] = [];
    const ashColors: number[] = [];
    const warm = new THREE.Color(0xff5b2e);
    const pale = new THREE.Color(0xd6b8ad);
    for (let index = 0; index < 210; index += 1) {
      ashPositions.push((Math.random() - 0.5) * 46, Math.random() * 29, -15 - Math.random() * 90);
      const color = Math.random() > 0.82 ? warm : pale;
      ashColors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(ashPositions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(ashColors, 3));
    this.ash = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.72 }),
    );
    this.scene.add(this.ash);

    for (const side of [-1, 1]) {
      for (let index = 0; index < 5; index += 1) {
        const ridge = new THREE.Mesh(
          new THREE.ConeGeometry(7 + index * 1.4, 10 + index * 2, 5),
          new THREE.MeshStandardMaterial({ color: 0x160d12, roughness: 1 }),
        );
        ridge.position.set(side * (10 + index * 8), 3, -28 - index * 13);
        this.scene.add(ridge);
      }
    }
  }

  private buildRoad() {
    const asphaltMaterial = new THREE.MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.96 });
    const laneMaterial = new THREE.MeshBasicMaterial({ color: COLORS.lane });
    const shoulderMaterial = new THREE.MeshBasicMaterial({ color: COLORS.shoulder });
    const reflectorGeometry = new THREE.BoxGeometry(0.1, 0.18, 0.42);
    const reflectorMaterial = new THREE.MeshBasicMaterial({ color: 0xff6e43 });

    for (let index = 0; index < ROAD_SEGMENTS; index += 1) {
      const segment = new THREE.Group();
      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH), asphaltMaterial);
      road.rotation.x = -Math.PI / 2;
      segment.add(road);

      for (const x of [-ROAD_WIDTH / 2 - 0.18, ROAD_WIDTH / 2 + 0.18]) {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, ROAD_LENGTH), shoulderMaterial);
        shoulder.position.set(x, 0.025, 0);
        segment.add(shoulder);
      }

      for (const x of [-1.67, 1.67]) {
        for (const z of [-4.4, -1.4, 1.6, 4.6]) {
          const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 1.45), laneMaterial);
          dash.position.set(x, 0.035, z);
          segment.add(dash);
        }
      }

      for (const x of [-5.42, 5.42]) {
        for (const z of [-4, 0, 4]) {
          const reflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
          reflector.position.set(x, 0.11, z);
          segment.add(reflector);
        }
      }

      segment.position.z = 9 - index * ROAD_LENGTH;
      this.road.push(segment);
      this.scene.add(segment);
    }
  }

  private buildParticleSystem() {
    this.clearParticles();
    const positions = new THREE.BufferAttribute(this.particlePositions, 3);
    const colors = new THREE.BufferAttribute(this.particleColors, 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    colors.setUsage(THREE.DynamicDrawUsage);
    this.particleGeometry.setAttribute('position', positions);
    this.particleGeometry.setAttribute('color', colors);
    this.particles = new THREE.Points(
      this.particleGeometry,
      new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.94,
        size: 0.18,
        sizeAttenuation: true,
        transparent: true,
        vertexColors: true,
      }),
    );
    this.scene.add(this.particles);
  }

  private clearParticles() {
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      this.particleLife[index] = 0;
      this.particlePositions[index * 3 + 1] = -100;
    }
    const position = this.particleGeometry.getAttribute('position');
    if (position) position.needsUpdate = true;
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    colorValue: number,
    count: number,
    force: number,
    gravity: number,
    life: number,
  ) {
    const color = new THREE.Color(colorValue);
    for (let item = 0; item < count; item += 1) {
      const index = this.particleCursor;
      const offset = index * 3;
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_COUNT;
      this.particlePositions[offset] = x + (Math.random() - 0.5) * 0.3;
      this.particlePositions[offset + 1] = y + (Math.random() - 0.5) * 0.18;
      this.particlePositions[offset + 2] = z + (Math.random() - 0.5) * 0.28;
      this.particleVelocity[offset] = (Math.random() - 0.5) * force;
      this.particleVelocity[offset + 1] = (0.28 + Math.random() * 0.72) * force;
      this.particleVelocity[offset + 2] = (Math.random() - 0.5) * force * 0.8;
      this.particleColors[offset] = color.r;
      this.particleColors[offset + 1] = color.g;
      this.particleColors[offset + 2] = color.b;
      this.particleGravity[index] = gravity;
      this.particleDrag[index] = 0.8 + Math.random() * 1.8;
      this.particleLife[index] = life * (0.65 + Math.random() * 0.55);
    }
  }

  private updateParticles(delta: number) {
    let changed = false;
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      if (this.particleLife[index] <= 0) continue;
      changed = true;
      this.particleLife[index] -= delta;
      const offset = index * 3;
      if (this.particleLife[index] <= 0) {
        this.particlePositions[offset + 1] = -100;
        continue;
      }
      const damping = Math.max(0, 1 - this.particleDrag[index] * delta);
      this.particleVelocity[offset] *= damping;
      this.particleVelocity[offset + 1] =
        this.particleVelocity[offset + 1] * damping - this.particleGravity[index] * delta;
      this.particleVelocity[offset + 2] *= damping;
      this.particlePositions[offset] += this.particleVelocity[offset] * delta;
      this.particlePositions[offset + 1] += this.particleVelocity[offset + 1] * delta;
      this.particlePositions[offset + 2] += this.particleVelocity[offset + 2] * delta;
    }
    if (changed) {
      this.particleGeometry.getAttribute('position').needsUpdate = true;
      this.particleGeometry.getAttribute('color').needsUpdate = true;
    }
  }

  private animate = (now: number) => {
    const previous = Number(this.scene.userData.previousTime ?? now);
    const delta = Math.min((now - previous) / 1000, 0.05);
    this.scene.userData.previousTime = now;
    this.update(delta, now);
    this.renderer?.render(this.scene, this.camera);
    this.context?.present();
    this.frame = requestAnimationFrame(this.animate);
  };

  private update(delta: number, now: number) {
    const turbo = this.running && now < this.turboUntil;
    const magnet = this.running && now < this.magnetUntil;
    const baseSpeed = 15.5 + (this.level - 1) * 2.15;
    const crashElapsed = this.crashStartedAt > 0 ? (now - this.crashStartedAt) / 1000 : 0;
    const targetSpeed = this.running
      ? baseSpeed * (turbo ? 1.5 : 1)
      : this.crashStartedAt > 0
        ? Math.max(0.7, baseSpeed * Math.exp(-crashElapsed * 2.8))
        : 1.7;
    this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1, delta * (turbo ? 6 : 3.4));

    if (turbo !== this.wasTurbo) {
      this.wasTurbo = turbo;
      this.events.onTurboChange(turbo);
      if (turbo) {
        this.shake = Math.max(this.shake, 0.42);
        this.spawnBurst(this.playerX, 0.35, PLAYER_Z + 1.5, 0xff8a17, 34, 3.4, 0.4, 0.75);
      }
      this.player.children.forEach((child) => {
        if (child.name === 'turbo-flame') child.visible = turbo;
      });
    }

    if (magnet !== this.wasMagnet) {
      this.wasMagnet = magnet;
      this.events.onMagnetChange(magnet);
      if (magnet) this.spawnBurst(this.playerX, 0.45, PLAYER_Z, 0x52f78a, 28, 2.6, 0.2, 0.9);
    }

    this.road.forEach((segment) => {
      segment.position.z += this.currentSpeed * delta;
      if (segment.position.z > 15) segment.position.z -= ROAD_SEGMENTS * ROAD_LENGTH;
    });

    if (this.ash) this.ash.rotation.y += delta * (turbo ? 0.045 : 0.014);

    const steering = clamp(this.steeringInput.value, -1, 1);
    if (this.running) {
      const targetX = steering * 3.62;
      const acceleration = (targetX - this.playerX) * 46 - this.playerVelocityX * 11.5;
      this.playerVelocityX += acceleration * delta;
      this.playerX = clamp(this.playerX + this.playerVelocityX * delta, -3.72, 3.72);
      if (Math.abs(this.playerVelocityX) > 1.45 && Math.random() > 0.58) {
        this.spawnBurst(this.playerX, 0.08, PLAYER_Z + 1.05, 0xff845f, 1, 0.65, -0.15, 0.42);
      }
    } else if (this.crashStartedAt === 0) {
      this.playerVelocityX *= Math.max(0, 1 - delta * 8);
    }

    if (this.crashStartedAt > 0) {
      this.player.position.x += this.crashSide * delta * 1.8;
      this.player.position.z += delta * 2.15;
      this.player.position.y = 0.09 + Math.sin(Math.min(crashElapsed, 0.7) * Math.PI / 0.7) * 0.55;
      this.player.rotation.y += this.crashSide * delta * 4.6;
      this.player.rotation.z += this.crashSide * delta * 1.65;
      this.player.rotation.x += delta * 1.2;
      if (!this.crashSettled && crashElapsed > 1.08) {
        this.crashSettled = true;
        this.events.onCrashSettled(this.score);
      }
    } else {
      this.player.position.x = this.playerX;
      this.player.position.y = 0.09 + Math.sin(now * 0.009) * (turbo ? 0.045 : 0.024);
      this.player.rotation.z +=
        (clamp(-this.playerVelocityX * 0.055, -0.28, 0.28) - this.player.rotation.z) *
        Math.min(1, delta * 10.5);
      this.player.rotation.y +=
        (clamp(-steering * 0.13, -0.14, 0.14) - this.player.rotation.y) * Math.min(1, delta * 9);
    }

    this.player.children.forEach((child) => {
      if (child.name === 'turbo-flame' && turbo) {
        const pulse = 0.78 + Math.sin(now * 0.038 + child.id) * 0.22;
        child.scale.set(0.82 + pulse * 0.28, 0.82 + pulse * 0.28, 1.15 + pulse * 0.5);
      }
    });
    if (turbo && Math.random() > 0.34) {
      this.spawnBurst(this.playerX, 0.34, PLAYER_Z + 1.65, 0xff5a13, 2, 1.1, -0.5, 0.48);
    }

    this.magnetField.visible = magnet;
    if (magnet) {
      this.magnetField.position.set(this.playerX, 0.16, PLAYER_Z);
      this.magnetField.rotation.y += delta * 1.8;
      const magnetPulse = 1 + Math.sin(now * 0.008) * 0.08;
      this.magnetField.scale.setScalar(magnetPulse);
    }

    this.traffic.forEach((car, index) => {
      const previousZ = car.mesh.position.z;
      car.mesh.position.z += (this.currentSpeed - car.speed) * delta;
      car.mesh.position.x = car.baseX + Math.sin(now * 0.00085 + car.phase) * car.weave;
      car.mesh.rotation.z = Math.cos(now * 0.00085 + car.phase) * car.weave * 0.045;
      if (car.mesh.position.z > 14) this.respawnCar(car, -92 - Math.random() * 45, index);

      if (this.running && previousZ <= PLAYER_Z + 1.35 && car.mesh.position.z >= PLAYER_Z - 1.35) {
        const lateralGap = Math.abs(car.mesh.position.x - this.playerX);
        if (lateralGap < 1.02) {
          this.crash(now, car);
        } else if (!car.nearMissed && lateralGap < 1.72) {
          car.nearMissed = true;
          this.distanceScore += 5;
          this.shake = Math.max(this.shake, 0.16);
          this.events.onNearMiss();
        }
      }
    });

    this.pickups.forEach((pickup) => {
      pickup.mesh.position.z += this.currentSpeed * delta;
      pickup.mesh.rotation.y += delta * (turbo ? 4.5 : 2.7);
      pickup.mesh.position.y = 1.05 + Math.sin(now * 0.004 + pickup.mesh.id) * 0.16;

      if (magnet && pickup.kind === 'coin' && pickup.mesh.position.z > -28) {
        const pull = Math.min(1, delta * (5.5 + Math.max(0, pickup.mesh.position.z) * 0.2));
        pickup.mesh.position.x += (this.playerX - pickup.mesh.position.x) * pull;
        pickup.mesh.position.y += (0.72 - pickup.mesh.position.y) * pull;
      }
      if (pickup.mesh.position.z > 13) this.respawnPickup(pickup, -88 - Math.random() * 45);
      if (
        this.running &&
        Math.abs(pickup.mesh.position.z - PLAYER_Z) < 1.4 &&
        Math.abs(pickup.mesh.position.x - this.playerX) < 1.15
      ) {
        this.collectPickup(pickup, now);
      }
    });

    const checkpointPreviousZ = this.checkpoint.position.z;
    this.checkpoint.position.z += this.currentSpeed * delta;
    if (this.running && checkpointPreviousZ <= PLAYER_Z && this.checkpoint.position.z >= PLAYER_Z) {
      this.passCheckpoint(now);
    }
    if (this.checkpoint.position.z > 16) {
      this.checkpoint.position.z = -98 - this.level * 7;
    }

    if (this.running) {
      this.distanceScore += delta * (turbo ? 17 : 8.8);
      const nextScore = Math.floor(this.distanceScore / 5) * 5;
      if (nextScore !== this.score) {
        this.score = nextScore;
        this.events.onScore(this.score);
      }
    }

    this.shake *= Math.exp(-delta * 5.2);
    const cameraShake = this.shake + (turbo ? 0.055 : 0);
    const cameraX = this.player.position.x * 0.16 + Math.sin(now * 0.071) * cameraShake;
    const cameraY = 6.7 + Math.cos(now * 0.089) * cameraShake * 0.45;
    this.camera.position.x += (cameraX - this.camera.position.x) * Math.min(1, delta * 5.5);
    this.camera.position.y += (cameraY - this.camera.position.y) * Math.min(1, delta * 5.5);
    this.camera.position.z = 12.5 + (turbo ? 0.52 : 0) + Math.sin(now * 0.053) * cameraShake * 0.25;
    this.cameraTarget.set(this.player.position.x * 0.08, 0.42, -12 - (turbo ? 4 : 0));
    this.camera.lookAt(this.cameraTarget);
    const targetFov = 58 + (this.level - 1) * 0.55 + (turbo ? 9 : 0) + (this.crashStartedAt > 0 ? 4 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 6);
      this.camera.updateProjectionMatrix();
    }
    this.updateParticles(delta);
  }

  private collectPickup(pickup: Pickup, now: number) {
    const pickupX = pickup.mesh.position.x;
    const pickupY = pickup.mesh.position.y;
    const pickupZ = pickup.mesh.position.z;
    let value = 0;
    if (pickup.kind === 'coin') {
      value = this.wasTurbo ? 10 : 5;
      this.distanceScore += value;
      this.spawnBurst(pickupX, pickupY, pickupZ, 0xffd238, 18, 2.25, 3.1, 0.68);
    } else if (pickup.kind === 'turbo') {
      this.turboUntil = now + 5600;
      this.spawnBurst(pickupX, pickupY, pickupZ, 0xff8b19, 38, 3.8, 1.4, 0.9);
    } else {
      this.magnetUntil = now + 6200;
      this.spawnBurst(pickupX, pickupY, pickupZ, 0x42f47b, 32, 3.1, 0.7, 0.92);
    }
    this.events.onPickup(pickup.kind, value);
    this.respawnPickup(pickup, -88 - Math.random() * 42);
  }

  private passCheckpoint(now: number) {
    const bonus = 65;
    this.checkpointCount += 1;
    this.level += 1;
    this.distanceScore += bonus;
    this.turboUntil = Math.max(this.turboUntil, now + 2200);
    this.shake = Math.max(this.shake, 0.48);
    const confettiColors = [0xff3b68, 0x22db79, 0x38a9ff, 0xffd42a, 0xff7338];
    confettiColors.forEach((color, index) => {
      this.spawnBurst((index - 2) * 1.5, 2.3, PLAYER_Z - 1.5, color, 15, 5.2, 4.2, 1.45);
    });
    this.events.onCheckpoint(this.level, bonus);
    this.checkpoint.position.z = -104 - this.checkpointCount * 8;
  }

  private crash(now: number, car: TrafficCar) {
    if (!this.running) return;
    this.running = false;
    this.steeringInput.value = 0;
    this.crashStartedAt = now;
    this.crashSide = this.playerX >= car.mesh.position.x ? 1 : -1;
    this.shake = 1.65;
    car.mesh.rotation.y += this.crashSide * 0.72;
    car.mesh.rotation.z -= this.crashSide * 0.28;
    const impactX = (this.playerX + car.mesh.position.x) * 0.5;
    this.spawnBurst(impactX, 0.52, PLAYER_Z - 0.35, 0xffcf52, 68, 6.4, 6.8, 1.05);
    this.spawnBurst(impactX, 0.48, PLAYER_Z - 0.35, 0xff3b14, 34, 4.8, 4.4, 0.86);
    this.events.onCrashStart(this.score);
  }

  private respawnCar(car: TrafficCar, z: number, index = -1) {
    const lanes = [-3.05, 0, 3.05];
    const safeOpening = [-3.05, 3.05, -3.05, 0, 3.05, 0, -3.05, 3.05, 0, -3.05];
    car.baseX =
      index >= 0 && this.score === 0
        ? safeOpening[index % safeOpening.length]
        : lanes[Math.floor(Math.random() * lanes.length)];
    car.mesh.position.set(car.baseX, 0.08, z);
    car.mesh.rotation.set(0, Math.random() * 0.08 - 0.04, 0);
    car.nearMissed = false;
    car.phase = Math.random() * Math.PI * 2;
    car.speed = 4.8 + Math.random() * 6.2;
    car.weave = Math.random() > 0.46 ? 0.12 + Math.random() * 0.24 : 0;
  }

  private respawnPickup(pickup: Pickup, z: number) {
    const lanes = [-3.05, 0, 3.05];
    pickup.mesh.position.set(lanes[Math.floor(Math.random() * lanes.length)], 1.05, z);
  }
}
