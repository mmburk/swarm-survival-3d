import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { SpatialHashGrid } from '../utils/SpatialHashGrid';

export const EnemyType = {
  RUNNER: 'RUNNER', // Zombie Runner
  SPITTER: 'SPITTER', // Zombie Walker / Spitter
  BRUTE: 'BRUTE' // Zombie Tank
} as const;

export type EnemyType = typeof EnemyType[keyof typeof EnemyType];

const tempSteerDir = new THREE.Vector3();
const tempTargetPos = new THREE.Vector3();
const tempAvoidForce = new THREE.Vector3();

export class Enemy implements IPoolable {
  public active: boolean = false;
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 0.9;
  public type: EnemyType = EnemyType.RUNNER;
  public id: number = 0;

  public health: number = 50;
  public maxHealth: number = 50;
  public moveSpeed: number = 12;
  public scoreValue: number = 100;

  private attackTimer: number = 0;
  private hitFlashTimer: number = 0;

  private mat!: THREE.MeshStandardMaterial;

  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private terrain: TerrainGenerator;

  constructor(
    scene: THREE.Scene,
    particles: ParticleSystem,
    _audio: AudioManager,
    terrain: TerrainGenerator
  ) {
    this.scene = scene;
    this.particles = particles;
    this.terrain = terrain;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.createZombieModel();
    this.scene.add(this.group);
  }

  private createZombieModel(): void {
    const bodyGeo = new THREE.BoxGeometry(0.7, 1.2, 0.5);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x2b9348,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, this.mat);
    bodyMesh.position.y = 0.6;
    this.group.add(bodyMesh);

    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x55a630,
      roughness: 0.6
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, 1.3, 0.1);
    this.group.add(headMesh);
  }

  public reset(spawnPos: THREE.Vector3, type: EnemyType = EnemyType.RUNNER): void {
    this.type = type;
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.attackTimer = Math.random() * 1.5;
    this.hitFlashTimer = 0;

    if (type === EnemyType.BRUTE) {
      // Zombie Tank (+15% speed = 6.5)
      this.maxHealth = 220;
      this.moveSpeed = 6.5;
      this.radius = 1.8;
      this.scoreValue = 350;
      this.group.scale.set(1.6, 1.6, 1.6);
      this.mat.color.setHex(0x2d1b4e);
    } else if (type === EnemyType.RUNNER) {
      // Zombie Runner (+15% speed = 17.5)
      this.maxHealth = 35;
      this.moveSpeed = 17.5;
      this.radius = 0.8;
      this.scoreValue = 120;
      this.group.scale.set(0.8, 0.8, 0.8);
      this.mat.color.setHex(0xcc1133);
    } else {
      // Zombie Walker (+15% speed = 12.0)
      this.maxHealth = 55;
      this.moveSpeed = 12.0;
      this.radius = 0.9;
      this.scoreValue = 100;
      this.group.scale.set(1.0, 1.0, 1.0);
      this.mat.color.setHex(0x2b9348);
    }

    this.health = this.maxHealth;
    this.group.position.copy(spawnPos);
    this.group.visible = true;
    this.active = true;
  }

  public takeDamage(damage: number, hitPoint: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;
    this.hitFlashTimer = 0.05;
    this.mat.color.setHex(0xffffff);

    this.particles.emitBurst(hitPoint, 8, 0x800020, 6, 0.3);

    if (this.health <= 0) {
      this.deactivate();
      return true;
    }
    return false;
  }

  public updateAI(
    delta: number,
    frameCount: number,
    playerPos: THREE.Vector3,
    grid: SpatialHashGrid<Enemy>,
    onFirePlasma: (origin: THREE.Vector3, dir: THREE.Vector3) => void
  ): void {
    if (!this.active) return;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.mat.color.setHex(this.type === EnemyType.BRUTE ? 0x2d1b4e : this.type === EnemyType.RUNNER ? 0xcc1133 : 0x2b9348);
      }
    }

    tempTargetPos.copy(playerPos);

    if (this.type === EnemyType.SPITTER) {
      const distToPlayerSq = this.position.distanceToSquared(playerPos);
      if (distToPlayerSq < 225) {
        tempTargetPos.subVectors(this.position, playerPos).add(this.position);
      }

      this.attackTimer += delta;
      if (this.attackTimer >= 2.2) {
        this.attackTimer = 0;
        tempSteerDir.copy(playerPos).sub(this.position);
        tempSteerDir.y = 0;
        if (tempSteerDir.lengthSq() > 0) tempSteerDir.normalize();
        onFirePlasma(this.position, tempSteerDir);
      }
    }

    tempSteerDir.copy(tempTargetPos).sub(this.position);
    tempSteerDir.y = 0;
    if (tempSteerDir.lengthSq() > 0) tempSteerDir.normalize();

    if ((this.id + frameCount) % 3 === 0) {
      const neighbors = grid.query(this.position, 2.5);
      tempAvoidForce.set(0, 0, 0);
      let count = 0;

      for (let i = 0; i < neighbors.length; i++) {
        const other = neighbors[i];
        if (other !== this && other.active) {
          const dx = this.position.x - other.position.x;
          const dz = this.position.z - other.position.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 6.25 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            tempAvoidForce.x += (dx / d) / d;
            tempAvoidForce.z += (dz / d) / d;
            count++;
          }
        }
      }

      if (count > 0) {
        tempAvoidForce.divideScalar(count).normalize();
        tempSteerDir.addScaledVector(tempAvoidForce, 2.5).normalize();
      }
    }

    const accel = 24.0;
    this.velocity.x += tempSteerDir.x * accel * delta;
    this.velocity.z += tempSteerDir.z * accel * delta;

    const currentSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
    const maxSpeedSq = this.moveSpeed * this.moveSpeed;
    if (currentSpeedSq > maxSpeedSq) {
      const scale = this.moveSpeed / Math.sqrt(currentSpeedSq);
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    const terrainY = this.terrain.getHeightAt(this.position.x, this.position.z) + 0.6;
    this.position.y = terrainY;

    this.group.position.copy(this.position);
    this.group.lookAt(playerPos.x, this.position.y, playerPos.z);
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }
}
