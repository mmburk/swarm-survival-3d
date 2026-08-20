import * as THREE from 'three';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { HEX } from '../theme/Palette';

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
  /**
   * How tall the thing standing here is. Collision does not care, but the
   * camera does: under a 33-degree rake anything above about two units can
   * come between the lens and the player, and the player has to stay visible
   * through it.
   */
  height?: number;
}

/**
 * Spots on the field that clutter is never allowed to land on, because
 * something else is guaranteed to be standing there.
 *
 * The scatter used to be rolled once at boot and then frozen for the whole
 * session, so these collisions could be — and were — checked by eye. Now that
 * every street re-rolls, they have to be stated.
 */
/** Instance counts. The meshes are sized from these once and never resized. */
const WRECKS = 14;
const TREES = 22;
const BAG_WALLS = 9;
const BAGS_PER_WALL = 6;
const BINS = 11;
const RUBBLE = 120;

const KEEP_CLEAR: readonly { x: number; z: number; r: number }[] = [
  // Where the player is set down at the mouth of every sector.
  { x: 0, z: 16, r: 6.5 },
  // Where the Behemoth comes up. It is 1.55 across and it does not path.
  { x: 0, z: -26, r: 10 }
];

/**
 * Street clutter: burnt-out cars, dead trees, sandbag lines and dumpsters.
 * Everything registers a collision circle so both the player and the horde
 * have to path around it — cover is what makes the arena readable.
 *
 * The meshes are built once; the *layout* is re-rolled for every sector by
 * `rebuild()`. Instance counts never change, so the re-roll writes into the
 * buffers that are already there and allocates nothing.
 */
export class InstancedProps {
  public static obstacles: Obstacle[] = [];

  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;
  private terrain: TerrainGenerator;
  private root: THREE.Group;

  private wreckBody!: THREE.InstancedMesh;
  private wreckRoof!: THREE.InstancedMesh;
  private wreckRust!: THREE.InstancedMesh;
  private trunks!: THREE.InstancedMesh;
  private limbs!: THREE.InstancedMesh;
  private bags!: THREE.InstancedMesh;
  private bins!: THREE.InstancedMesh;
  private binLids!: THREE.InstancedMesh;
  private rubble!: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;
    this.root = new THREE.Group();

    this.createWrecks();
    this.createDeadTrees();
    this.createSandbags();
    this.createDumpsters();
    this.createDebris();

    this.scene.add(this.root);
    this.rebuild();
  }

  /**
   * Re-rolls the whole street.
   *
   * Called at the darkest point of the sector fade, so the swap is never seen.
   * Before this existed the scatter was rolled once in the constructor and
   * never touched again: every sector of every run in a session stood on the
   * same fourteen wrecks, in the same fourteen places.
   */
  public rebuild(): void {
    InstancedProps.obstacles = [];
    this.scatterWrecks();
    this.scatterDeadTrees();
    this.scatterSandbags();
    this.scatterDumpsters();
    this.scatterDebris();
  }

  /** Whether a solid of this radius may stand here. */
  private clearOf(x: number, z: number, radius: number): boolean {
    for (const k of KEEP_CLEAR) {
      const dx = x - k.x;
      const dz = z - k.z;
      const min = k.r + radius;
      if (dx * dx + dz * dz < min * min) return false;
    }
    return true;
  }

  /**
   * Whether the field clutter is on screen. The obstacle list outlives the
   * field -- it is still populated while you are down in the shelter -- so
   * anything reading it for sightlines has to check this first.
   */
  public static visible: boolean = true;

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
    InstancedProps.visible = visible;
  }

  /**
   * A point on ring `i` of `count`, spread around the circle by index so the
   * clutter does not clump, jittered so it does not read as a ring.
   *
   * `solidRadius` is how wide the thing being placed is. Anything solid gets
   * up to twelve rolls to find a spot off the reserved ground, then walks
   * outwards along its own bearing until it is clear — which always
   * terminates, because the reserved circles do not reach the fence.
   */
  private ring(i: number, count: number, min: number, span: number, jitter = 0.5, solidRadius = 0) {
    const base = (i / count) * Math.PI * 2;
    let angle = base;
    let dist = min;

    for (let tries = 0; tries < 12; tries++) {
      angle = base + (Math.random() - 0.5) * jitter;
      dist = min + Math.random() * span;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (solidRadius <= 0 || this.clearOf(x, z, solidRadius)) return { x, z };
    }

    while (dist < 54 && !this.clearOf(Math.cos(angle) * dist, Math.sin(angle) * dist, solidRadius)) {
      dist += 1.5;
    }
    return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
  }

  /** Burnt-out sedans: body, roof and two axle blocks, all instanced. */
  private createWrecks(): void {
    const count = WRECKS;

    const bodyGeo = new THREE.BoxGeometry(2.1, 0.95, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a463d, roughness: 0.92, metalness: 0.35, flatShading: true });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, count);

    const roofGeo = new THREE.BoxGeometry(1.85, 0.8, 2.0);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x39352d, roughness: 0.95, metalness: 0.3, flatShading: true });
    const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, count);

    const rustGeo = new THREE.BoxGeometry(2.15, 0.3, 4.45);
    const rustMat = new THREE.MeshStandardMaterial({ color: HEX.rustDeep, roughness: 1.0, metalness: 0.1, flatShading: true });
    const rustMesh = new THREE.InstancedMesh(rustGeo, rustMat, count);

    for (const m of [bodyMesh, roofMesh, rustMesh]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }

    for (const m of [bodyMesh, roofMesh, rustMesh]) this.root.add(m);
    this.wreckBody = bodyMesh;
    this.wreckRoof = roofMesh;
    this.wreckRust = rustMesh;
  }

  private scatterWrecks(): void {
    for (let i = 0; i < WRECKS; i++) {
      const { x, z } = this.ring(i, WRECKS, 15, 36, 0.7, 2.0);
      const y = this.terrain.getHeightAt(x, z);
      const rot = Math.random() * Math.PI * 2;

      InstancedProps.obstacles.push({ x, z, radius: 2.0, height: 2.0 });

      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, rot, 0);

      this.dummy.position.set(x, y + 0.72, z);
      this.dummy.updateMatrix();
      this.wreckBody.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 1.55, z - Math.cos(rot) * 0.2);
      this.dummy.updateMatrix();
      this.wreckRoof.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 0.28, z);
      this.dummy.updateMatrix();
      this.wreckRust.setMatrixAt(i, this.dummy.matrix);
    }

    for (const m of [this.wreckBody, this.wreckRoof, this.wreckRust]) {
      m.instanceMatrix.needsUpdate = true;
    }
  }

  /** Bare trunks with a couple of broken limbs — no foliage left anywhere. */
  private createDeadTrees(): void {
    const count = TREES;

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 5.2, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x35291d, roughness: 1.0, metalness: 0.0, flatShading: true });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

    const limbGeo = new THREE.CylinderGeometry(0.09, 0.15, 2.4, 4);
    const limbMesh = new THREE.InstancedMesh(limbGeo, trunkMat, count * 2);

    trunkMesh.castShadow = true;
    limbMesh.castShadow = true;

    this.root.add(trunkMesh);
    this.root.add(limbMesh);
    this.trunks = trunkMesh;
    this.limbs = limbMesh;
  }

  private scatterDeadTrees(): void {
    let limbIdx = 0;
    for (let i = 0; i < TREES; i++) {
      const { x, z } = this.ring(i, TREES, 13, 42, 0.9, 0.8);
      const y = this.terrain.getHeightAt(x, z);

      InstancedProps.obstacles.push({ x, z, radius: 0.8, height: 6.4 });

      this.dummy.scale.set(1, 0.8 + Math.random() * 0.5, 1);
      this.dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
      this.dummy.position.set(x, y + 2.4, z);
      this.dummy.updateMatrix();
      this.trunks.setMatrixAt(i, this.dummy.matrix);

      for (let l = 0; l < 2; l++) {
        const a = Math.random() * Math.PI * 2;
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.set(0, a, 0.9 + Math.random() * 0.5);
        this.dummy.position.set(x + Math.cos(a) * 0.7, y + 3.4 + l * 0.9, z + Math.sin(a) * 0.7);
        this.dummy.updateMatrix();
        this.limbs.setMatrixAt(limbIdx++, this.dummy.matrix);
      }
    }

    this.trunks.instanceMatrix.needsUpdate = true;
    this.limbs.instanceMatrix.needsUpdate = true;
  }

  /** Military checkpoint leftovers, stacked two high in short walls. */
  private createSandbags(): void {
    const count = BAG_WALLS * BAGS_PER_WALL;

    const bagGeo = new THREE.BoxGeometry(0.95, 0.42, 0.62);
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x6b6248, roughness: 1.0, metalness: 0.0, flatShading: true });
    const bagMesh = new THREE.InstancedMesh(bagGeo, bagMat, count);
    bagMesh.castShadow = true;
    bagMesh.receiveShadow = true;

    this.root.add(bagMesh);
    this.bags = bagMesh;
  }

  private scatterSandbags(): void {
    let idx = 0;
    for (let w = 0; w < BAG_WALLS; w++) {
      const { x, z } = this.ring(w, BAG_WALLS, 18, 28, 0.8, 1.5);
      const y = this.terrain.getHeightAt(x, z);
      const heading = Math.random() * Math.PI;
      const dx = Math.cos(heading);
      const dz = Math.sin(heading);

      InstancedProps.obstacles.push({ x, z, radius: 1.5, height: 1.1 });

      for (let b = 0; b < BAGS_PER_WALL; b++) {
        const row = Math.floor(b / 3);
        const col = (b % 3) - 1 + (row === 1 ? 0.5 : 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.set(0, heading + (Math.random() - 0.5) * 0.12, 0);
        this.dummy.position.set(x + dx * col * 0.95, y + 0.22 + row * 0.42, z + dz * col * 0.95);
        this.dummy.updateMatrix();
        this.bags.setMatrixAt(idx++, this.dummy.matrix);
      }
    }

    this.bags.instanceMatrix.needsUpdate = true;
  }

  private createDumpsters(): void {
    const count = BINS;
    const geo = new THREE.BoxGeometry(2.4, 1.5, 1.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 0.9, metalness: 0.4, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const lidGeo = new THREE.BoxGeometry(2.5, 0.16, 1.5);
    const lidMat = new THREE.MeshStandardMaterial({ color: HEX.rustDeep, roughness: 1.0, metalness: 0.2, flatShading: true });
    const lidMesh = new THREE.InstancedMesh(lidGeo, lidMat, count);
    lidMesh.castShadow = true;

    this.root.add(mesh);
    this.root.add(lidMesh);
    this.bins = mesh;
    this.binLids = lidMesh;
  }

  private scatterDumpsters(): void {
    for (let i = 0; i < BINS; i++) {
      const { x, z } = this.ring(i, BINS, 20, 26, 0.6, 1.35);
      const y = this.terrain.getHeightAt(x, z);
      const rot = Math.random() * Math.PI;

      InstancedProps.obstacles.push({ x, z, radius: 1.35, height: 1.5 });

      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, rot, 0);
      this.dummy.position.set(x, y + 0.75, z);
      this.dummy.updateMatrix();
      this.bins.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 1.56, z);
      this.dummy.updateMatrix();
      this.binLids.setMatrixAt(i, this.dummy.matrix);
    }

    this.bins.instanceMatrix.needsUpdate = true;
    this.binLids.instanceMatrix.needsUpdate = true;
  }

  /** Small rubble that only exists to break up the ground plane. Non-solid. */
  private createDebris(): void {
    const count = RUBBLE;
    const geo = new THREE.BoxGeometry(0.5, 0.22, 0.44);
    const mat = new THREE.MeshStandardMaterial({ color: HEX.concrete, roughness: 1.0, metalness: 0.0, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.receiveShadow = true;

    this.root.add(mesh);
    this.rubble = mesh;
  }

  /** Rubble is not solid, so it is allowed to lie anywhere, reserved or not. */
  private scatterDebris(): void {
    for (let i = 0; i < RUBBLE; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 50;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrain.getHeightAt(x, z);

      const s = 0.6 + Math.random() * 1.5;
      this.dummy.scale.set(s, s, s);
      this.dummy.rotation.set(0, Math.random() * Math.PI, 0);
      this.dummy.position.set(x, y + 0.08, z);
      this.dummy.updateMatrix();
      this.rubble.setMatrixAt(i, this.dummy.matrix);
    }

    this.rubble.instanceMatrix.needsUpdate = true;
  }
}
