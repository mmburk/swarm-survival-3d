import * as THREE from 'three';
import { TerrainGenerator } from '../terrain/TerrainGenerator';

export class InstancedProps {
  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;
  private terrain: TerrainGenerator;

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;

    this.createCrystals();
    this.createPillars();
    this.createBarriers();
  }

  private createCrystals(): void {
    const count = 40;
    const geometry = new THREE.ConeGeometry(0.8, 3, 5);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aaaa,
      emissiveIntensity: 0.8,
      flatShading: true,
      roughness: 0.2,
      metalness: 0.9
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 32;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrain.getHeightAt(x, z) + 1.5;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.3
      );
      const scale = 0.7 + Math.random() * 0.8;
      this.dummy.scale.set(scale, scale * (1 + Math.random() * 0.5), scale);
      this.dummy.updateMatrix();

      instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedMesh);
  }

  private createPillars(): void {
    const count = 12;
    const geometry = new THREE.CylinderGeometry(1.2, 1.5, 8, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0x111e38,
      emissive: 0xff00aa,
      emissiveIntensity: 0.5,
      flatShading: true,
      roughness: 0.5,
      metalness: 0.8
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const dist = 35;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrain.getHeightAt(x, z) + 4;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(0, angle, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();

      instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedMesh);
  }

  private createBarriers(): void {
    const count = 25;
    const geometry = new THREE.DodecahedronGeometry(1.2, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a2636,
      flatShading: true,
      roughness: 0.9,
      metalness: 0.2
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 38;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.terrain.getHeightAt(x, z) + 0.8;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const scale = 0.8 + Math.random() * 0.9;
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();

      instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedMesh);
  }
}
