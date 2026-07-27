import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { SpatialHashGrid, type ISpatialEntity } from '../utils/SpatialHashGrid';
import { ArcadePhysics } from '../physics/ArcadePhysics';

export const EnemyType = {
  RUNNER: 'RUNNER',
  BRUTE: 'BRUTE',
  SPITTER: 'SPITTER'
} as const;

export type EnemyType = typeof EnemyType[keyof typeof EnemyType];

let nextEnemyId = 1;

// Pre-allocated static temp vectors for ZERO Garbage Collection in update loops
const tempSeekDir = new THREE.Vector3();
const tempSepForce = new THREE.Vector3();
const tempDiff = new THREE.Vector3();
const tempDesiredVel = new THREE.Vector3();
const tempLookTarget = new THREE.Vector3();

export class Enemy implements IPoolable, ISpatialEntity {
  public id: number;
  public active: boolean = false;
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public type: EnemyType = EnemyType.RUNNER;
  public health: number = 50;
  public maxHealth: number = 50;
  public speed: number = 8;
  public scoreValue: number = 10;
  public radius: number = 0.8;

  private meshMain!: THREE.Mesh;
  private shootTimer: number = 0;
  private frameOffset: number = 0;
  private mat!: THREE.MeshStandardMaterial;

  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private audio: AudioManager;
  private terrain: TerrainGenerator;

  constructor(
    scene: THREE.Scene,
    particles: ParticleSystem,
    audio: AudioManager,
    terrain: TerrainGenerator
  ) {
    this.id = nextEnemyId++;
    this.frameOffset = this.id % 2;
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;

    this.group = new THREE.Group();
    this.group.visible = false;

    const geo = new THREE.OctahedronGeometry(0.8, 0);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      emissive: 0xff0055,
      emissiveIntensity: 0.4,
      flatShading: true,
      roughness: 0.4,
      metalness: 0.6
    });
    this.meshMain = new THREE.Mesh(geo, this.mat);
    this.meshMain.castShadow = true;
    this.group.add(this.meshMain);
    this.scene.add(this.group);
  }

  public reset(spawnPos: THREE.Vector3, type: EnemyType = EnemyType.RUNNER): void {
    this.type = type;
    this.shootTimer = Math.random() * 1.5;

    if (type === EnemyType.RUNNER) {
      this.health = 40;
      this.maxHealth = 40;
      this.speed = 9.5;
      this.scoreValue = 15;
      this.radius = 0.7;
      this.meshMain.geometry = new THREE.OctahedronGeometry(0.7, 0);
      this.mat.color.setHex(0xff0055);
      this.mat.emissive.setHex(0xff0055);
      this.group.scale.set(1, 1.2, 1);
    } else if (type === EnemyType.BRUTE) {
      this.health = 160;
      this.maxHealth = 160;
      this.speed = 5.0;
      this.scoreValue = 50;
      this.radius = 1.4;
      this.meshMain.geometry = new THREE.DodecahedronGeometry(1.4, 0);
      this.mat.color.setHex(0x9900ff);
      this.mat.emissive.setHex(0x9900ff);
      this.group.scale.set(1.2, 1.2, 1.2);
    } else { // SPITTER
      this.health = 60;
      this.maxHealth = 60;
      this.speed = 7.0;
      this.scoreValue = 30;
      this.radius = 0.9;
      this.meshMain.geometry = new THREE.IcosahedronGeometry(0.9, 0);
      this.mat.color.setHex(0xffaa00);
      this.mat.emissive.setHex(0xffaa00);
      this.group.scale.set(1, 1, 1);
    }

    this.mat.emissiveIntensity = 0.4;
    this.group.position.copy(spawnPos);
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.group.visible = true;
  }

  public takeDamage(damage: number, impactPoint?: THREE.Vector3): boolean {
    this.health -= damage;

    // GPU-friendly Hit Flash: boost emissive intensity scalar without material cloning or pipeline stalls!
    this.mat.emissiveIntensity = 2.5;

    if (impactPoint) {
      this.particles.emitBurst(impactPoint, 8, 0xff0055, 6, 0.3);
    }

    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.audio.playExplosion();
    this.particles.emitBurst(this.group.position, 25, this.mat.color.getHex(), 10, 0.6);
    this.deactivate();
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
    this.velocity.set(0, 0, 0);
  }

  public updateAI(
    delta: number,
    frameIndex: number,
    playerPos: THREE.Vector3,
    spatialGrid: SpatialHashGrid<Enemy>,
    fireRangedCallback?: (origin: THREE.Vector3, dir: THREE.Vector3) => void
  ): void {
    if (!this.active) return;

    // Smoothly decay hit flash emissive intensity back to base (0.4)
    if (this.mat.emissiveIntensity > 0.4) {
      this.mat.emissiveIntensity = THREE.MathUtils.lerp(this.mat.emissiveIntensity, 0.4, delta * 25);
    }

    // Stagger AI steering calculation for distant enemies across 2 frames
    const distToPlayerSq = this.position.distanceToSquared(playerPos);
    if (distToPlayerSq > 600 && (frameIndex % 2 !== this.frameOffset)) {
      ArcadePhysics.integratePosition(this.position, this.velocity, delta, 0.85);
      this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z) + this.radius;
      this.group.position.copy(this.position);
      return;
    }

    tempSeekDir.copy(playerPos).sub(this.position);
    tempSeekDir.y = 0;
    const distToPlayer = tempSeekDir.length();
    if (distToPlayer > 0.001) tempSeekDir.divideScalar(distToPlayer);

    tempSepForce.set(0, 0, 0);
    let count = 0;
    const separateRadius = 2.4;

    const nearbyNeighbors = spatialGrid.query(this.position, separateRadius);
    for (let i = 0; i < nearbyNeighbors.length; i++) {
      const other = nearbyNeighbors[i];
      if (other.id !== this.id && other.active) {
        const dist = this.position.distanceTo(other.position);
        if (dist > 0 && dist < separateRadius) {
          tempDiff.copy(this.position).sub(other.position).normalize().divideScalar(dist);
          tempSepForce.add(tempDiff);
          count++;
          ArcadePhysics.resolveSoftOverlap(this.position, this.velocity, other.position, this.radius, other.radius, 4.0);
        }
      }
    }
    if (count > 0) tempSepForce.divideScalar(count);

    tempDesiredVel.set(0, 0, 0);
    if (this.type === EnemyType.SPITTER && distToPlayer < 14) {
      tempDesiredVel.copy(tempSeekDir).multiplyScalar(-0.4).addScaledVector(tempSepForce, 1.5);
    } else {
      tempDesiredVel.copy(tempSeekDir).multiplyScalar(1.0).addScaledVector(tempSepForce, 1.2);
    }

    if (tempDesiredVel.lengthSq() > 0) {
      tempDesiredVel.normalize().multiplyScalar(this.speed);
    }

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, tempDesiredVel.x, delta * 12);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, tempDesiredVel.z, delta * 12);

    ArcadePhysics.integratePosition(this.position, this.velocity, delta, 0.85);

    const terrainH = this.terrain.getHeightAt(this.position.x, this.position.z) + this.radius;
    this.position.y = terrainH;

    this.group.position.copy(this.position);

    if (distToPlayer > 0.5) {
      tempLookTarget.set(playerPos.x, this.position.y, playerPos.z);
      this.group.lookAt(tempLookTarget);
    }

    if (this.type === EnemyType.SPITTER && distToPlayer < 22 && fireRangedCallback) {
      this.shootTimer += delta;
      if (this.shootTimer >= 2.2) {
        this.shootTimer = 0;
        const dir = playerPos.clone().sub(this.position).normalize();
        fireRangedCallback(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), dir);
      }
    }
  }
}
