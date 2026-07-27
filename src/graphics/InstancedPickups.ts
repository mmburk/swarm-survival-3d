import * as THREE from 'three';
import { PickupType } from '../entities/Pickup';

export class InstancedPickups {
  private xpMesh: THREE.InstancedMesh;
  private healthMesh: THREE.InstancedMesh;
  private maxCapacity: number = 100;
  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // XP Orb Mesh: Glowing Cyan Octahedron
    const xpGeo = new THREE.OctahedronGeometry(0.35, 0);
    const xpMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      toneMapped: false
    });
    this.xpMesh = new THREE.InstancedMesh(xpGeo, xpMat, this.maxCapacity);
    this.xpMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.xpMesh.frustumCulled = false;
    this.scene.add(this.xpMesh);

    // Health Pack Mesh: Glowing Emerald Cube
    const healthGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const healthMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      toneMapped: false
    });
    this.healthMesh = new THREE.InstancedMesh(healthGeo, healthMat, 40);
    this.healthMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.healthMesh.frustumCulled = false;
    this.scene.add(this.healthMesh);

    this.hideAll();
  }

  public hideAll(): void {
    this.dummy.position.set(0, -9999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();

    for (let i = 0; i < this.maxCapacity; i++) {
      this.xpMesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < 40; i++) {
      this.healthMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.xpMesh.count = 0;
    this.healthMesh.count = 0;

    this.xpMesh.instanceMatrix.needsUpdate = true;
    this.healthMesh.instanceMatrix.needsUpdate = true;
  }

  public renderPickups(pickups: Array<{ active: boolean; type: PickupType; position: THREE.Vector3 }>, time: number): void {
    let xpIdx = 0;
    let healthIdx = 0;

    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (!p.active) continue;

      // Bobbing float motion and spinning animation
      const bobY = p.position.y + Math.sin(time * 4 + i) * 0.15;
      this.dummy.position.set(p.position.x, bobY, p.position.z);
      this.dummy.rotation.set(0, time * 2 + i, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();

      if (p.type === PickupType.XP_ORB && xpIdx < this.maxCapacity) {
        this.xpMesh.setMatrixAt(xpIdx++, this.dummy.matrix);
      } else if (p.type === PickupType.HEALTH_PACK && healthIdx < 40) {
        this.healthMesh.setMatrixAt(healthIdx++, this.dummy.matrix);
      }
    }

    this.xpMesh.count = xpIdx;
    this.healthMesh.count = healthIdx;

    this.xpMesh.instanceMatrix.needsUpdate = true;
    this.healthMesh.instanceMatrix.needsUpdate = true;
  }
}
