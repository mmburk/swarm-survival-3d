import * as THREE from 'three';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { HEX } from '../theme/Palette';

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

/**
 * Street clutter: burnt-out cars, dead trees, sandbag lines and dumpsters.
 * Everything registers a collision circle so both the player and the horde
 * have to path around it — cover is what makes the arena readable.
 */
export class InstancedProps {
  public static obstacles: Obstacle[] = [];

  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;
  private terrain: TerrainGenerator;
  private root: THREE.Group;

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;
    this.root = new THREE.Group();
    InstancedProps.obstacles = [];

    this.createWrecks();
    this.createDeadTrees();
    this.createSandbags();
    this.createDumpsters();
    this.createDebris();

    this.scene.add(this.root);
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  private ring(i: number, count: number, min: number, span: number, jitter = 0.5) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * jitter;
    const dist = min + Math.random() * span;
    return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
  }

  /** Burnt-out sedans: body, roof and two axle blocks, all instanced. */
  private createWrecks(): void {
    const count = 14;

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

    for (let i = 0; i < count; i++) {
      const { x, z } = this.ring(i, count, 15, 36, 0.7);
      const y = this.terrain.getHeightAt(x, z);
      const rot = Math.random() * Math.PI * 2;

      InstancedProps.obstacles.push({ x, z, radius: 2.0 });

      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, rot, 0);

      this.dummy.position.set(x, y + 0.72, z);
      this.dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 1.55, z - Math.cos(rot) * 0.2);
      this.dummy.updateMatrix();
      roofMesh.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 0.28, z);
      this.dummy.updateMatrix();
      rustMesh.setMatrixAt(i, this.dummy.matrix);
    }

    for (const m of [bodyMesh, roofMesh, rustMesh]) {
      m.instanceMatrix.needsUpdate = true;
      this.root.add(m);
    }
  }

  /** Bare trunks with a couple of broken limbs — no foliage left anywhere. */
  private createDeadTrees(): void {
    const count = 22;

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 5.2, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x35291d, roughness: 1.0, metalness: 0.0, flatShading: true });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

    const limbGeo = new THREE.CylinderGeometry(0.09, 0.15, 2.4, 4);
    const limbMesh = new THREE.InstancedMesh(limbGeo, trunkMat, count * 2);

    trunkMesh.castShadow = true;
    limbMesh.castShadow = true;

    let limbIdx = 0;
    for (let i = 0; i < count; i++) {
      const { x, z } = this.ring(i, count, 13, 42, 0.9);
      const y = this.terrain.getHeightAt(x, z);

      InstancedProps.obstacles.push({ x, z, radius: 0.8 });

      this.dummy.scale.set(1, 0.8 + Math.random() * 0.5, 1);
      this.dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
      this.dummy.position.set(x, y + 2.4, z);
      this.dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, this.dummy.matrix);

      for (let l = 0; l < 2; l++) {
        const a = Math.random() * Math.PI * 2;
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.set(0, a, 0.9 + Math.random() * 0.5);
        this.dummy.position.set(x + Math.cos(a) * 0.7, y + 3.4 + l * 0.9, z + Math.sin(a) * 0.7);
        this.dummy.updateMatrix();
        limbMesh.setMatrixAt(limbIdx++, this.dummy.matrix);
      }
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    limbMesh.instanceMatrix.needsUpdate = true;
    this.root.add(trunkMesh);
    this.root.add(limbMesh);
  }

  /** Military checkpoint leftovers, stacked two high in short walls. */
  private createSandbags(): void {
    const walls = 9;
    const perWall = 6;
    const count = walls * perWall;

    const bagGeo = new THREE.BoxGeometry(0.95, 0.42, 0.62);
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x6b6248, roughness: 1.0, metalness: 0.0, flatShading: true });
    const bagMesh = new THREE.InstancedMesh(bagGeo, bagMat, count);
    bagMesh.castShadow = true;
    bagMesh.receiveShadow = true;

    let idx = 0;
    for (let w = 0; w < walls; w++) {
      const { x, z } = this.ring(w, walls, 18, 28, 0.8);
      const y = this.terrain.getHeightAt(x, z);
      const heading = Math.random() * Math.PI;
      const dx = Math.cos(heading);
      const dz = Math.sin(heading);

      InstancedProps.obstacles.push({ x, z, radius: 1.5 });

      for (let b = 0; b < perWall; b++) {
        const row = Math.floor(b / 3);
        const col = (b % 3) - 1 + (row === 1 ? 0.5 : 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.set(0, heading + (Math.random() - 0.5) * 0.12, 0);
        this.dummy.position.set(x + dx * col * 0.95, y + 0.22 + row * 0.42, z + dz * col * 0.95);
        this.dummy.updateMatrix();
        bagMesh.setMatrixAt(idx++, this.dummy.matrix);
      }
    }

    bagMesh.instanceMatrix.needsUpdate = true;
    this.root.add(bagMesh);
  }

  private createDumpsters(): void {
    const count = 11;
    const geo = new THREE.BoxGeometry(2.4, 1.5, 1.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 0.9, metalness: 0.4, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const lidGeo = new THREE.BoxGeometry(2.5, 0.16, 1.5);
    const lidMat = new THREE.MeshStandardMaterial({ color: HEX.rustDeep, roughness: 1.0, metalness: 0.2, flatShading: true });
    const lidMesh = new THREE.InstancedMesh(lidGeo, lidMat, count);
    lidMesh.castShadow = true;

    for (let i = 0; i < count; i++) {
      const { x, z } = this.ring(i, count, 20, 26, 0.6);
      const y = this.terrain.getHeightAt(x, z);
      const rot = Math.random() * Math.PI;

      InstancedProps.obstacles.push({ x, z, radius: 1.35 });

      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, rot, 0);
      this.dummy.position.set(x, y + 0.75, z);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 1.56, z);
      this.dummy.updateMatrix();
      lidMesh.setMatrixAt(i, this.dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    lidMesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
    this.root.add(lidMesh);
  }

  /** Small rubble that only exists to break up the ground plane. Non-solid. */
  private createDebris(): void {
    const count = 120;
    const geo = new THREE.BoxGeometry(0.5, 0.22, 0.44);
    const mat = new THREE.MeshStandardMaterial({ color: HEX.concrete, roughness: 1.0, metalness: 0.0, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.receiveShadow = true;

    for (let i = 0; i < count; i++) {
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
      mesh.setMatrixAt(i, this.dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
  }
}
