import {
  Body,
  Box,
  ContactMaterial,
  GSSolver,
  Material,
  SAPBroadphase,
  Vec3,
  World,
} from 'cannon-es';
import { PixelRatio } from 'react-native';
import type { CanvasRef, RNCanvasContext } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type TowerStatus = 'stable' | 'wobbling' | 'critical' | 'collapsed';

export type TowerSnapshot = {
  fallen: number;
  moves: number;
  score: number;
  stability: number;
  standing: number;
  status: TowerStatus;
};

export type TowerWorldEvents = {
  onCollapse: (snapshot: TowerSnapshot) => void;
  onImpact: (strength: number) => void;
  onInvalidPick: () => void;
  onPull: (score: number, layer: number) => void;
  onReady: () => void;
  onSnapshot: (snapshot: TowerSnapshot) => void;
};

type TowerBlock = {
  body: Body;
  extracted: boolean;
  fallen: boolean;
  id: number;
  layer: number;
};

type Pull = {
  block: TowerBlock;
  direction: Vec3;
  start: Vec3;
  startedAt: number;
};

const BLOCK_COUNT = 54;
const BLOCK_DEPTH = 0.9;
const BLOCK_HEIGHT = 0.62;
const BLOCK_LENGTH = 2.92;
const LAYER_STEP = 0.625;
const LAYERS = 18;
const PULL_DISTANCE = 4.15;
const PULL_DURATION = 780;
const WOOD_COLORS = [0xc88943, 0xd99c52, 0xe1ad66, 0xb87435, 0xce8d48, 0xefbc72];

const seeded = (seed: number) => {
  const value = Math.sin(seed * 925.913 + 17.31) * 43758.5453;
  return value - Math.floor(value);
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const createWoodTexture = () => {
  const width = 256;
  const height = 128;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const wave = Math.sin(x * 0.17 + Math.sin(y * 0.085) * 2.4) * 9;
      const fine = Math.sin(x * 0.51 + y * 0.035) * 3;
      const dx = (x - 174) / 34;
      const dy = (y - 46) / 20;
      const knotDistance = Math.sqrt(dx * dx + dy * dy);
      const knot = knotDistance < 1.35 ? Math.sin(knotDistance * 20) * 10 - (1.35 - knotDistance) * 17 : 0;
      const value = clamp(Math.round(231 + wave + fine + knot), 174, 255);
      data[index] = value;
      data[index + 1] = Math.round(value * 0.96);
      data[index + 2] = Math.round(value * 0.88);
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.45, 1);
  texture.needsUpdate = true;
  return texture;
};

export class TimberlineWorld {
  private ambient: THREE.HemisphereLight | null = null;
  private blocks: TowerBlock[] = [];
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90);
  private cameraPhi = 1.18;
  private cameraRadius = 18.5;
  private cameraTarget = new THREE.Vector3(0, 5.35, 0);
  private cameraTheta = 0.64;
  private collapsed = false;
  private collapseRiskStartedAt: number | null = null;
  private context: RNCanvasContext | null = null;
  private events: TowerWorldEvents;
  private frame = 0;
  private groundMaterial = new Material('stone');
  private impactCooldown = 0;
  private inputLockedUntil = 0;
  private lastFrame = 0;
  private lastSnapshotAt = 0;
  private lastSnapshotKey = '';
  private moves = 0;
  private needsRender = true;
  private pulls = new Map<number, Pull>();
  private raycaster = new THREE.Raycaster();
  private renderer: THREE.WebGPURenderer | null = null;
  private running = false;
  private score = 0;
  private scene = new THREE.Scene();
  private selected: THREE.LineSegments | null = null;
  private selectedBlock: TowerBlock | null = null;
  private towerMesh: THREE.InstancedMesh | null = null;
  private towerTexture: THREE.DataTexture | null = null;
  private towerMaterial = new Material('tower-wood');
  private smoothedStability = 100;
  private viewportHeight = 1;
  private viewportWidth = 1;
  private world = new World({ gravity: new Vec3(0, -9.82, 0) });

  constructor(events: TowerWorldEvents) {
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
    const renderScale = Math.min(PixelRatio.get(), 1.4);
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

    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.updateProjectionMatrix();
    this.configurePhysics();
    this.buildScene();
    this.reset();
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.animate);
    this.events.onReady();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.clearSelection();
    this.removeTower();
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
  }

  reset() {
    this.running = false;
    this.collapsed = false;
    this.collapseRiskStartedAt = null;
    this.moves = 0;
    this.inputLockedUntil = 0;
    this.score = 0;
    this.smoothedStability = 100;
    this.pulls.clear();
    this.clearSelection();
    this.removeTower();
    this.createTower();
    for (let step = 0; step < 72; step += 1) this.world.step(1 / 120);
    this.syncBlocks();
    this.blocks.forEach(({ body }) => body.sleep());
    this.cameraTheta = 0.64;
    this.cameraPhi = 1.18;
    this.cameraRadius = this.viewportHeight > this.viewportWidth ? 23.6 : 18.2;
    this.updateCamera();
    this.needsRender = true;
    this.emitSnapshot(performance.now(), true);
  }

  orbit(deltaX: number, deltaY: number) {
    this.cameraTheta -= deltaX * 0.006;
    this.cameraPhi = clamp(this.cameraPhi + deltaY * 0.0045, 0.74, 1.43);
    this.updateCamera();
    this.needsRender = true;
  }

  zoom(scaleDelta: number) {
    this.cameraRadius = clamp(this.cameraRadius / Math.max(scaleDelta, 0.05), 13.4, 26);
    this.updateCamera();
    this.needsRender = true;
  }

  nudge() {
    if (!this.running || this.collapsed) return;
    const direction = seeded(this.moves + performance.now()) > 0.5 ? 1 : -1;
    this.blocks.forEach((block) => {
      if (block.extracted || block.body.position.y < 3 || block.fallen) return;
      block.body.wakeUp();
      const heightFactor = clamp(block.body.position.y / 12, 0.25, 1);
      block.body.applyImpulse(new Vec3(0.065 * direction * heightFactor, 0, 0.022 * heightFactor));
    });
    this.needsRender = true;
    this.events.onImpact(0.48);
  }

  pickNormalized(x: number, y: number) {
    if (!this.running || this.collapsed) return;
    if (performance.now() < this.inputLockedUntil) return;
    if (!this.towerMesh || this.pulls.size > 0) return;
    const point = new THREE.Vector2(clamp(x, 0, 1) * 2 - 1, -clamp(y, 0, 1) * 2 + 1);
    this.raycaster.setFromCamera(point, this.camera);
    const hit = this.raycaster
      .intersectObject(this.towerMesh, false)
      .find((candidate) => Number.isInteger(candidate.instanceId));
    if (!hit) {
      this.clearSelection();
      return;
    }
    const block = this.blocks[Number(hit.instanceId)];
    if (!block || block.extracted || block.fallen || block.layer >= LAYERS - 2) {
      this.events.onInvalidPick();
      this.showSelection(block ?? null, 0xff6b4d);
      return;
    }
    this.pullBlock(block);
  }

  private configurePhysics() {
    this.world.allowSleep = true;
    this.world.broadphase = new SAPBroadphase(this.world);
    const solver = new GSSolver();
    solver.iterations = 12;
    solver.tolerance = 0.0006;
    this.world.solver = solver;
    this.world.defaultContactMaterial.friction = 0.46;
    this.world.defaultContactMaterial.restitution = 0;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;
    this.world.addContactMaterial(
      new ContactMaterial(this.towerMaterial, this.towerMaterial, {
        contactEquationRelaxation: 4,
        contactEquationStiffness: 1e7,
        friction: 0.46,
        frictionEquationRelaxation: 4,
        frictionEquationStiffness: 1e7,
        restitution: 0,
      }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(this.towerMaterial, this.groundMaterial, {
        friction: 0.62,
        restitution: 0.015,
      }),
    );
  }

  private removeTower() {
    this.blocks.forEach(({ body }) => {
      this.world.removeBody(body);
    });
    if (this.towerMesh) {
      this.scene.remove(this.towerMesh);
      this.towerMesh.geometry.dispose();
      if (Array.isArray(this.towerMesh.material)) {
        this.towerMesh.material.forEach((material) => material.dispose());
      } else {
        this.towerMesh.material.dispose();
      }
      this.towerMesh = null;
    }
    this.towerTexture?.dispose();
    this.towerTexture = null;
    this.blocks = [];
  }

  private buildScene() {
    this.scene.background = new THREE.Color(0x080706);
    this.scene.fog = new THREE.FogExp2(0x0b0908, 0.025);

    this.ambient = new THREE.HemisphereLight(0xffe4bd, 0x120d19, 1.45);
    this.scene.add(this.ambient);

    const key = new THREE.DirectionalLight(0xffd39b, 5.6);
    key.position.set(-7, 15, 8);
    this.scene.add(key);

    const rim = new THREE.PointLight(0xff5c35, 38, 24, 2);
    rim.position.set(7, 7, -7);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(24, 64),
      new THREE.MeshStandardMaterial({ color: 0x17100d, metalness: 0.08, roughness: 0.74 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.1, 5.16, 96),
      new THREE.MeshBasicMaterial({ color: 0x6d3421, opacity: 0.68, transparent: true }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.008;
    this.scene.add(ring);

    const ground = new Body({ mass: 0, material: this.groundMaterial });
    ground.addShape(new Box(new Vec3(24, 0.1, 24)));
    ground.position.set(0, -0.135, 0);
    this.world.addBody(ground);

    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 4 + seeded(i + 2) * 20;
      const angle = seeded(i + 33) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.6 + seeded(i + 81) * 15;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0xffc58d, opacity: 0.28, size: 0.032, transparent: true }),
    );
    dust.name = 'dust';
    this.scene.add(dust);
  }

  private createTower() {
    const geometry = new RoundedBoxGeometry(BLOCK_LENGTH, BLOCK_HEIGHT, BLOCK_DEPTH, 3, 0.07);
    this.towerTexture = createWoodTexture();
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.towerTexture,
      metalness: 0.015,
      roughness: 0.64,
    });
    this.towerMesh = new THREE.InstancedMesh(geometry, material, BLOCK_COUNT);
    this.towerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.towerMesh.frustumCulled = false;
    this.scene.add(this.towerMesh);

    for (let layer = 0; layer < LAYERS; layer += 1) {
      const yaw = layer % 2 === 0 ? 0 : Math.PI / 2;
      for (let slot = 0; slot < 3; slot += 1) {
        const id = layer * 3 + slot;
        const lateral = (slot - 1) * (BLOCK_DEPTH + 0.035);
        const x = layer % 2 === 0 ? 0 : lateral;
        const z = layer % 2 === 0 ? lateral : 0;
        const y = BLOCK_HEIGHT / 2 + layer * LAYER_STEP;
        this.towerMesh.setColorAt(id, new THREE.Color(WOOD_COLORS[Math.floor(seeded(id) * WOOD_COLORS.length)]));

        const body = new Body({
          angularDamping: 0.48,
          linearDamping: 0.2,
          mass: 0.46,
          material: this.towerMaterial,
          position: new Vec3(x, y, z),
          shape: new Box(new Vec3(BLOCK_LENGTH / 2 - 0.025, BLOCK_HEIGHT / 2, BLOCK_DEPTH / 2 - 0.02)),
        });
        body.quaternion.setFromEuler(0, yaw, 0);
        body.allowSleep = true;
        body.sleepSpeedLimit = 0.1;
        body.sleepTimeLimit = 0.5;
        body.addEventListener('collide', (event: { contact: { getImpactVelocityAlongNormal: () => number } }) => {
          const strength = Math.abs(event.contact.getImpactVelocityAlongNormal());
          const now = performance.now();
          if (strength > 1.25 && now > this.impactCooldown) {
            this.impactCooldown = now + 95;
            this.events.onImpact(clamp(strength / 8, 0.12, 1));
          }
        });
        this.world.addBody(body);
        this.blocks.push({ body, extracted: false, fallen: false, id, layer });
      }
    }
    if (this.towerMesh.instanceColor) this.towerMesh.instanceColor.needsUpdate = true;
    this.syncBlocks();
  }

  private pullBlock(block: TowerBlock) {
    this.inputLockedUntil = performance.now() + PULL_DURATION + 260;
    this.blocks.forEach((candidate) => {
      if (!candidate.extracted && candidate.layer >= block.layer) candidate.body.wakeUp();
    });
    const axis = block.body.quaternion.vmult(new Vec3(1, 0, 0));
    const towardCamera = new Vec3(
      this.camera.position.x - block.body.position.x,
      0,
      this.camera.position.z - block.body.position.z,
    );
    if (axis.dot(towardCamera) < 0) axis.scale(-1, axis);
    axis.normalize();
    block.extracted = true;
    block.body.type = Body.KINEMATIC;
    block.body.collisionResponse = false;
    block.body.updateMassProperties();
    block.body.velocity.set(0, 0, 0);
    block.body.angularVelocity.set(0, 0, 0);
    block.body.force.set(0, 0, 0);
    block.body.torque.set(0, 0, 0);
    this.moves += 1;
    const dangerBonus = Math.round((1 - block.layer / LAYERS) * 75);
    this.score += 100 + dangerBonus + Math.max(0, this.moves - 1) * 12;
    this.pulls.set(block.id, {
      block,
      direction: axis,
      start: block.body.position.clone(),
      startedAt: performance.now(),
    });
    this.showSelection(block, 0xffc15c);
    this.events.onPull(this.score, block.layer + 1);
  }

  private showSelection(block: TowerBlock | null, color: number) {
    this.clearSelection();
    if (!block) return;
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(BLOCK_LENGTH * 1.025, BLOCK_HEIGHT * 1.1, BLOCK_DEPTH * 1.08));
    this.selected = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color, opacity: 0.95, transparent: true }),
    );
    this.selected.name = 'selection';
    this.selectedBlock = block;
    this.scene.add(this.selected);
    this.syncSelection();
    this.needsRender = true;
  }

  private clearSelection() {
    if (!this.selected) return;
    this.selected.removeFromParent();
    this.selected.geometry.dispose();
    (this.selected.material as THREE.Material).dispose();
    this.selected = null;
    this.selectedBlock = null;
  }

  private syncSelection() {
    if (!this.selected || !this.selectedBlock) return;
    const { body } = this.selectedBlock;
    this.selected.position.set(body.position.x, body.position.y, body.position.z);
    this.selected.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w,
    );
  }

  private updateCamera() {
    const sinPhi = Math.sin(this.cameraPhi);
    this.camera.position.set(
      this.cameraTarget.x + this.cameraRadius * sinPhi * Math.sin(this.cameraTheta),
      this.cameraTarget.y + this.cameraRadius * Math.cos(this.cameraPhi),
      this.cameraTarget.z + this.cameraRadius * sinPhi * Math.cos(this.cameraTheta),
    );
    this.camera.lookAt(this.cameraTarget);
  }

  private animate = (now: number) => {
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    const physicsActive = this.pulls.size > 0 || this.world.hasActiveBodies;
    if ((this.running || this.collapsed) && physicsActive) {
      this.pulls.forEach((pull, id) => {
        const progress = clamp((now - pull.startedAt) / PULL_DURATION, 0, 1);
        if (progress < 1) {
          const eased = progress * progress * (3 - 2 * progress);
          const distance = eased * PULL_DISTANCE;
          pull.block.body.position.set(
            pull.start.x + pull.direction.x * distance,
            pull.start.y + 0.025 * Math.sin(progress * Math.PI),
            pull.start.z + pull.direction.z * distance,
          );
          pull.block.body.velocity.set(0, 0, 0);
          pull.block.body.aabbNeedsUpdate = true;
        } else {
          pull.block.body.type = Body.DYNAMIC;
          pull.block.body.collisionResponse = true;
          pull.block.body.updateMassProperties();
          pull.block.body.velocity.set(
            pull.direction.x * 0.38,
            0,
            pull.direction.z * 0.38,
          );
          pull.block.body.wakeUp();
          this.pulls.delete(id);
          this.clearSelection();
        }
      });
      this.world.step(1 / 90, delta, 3);
      this.syncBlocks();
      this.emitSnapshot(now);
      this.needsRender = true;
    }

    if (this.needsRender) {
      this.renderer?.render(this.scene, this.camera);
      this.context?.present();
      this.needsRender = false;
    }
    this.frame = requestAnimationFrame(this.animate);
  };

  private syncBlocks() {
    if (!this.towerMesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    this.blocks.forEach(({ body, id }) => {
      position.set(body.position.x, body.position.y, body.position.z);
      quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
      matrix.compose(position, quaternion, scale);
      this.towerMesh?.setMatrixAt(id, matrix);
    });
    this.towerMesh.instanceMatrix.needsUpdate = true;
    this.syncSelection();
  }

  private getSnapshot(now: number): TowerSnapshot {
    let motion = 0;
    let standing = 0;
    let fallen = 0;
    let lowerX = 0;
    let lowerZ = 0;
    let lowerCount = 0;
    let upperX = 0;
    let upperZ = 0;
    let upperCount = 0;
    let upperIntegrity = 0;
    const layerSupport = Array.from({ length: LAYERS }, () => 0);

    this.blocks.forEach((block) => {
      if (block.extracted) {
        block.fallen = false;
        return;
      }
      const up = block.body.quaternion.vmult(new Vec3(0, 1, 0));
      const distance = Math.hypot(block.body.position.x, block.body.position.z);
      const didFall = block.body.position.y < 0.22 || up.y < 0.48 || distance > 5.8;
      block.fallen = didFall;
      if (didFall) fallen += 1;
      else {
        standing += 1;
        layerSupport[block.layer] += 1;
      }
      motion += block.body.velocity.lengthSquared() + block.body.angularVelocity.lengthSquared() * 0.32;
      if (block.layer <= 3 && !didFall) {
        lowerX += block.body.position.x;
        lowerZ += block.body.position.z;
        lowerCount += 1;
      }
      if (block.layer >= 12) {
        upperX += block.body.position.x;
        upperZ += block.body.position.z;
        upperCount += 1;
        const minimumHeight = BLOCK_HEIGHT / 2 + block.layer * LAYER_STEP - 1.35;
        if (!didFall && block.body.position.y > minimumHeight) upperIntegrity += 1;
      }
    });

    const lowerCenterX = lowerCount ? lowerX / lowerCount : 0;
    const lowerCenterZ = lowerCount ? lowerZ / lowerCount : 0;
    const upperCenterX = upperCount ? upperX / upperCount : 0;
    const upperCenterZ = upperCount ? upperZ / upperCount : 0;
    const lean = Math.hypot(upperCenterX - lowerCenterX, upperCenterZ - lowerCenterZ);
    const activeBlockCount = Math.max(1, BLOCK_COUNT - this.moves);
    const normalizedMotion = Math.sqrt(motion / activeBlockCount);
    const weakLayers = layerSupport.slice(0, LAYERS - 2).filter((count) => count === 1).length;
    const disconnectedLayer = layerSupport
      .slice(0, LAYERS - 2)
      .some((count, layer) => count === 0 && layerSupport.slice(layer + 1).some((above) => above > 0));
    const rawStability = clamp(
      100 - lean * 38 - normalizedMotion * 7 - fallen * 5 - weakLayers * 6,
      0,
      100,
    );
    const smoothing = rawStability < this.smoothedStability ? 0.32 : 0.14;
    this.smoothedStability += (rawStability - this.smoothedStability) * smoothing;
    const stability = Math.round(this.smoothedStability);
    const upperIntegrityRatio = upperCount > 0 ? upperIntegrity / upperCount : 0;
    const structuralFailure =
      disconnectedLayer ||
      lean > 1.42 ||
      standing < 27 ||
      (upperCount >= 6 && upperIntegrityRatio < 0.56);
    if (structuralFailure) {
      this.collapseRiskStartedAt ??= now;
      if (!this.collapsed && this.running && now - this.collapseRiskStartedAt > 900) {
        this.collapsed = true;
      }
    } else {
      this.collapseRiskStartedAt = null;
    }
    const status: TowerStatus = this.collapsed
      ? 'collapsed'
      : stability < 36
        ? 'critical'
        : stability < 76 || normalizedMotion > 0.13
          ? 'wobbling'
          : 'stable';

    return { fallen, moves: this.moves, score: this.score, stability, standing, status };
  }

  private emitSnapshot(now: number, force = false) {
    if (!force && now - this.lastSnapshotAt < 220) return;
    this.lastSnapshotAt = now;
    const snapshot = this.getSnapshot(now);
    const snapshotKey = `${snapshot.standing}:${snapshot.fallen}:${snapshot.moves}:${snapshot.score}:${snapshot.status}:${Math.round(snapshot.stability / 3)}`;
    if (!force && snapshotKey === this.lastSnapshotKey) return;
    this.lastSnapshotKey = snapshotKey;
    this.events.onSnapshot(snapshot);
    if (this.collapsed && this.running) {
      this.running = false;
      this.events.onCollapse(snapshot);
    }
  }
}
