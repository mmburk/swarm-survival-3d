import * as THREE from 'three';
import { ProjectileType } from '../entities/Projectile';
import { HEX } from '../theme/Palette';

/**
 * Three instanced meshes, one per projectile family. Bullets are stretched
 * tracers, heavies are dark canisters, bile is a wet green blob.
 */
export class InstancedProjectiles {
  private bulletMesh: THREE.InstancedMesh;
  private heavyMesh: THREE.InstancedMesh;
  private bileMesh: THREE.InstancedMesh;

  private maxBullets: number = 220;
  private maxHeavy: number = 40;
  private maxBile: number = 110;

  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const bulletGeo = new THREE.CylinderGeometry(0.055, 0.03, 1.5, 5);
    bulletGeo.rotateX(Math.PI / 2);
    // Not toneMapped so the tracer keeps its hot core against dark asphalt.
    const bulletMat = new THREE.MeshBasicMaterial({ color: HEX.muzzle, toneMapped: false });
    this.bulletMesh = new THREE.InstancedMesh(bulletGeo, bulletMat, this.maxBullets);
    this.bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bulletMesh.frustumCulled = false;
    scene.add(this.bulletMesh);

    const heavyGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8);
    heavyGeo.rotateX(Math.PI / 2);
    const heavyMat = new THREE.MeshStandardMaterial({ color: 0x3d4034, roughness: 0.7, metalness: 0.5, flatShading: true });
    this.heavyMesh = new THREE.InstancedMesh(heavyGeo, heavyMat, this.maxHeavy);
    this.heavyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heavyMesh.frustumCulled = false;
    scene.add(this.heavyMesh);

    const bileGeo = new THREE.IcosahedronGeometry(0.34, 0);
    const bileMat = new THREE.MeshStandardMaterial({
      color: 0x7d8a3c,
      emissive: 0x2b3312,
      roughness: 0.35,
      flatShading: true
    });
    this.bileMesh = new THREE.InstancedMesh(bileGeo, bileMat, this.maxBile);
    this.bileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bileMesh.frustumCulled = false;
    scene.add(this.bileMesh);

    this.hideAll();
  }

  public hideAll(): void {
    this.bulletMesh.count = 0;
    this.heavyMesh.count = 0;
    this.bileMesh.count = 0;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.heavyMesh.instanceMatrix.needsUpdate = true;
    this.bileMesh.instanceMatrix.needsUpdate = true;
  }

  public render(
    projectiles: Array<{ active: boolean; type: ProjectileType; position: THREE.Vector3; quaternion: THREE.Quaternion }>,
    time: number
  ): void {
    let b = 0;
    let h = 0;
    let g = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p || !p.active) continue;

      this.dummy.position.copy(p.position);
      this.dummy.quaternion.copy(p.quaternion);
      this.dummy.scale.set(1, 1, 1);

      if (p.type === ProjectileType.PLAYER_BULLET && b < this.maxBullets) {
        this.dummy.updateMatrix();
        this.bulletMesh.setMatrixAt(b++, this.dummy.matrix);
      } else if (p.type === ProjectileType.PLAYER_HEAVY && h < this.maxHeavy) {
        this.dummy.rotation.z = time * 9;
        this.dummy.updateMatrix();
        this.heavyMesh.setMatrixAt(h++, this.dummy.matrix);
      } else if (p.type === ProjectileType.ENEMY_BILE && g < this.maxBile) {
        this.dummy.rotation.set(time * 3, time * 4, 0);
        this.dummy.updateMatrix();
        this.bileMesh.setMatrixAt(g++, this.dummy.matrix);
      }
    }

    this.bulletMesh.count = b;
    this.heavyMesh.count = h;
    this.bileMesh.count = g;

    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.heavyMesh.instanceMatrix.needsUpdate = true;
    this.bileMesh.instanceMatrix.needsUpdate = true;
  }
}
