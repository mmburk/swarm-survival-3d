import * as THREE from 'three';
import { ProjectileType } from '../entities/Projectile';

export class InstancedProjectiles {
  private laserMesh: THREE.InstancedMesh;
  private missileMesh: THREE.InstancedMesh;
  private enemyPlasmaMesh: THREE.InstancedMesh;

  private maxCapacity: number = 200;
  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const laserGeo = new THREE.CylinderGeometry(0.25, 0.25, 2.5, 8);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      toneMapped: false
    });
    this.laserMesh = new THREE.InstancedMesh(laserGeo, laserMat, this.maxCapacity);
    this.laserMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.laserMesh.frustumCulled = false;
    this.scene.add(this.laserMesh);

    const missileGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const missileMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      toneMapped: false
    });
    this.missileMesh = new THREE.InstancedMesh(missileGeo, missileMat, 40);
    this.missileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.missileMesh.frustumCulled = false;
    this.scene.add(this.missileMesh);

    const plasmaGeo = new THREE.SphereGeometry(0.5, 10, 10);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      toneMapped: false
    });
    this.enemyPlasmaMesh = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 100);
    this.enemyPlasmaMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyPlasmaMesh.frustumCulled = false;
    this.scene.add(this.enemyPlasmaMesh);

    this.hideAll();
  }

  public hideAll(): void {
    this.laserMesh.count = 0;
    this.missileMesh.count = 0;
    this.enemyPlasmaMesh.count = 0;

    this.laserMesh.instanceMatrix.needsUpdate = true;
    this.missileMesh.instanceMatrix.needsUpdate = true;
    this.enemyPlasmaMesh.instanceMatrix.needsUpdate = true;
  }

  public renderProjectiles(projectiles: Array<{
    active: boolean;
    type: ProjectileType;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  }>): void {
    let laserIdx = 0;
    let missileIdx = 0;
    let plasmaIdx = 0;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p || !p.active) continue;

      this.dummy.position.copy(p.position);
      this.dummy.quaternion.copy(p.quaternion);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();

      if (p.type === ProjectileType.PLAYER_LASER && laserIdx < this.maxCapacity) {
        this.laserMesh.setMatrixAt(laserIdx++, this.dummy.matrix);
      } else if (p.type === ProjectileType.PLAYER_MISSILE && missileIdx < 40) {
        this.missileMesh.setMatrixAt(missileIdx++, this.dummy.matrix);
      } else if (p.type === ProjectileType.ENEMY_PLASMA && plasmaIdx < 100) {
        this.enemyPlasmaMesh.setMatrixAt(plasmaIdx++, this.dummy.matrix);
      }
    }

    this.laserMesh.count = laserIdx;
    this.missileMesh.count = missileIdx;
    this.enemyPlasmaMesh.count = plasmaIdx;

    if (laserIdx > 0) this.laserMesh.instanceMatrix.needsUpdate = true;
    if (missileIdx > 0) this.missileMesh.instanceMatrix.needsUpdate = true;
    if (plasmaIdx > 0) this.enemyPlasmaMesh.instanceMatrix.needsUpdate = true;
  }
}
