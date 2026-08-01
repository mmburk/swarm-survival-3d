import * as THREE from 'three';
import { PickupType } from '../entities/Pickup';
import { HEX } from '../theme/Palette';

/** Dropped loot: scrap nuts and bolts, field dressings, and stim shots. */
export class InstancedPickups {
  private scrapMesh: THREE.InstancedMesh;
  private bandageMesh: THREE.InstancedMesh;
  private stimMesh: THREE.InstancedMesh;

  private maxScrap = 140;
  private maxBandage = 40;
  private maxStim = 40;

  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const scrapGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const scrapMat = new THREE.MeshStandardMaterial({
      color: HEX.brass,
      roughness: 0.45,
      metalness: 0.85,
      flatShading: true
    });
    this.scrapMesh = new THREE.InstancedMesh(scrapGeo, scrapMat, this.maxScrap);
    this.scrapMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scrapMesh.frustumCulled = false;
    scene.add(this.scrapMesh);

    const bandageGeo = new THREE.BoxGeometry(0.44, 0.3, 0.44);
    const bandageMat = new THREE.MeshStandardMaterial({ color: 0xd8d2bd, roughness: 0.9, metalness: 0.0 });
    this.bandageMesh = new THREE.InstancedMesh(bandageGeo, bandageMat, this.maxBandage);
    this.bandageMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bandageMesh.frustumCulled = false;
    scene.add(this.bandageMesh);

    const stimGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.52, 6);
    const stimMat = new THREE.MeshStandardMaterial({
      color: HEX.amber,
      emissive: 0x3a2a08,
      roughness: 0.4,
      metalness: 0.3
    });
    this.stimMesh = new THREE.InstancedMesh(stimGeo, stimMat, this.maxStim);
    this.stimMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stimMesh.frustumCulled = false;
    scene.add(this.stimMesh);

    this.hideAll();
  }

  public hideAll(): void {
    this.scrapMesh.count = 0;
    this.bandageMesh.count = 0;
    this.stimMesh.count = 0;
    this.scrapMesh.instanceMatrix.needsUpdate = true;
    this.bandageMesh.instanceMatrix.needsUpdate = true;
    this.stimMesh.instanceMatrix.needsUpdate = true;
  }

  public render(pickups: Array<{ active: boolean; type: PickupType; position: THREE.Vector3 }>, time: number): void {
    let s = 0;
    let b = 0;
    let t = 0;

    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (!p.active) continue;

      const bob = Math.sin(time * 3.5 + i) * 0.09;
      this.dummy.position.set(p.position.x, p.position.y + 0.34 + bob, p.position.z);
      this.dummy.scale.set(1, 1, 1);

      if (p.type === PickupType.SCRAP && s < this.maxScrap) {
        this.dummy.rotation.set(time * 1.6 + i, time * 2.1 + i, 0);
        this.dummy.updateMatrix();
        this.scrapMesh.setMatrixAt(s++, this.dummy.matrix);
      } else if (p.type === PickupType.BANDAGE && b < this.maxBandage) {
        this.dummy.rotation.set(0, time * 1.1 + i, 0);
        this.dummy.updateMatrix();
        this.bandageMesh.setMatrixAt(b++, this.dummy.matrix);
      } else if (p.type === PickupType.STIM && t < this.maxStim) {
        this.dummy.rotation.set(0.4, time * 2.4 + i, 0);
        this.dummy.updateMatrix();
        this.stimMesh.setMatrixAt(t++, this.dummy.matrix);
      }
    }

    this.scrapMesh.count = s;
    this.bandageMesh.count = b;
    this.stimMesh.count = t;

    this.scrapMesh.instanceMatrix.needsUpdate = true;
    this.bandageMesh.instanceMatrix.needsUpdate = true;
    this.stimMesh.instanceMatrix.needsUpdate = true;
  }
}
