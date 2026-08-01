import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { HEX } from '../theme/Palette';

export const ProjectileType = {
  /** Ordinary lead. Fast, short-lived, may pass through bodies. */
  PLAYER_BULLET: 'PLAYER_BULLET',
  /** Thrown or launched ordnance. Detonates on contact. */
  PLAYER_HEAVY: 'PLAYER_HEAVY',
  /** Bloater bile. */
  ENEMY_BILE: 'ENEMY_BILE'
} as const;

export type ProjectileType = typeof ProjectileType[keyof typeof ProjectileType];

const FORWARD = new THREE.Vector3(0, 0, 1);

export interface ProjectileOptions {
  pierce?: number;
  radius?: number;
  range?: number;
  /** Blast radius for heavy rounds. */
  blast?: number;
}

export class Projectile implements IPoolable {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public startPosition: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public quaternion: THREE.Quaternion = new THREE.Quaternion();
  public type: ProjectileType = ProjectileType.PLAYER_BULLET;
  public damage: number = 25;
  public radius: number = 0.5;
  public blastRadius: number = 0;
  /** Drives the damage-number styling; must be re-set on every reuse. */
  public isCrit: boolean = false;

  /** Bodies this round may still pass through. */
  public pierceLeft: number = 0;
  /** Enemy ids already hit, so one round cannot damage the same body twice. */
  public hitIds: Set<number> = new Set();

  private lifeTime: number = 0;
  private maxLifeTime: number = 0.8;
  private maxRange: number = 35;
  private trailTimer: number = 0;

  private particles: ParticleSystem;

  constructor(particles: ParticleSystem) {
    this.particles = particles;
  }

  public reset(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    type: ProjectileType,
    damage: number,
    opts: ProjectileOptions = {}
  ): void {
    this.type = type;
    this.damage = damage;
    this.lifeTime = 0;
    this.trailTimer = 0;
    this.isCrit = false;
    this.hitIds.clear();

    this.pierceLeft = opts.pierce ?? 0;
    this.radius = opts.radius ?? (type === ProjectileType.PLAYER_HEAVY ? 0.7 : 0.45);
    this.blastRadius = opts.blast ?? 0;
    this.maxRange = opts.range ?? 35;

    const dir = direction.clone().setY(0);
    if (dir.lengthSq() > 0) dir.normalize();
    else dir.set(0, 0, -1);

    this.position.copy(origin);
    this.position.y = Math.max(1.1, origin.y);
    this.startPosition.copy(this.position);
    this.velocity.copy(dir).multiplyScalar(speed);
    this.quaternion.setFromUnitVectors(FORWARD, dir);

    this.maxLifeTime = this.maxRange / Math.max(1, speed) + 0.12;
  }

  public update(delta: number): void {
    if (!this.active) return;

    this.lifeTime += delta;
    if (this.lifeTime >= this.maxLifeTime ||
        this.position.distanceToSquared(this.startPosition) >= this.maxRange * this.maxRange) {
      this.dissipate();
      return;
    }

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // Heavy ordnance smokes; bullets are too fast to bother trailing every frame.
    if (this.type !== ProjectileType.PLAYER_BULLET) {
      this.trailTimer += delta;
      if (this.trailTimer >= 0.03) {
        this.trailTimer = 0;
        this.particles.emitTrail(
          this.position,
          this.type === ProjectileType.PLAYER_HEAVY ? HEX.smoke : HEX.mossDark
        );
      }
    }
  }

  public dissipate(): void {
    if (this.type === ProjectileType.PLAYER_BULLET) {
      this.particles.emitBurst(this.position, 3, HEX.concrete, 4, 0.16);
    }
    this.deactivate();
  }

  public deactivate(): void {
    this.active = false;
    this.hitIds.clear();
    this.position.set(0, -9999, 0);
  }
}
