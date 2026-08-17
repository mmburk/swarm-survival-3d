import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { SpatialHashGrid } from '../utils/SpatialHashGrid';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import { InstancedProps } from '../graphics/InstancedProps';
import { HEX } from '../theme/Palette';

export const EnemyType = {
  /** The baseline dead. Slow, weak, and there are always more. */
  SHAMBLER: 'SHAMBLER',
  /** Fresh turns. They still run. */
  SPRINTER: 'SPRINTER',
  /** Swollen with bile, keeps its distance and spits. */
  BLOATER: 'BLOATER',
  /** Was a big man before. Still is. */
  BUTCHER: 'BUTCHER',
  /** Gas-bloated. Comes close, swells, and goes off. */
  BURSTER: 'BURSTER'
} as const;

export type EnemyType = typeof EnemyType[keyof typeof EnemyType];

export interface Profile {
  health: number;
  speed: number;
  radius: number;
  contact: number;
  score: number;
  scrap: number;
  scale: number;
  flesh: number;
  cloth: number;
}

export const PROFILES: Record<EnemyType, Profile> = {
  SHAMBLER: { health: 34, speed: 2.6, radius: 0.85, contact: 12, score: 100, scrap: 1, scale: 0.95, flesh: HEX.flesh, cloth: 0x4c4b41 },
  SPRINTER: { health: 22, speed: 7.4, radius: 0.78, contact: 15, score: 150, scrap: 1, scale: 0.85, flesh: 0x9c8a72, cloth: 0x5e3730 },
  BLOATER: { health: 60, speed: 3.0, radius: 1.0, contact: 10, score: 190, scrap: 2, scale: 1.05, flesh: 0x7d8a5c, cloth: 0x3f4a34 },
  BUTCHER: { health: 210, speed: 2.9, radius: 1.55, contact: 26, score: 360, scrap: 4, scale: 1.65, flesh: 0x6f7259, cloth: 0x53372b },
  BURSTER: { health: 40, speed: 4.6, radius: 0.95, contact: 22, score: 230, scrap: 2, scale: 1.0, flesh: 0x8f9152, cloth: 0x4a4a2c }
};

const tempSteer = new THREE.Vector3();
const tempTarget = new THREE.Vector3();
const tempAvoid = new THREE.Vector3();

let nextEnemyId = 1;

/**
 * One of the dead. State only — no meshes.
 *
 * The body used to be a scene graph of its own, and with fifty of them upright
 * that was three quarters of the frame's draw calls and a thousand idle
 * matrices being recomposed for pooled copies that were nowhere. Everything
 * below the AI is now the handful of numbers InstancedEnemies needs to draw
 * one: where it is, which way it is facing, how far through its shuffle it is.
 */
export class Enemy implements IPoolable {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 0.85;
  public type: EnemyType = EnemyType.SHAMBLER;
  public id: number;

  public health: number = 34;
  public maxHealth: number = 34;
  public moveSpeed: number = 2.6;
  public scoreValue: number = 100;
  public scrapValue: number = 1;
  public contactDamage: number = 12;
  public stunTimer: number = 0;

  public isSwelling: boolean = false;
  public swellTimer: number = 0;

  // ---- what the renderer reads --------------------------------------------

  /** Facing, in radians about Y. Held between frames: a stunned or swelling
   *  body stops turning and keeps whichever way it was last pointed. */
  public yaw: number = 0;
  /** Uniform scale, carrying the spawn pop-in and a Burster's swell. */
  public renderScale: number = 0.95;
  /** Phase of the shuffle, driving the body rock and the arm swing. */
  public gait: number = 0;
  /** Pale for a few frames after being hit. */
  public flashing: boolean = false;
  /** A Burster's gas building. */
  public hot: boolean = false;
  public hpVisible: boolean = false;
  public hpRatio: number = 1;

  /**
   * Set by the engine when a sector is nearly clear. Ranged types normally
   * kite, which means the last Bloater alive can park itself outside the
   * player's patience and stall the sector forever. When this is on they stop
   * backing away and come to you.
   */
  public pressAttack: boolean = false;

  private attackTimer: number = 0;
  private hitFlashTimer: number = 0;
  private spawnTimer: number = 0;
  private baseScale: number = 1.0;
  private lurch: number = 0;

  private particles: ParticleSystem;
  private audio: AudioManager;
  private terrain: TerrainGenerator;

  constructor(particles: ParticleSystem, audio: AudioManager, terrain: TerrainGenerator) {
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;
    this.id = nextEnemyId++;
  }

  /**
   * @param difficulty Health/speed scaling from the selected Long Night tier.
   */
  public reset(spawnPos: THREE.Vector3, type: EnemyType = EnemyType.SHAMBLER, difficulty = { health: 1, speed: 1 }): void {
    const p = PROFILES[type] ?? PROFILES.SHAMBLER;

    this.type = type;
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.attackTimer = Math.random() * 1.8;
    this.hitFlashTimer = 0;
    this.stunTimer = 0;
    this.isSwelling = false;
    this.swellTimer = 0;
    this.pressAttack = false;
    this.lurch = Math.random() * Math.PI * 2;

    this.maxHealth = Math.round(p.health * difficulty.health);
    this.health = this.maxHealth;
    this.moveSpeed = p.speed * difficulty.speed;
    this.radius = p.radius;
    this.contactDamage = p.contact;
    this.scoreValue = p.score;
    this.scrapValue = p.scrap;
    this.baseScale = p.scale;

    this.flashing = false;
    this.hot = false;
    this.hpVisible = false;
    this.hpRatio = 1;
    this.gait = 0;
    this.yaw = 0;

    this.spawnTimer = 0.22;
    this.renderScale = this.baseScale * 0.45;
    this.active = true;
  }

  public takeDamage(damage: number, hitPoint: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;
    this.hitFlashTimer = 0.07;
    this.flashing = true;

    if (hitPoint) {
      const dx = this.position.x - hitPoint.x;
      const dz = this.position.z - hitPoint.z;
      const len = Math.hypot(dx, dz) || 1;
      // Heavier bodies barely move; sprinters get thrown.
      const knock = 7.0 * (1.2 / this.baseScale);
      this.velocity.x += (dx / len) * knock;
      this.velocity.z += (dz / len) * knock;
    }

    this.particles.emitBurst(hitPoint || this.position, 6, HEX.gore, 5, 0.24);
    this.audio.playImpact();

    if (this.health < this.maxHealth && this.health > 0) {
      this.hpVisible = true;
      this.hpRatio = Math.max(0.02, this.health / this.maxHealth);
    }

    if (this.health <= 0) {
      this.active = false;
      this.hpVisible = false;
      this.flashing = false;
      return true;
    }
    return false;
  }

  public updateAI(
    delta: number,
    frameCount: number,
    playerPos: THREE.Vector3,
    grid: SpatialHashGrid<Enemy>,
    onSpit: (origin: THREE.Vector3, dir: THREE.Vector3) => void,
    onBurst?: (enemy: Enemy) => void
  ): void {
    if (!this.active) return;

    if (this.spawnTimer > 0) {
      this.spawnTimer -= delta;
      const t = Math.min(1, 1 - this.spawnTimer / 0.22);
      this.renderScale = this.baseScale * (0.45 + 0.55 * t);
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) this.flashing = false;
    }

    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      this.velocity.multiplyScalar(0.86);
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      return;
    }

    // Bursters swell up once they are on top of you, then go off.
    if (this.type === EnemyType.BURSTER) {
      if (!this.isSwelling && this.position.distanceToSquared(playerPos) <= 5.0) {
        this.isSwelling = true;
        this.swellTimer = 0.85;
        this.audio.playSwell();
      }
      if (this.isSwelling) {
        this.velocity.multiplyScalar(0.8);
        this.swellTimer -= delta;
        const puff = 1 + (0.85 - this.swellTimer) * 0.55;
        this.renderScale = this.baseScale * puff;
        // Pulses hotter as the gas builds — the tell that it is about to go.
        this.hot = Math.floor(frameCount / 4) % 2 === 0;

        if (this.swellTimer <= 0) {
          onBurst?.(this);
          this.deactivate();
          return;
        }
        return;
      }
    }

    tempTarget.copy(playerPos);

    // Bloaters hold a lane and spit bile from range.
    if (this.type === EnemyType.BLOATER) {
      const d2 = this.position.distanceToSquared(playerPos);
      if (d2 < 180 && !this.pressAttack) {
        tempTarget.subVectors(this.position, playerPos).add(this.position);
      }
      this.attackTimer += delta;
      if (this.attackTimer >= 2.6 && d2 < 900) {
        this.attackTimer = 0;
        tempSteer.copy(playerPos).sub(this.position).setY(0);
        if (tempSteer.lengthSq() > 0) tempSteer.normalize();
        onSpit(this.position, tempSteer);
      }
    }

    tempSteer.copy(tempTarget).sub(this.position).setY(0);
    if (tempSteer.lengthSq() > 0) tempSteer.normalize();

    // Crowd separation, staggered across frames to keep the cost down.
    if ((this.id + frameCount) % 3 === 0) {
      const neighbors = grid.query(this.position, 2.5);
      tempAvoid.set(0, 0, 0);
      let n = 0;
      for (let i = 0; i < neighbors.length; i++) {
        const other = neighbors[i];
        if (other === this || !other.active) continue;
        const dx = this.position.x - other.position.x;
        const dz = this.position.z - other.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 6.25 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          tempAvoid.x += (dx / d) / d;
          tempAvoid.z += (dz / d) / d;
          n++;
        }
      }
      if (n > 0) {
        tempSteer.x += tempAvoid.x * 0.8;
        tempSteer.z += tempAvoid.z * 0.8;
        if (tempSteer.lengthSq() > 0) tempSteer.normalize();
      }
    }

    // A slight side-to-side weave so the horde does not move as one blob.
    this.lurch += delta * (this.type === EnemyType.SPRINTER ? 7.0 : 2.6);
    const weave = Math.sin(this.lurch) * (this.type === EnemyType.SPRINTER ? 0.12 : 0.22);
    const wx = -tempSteer.z * weave;
    const wz = tempSteer.x * weave;

    const accel = 22.0;
    this.velocity.x += (tempSteer.x + wx) * accel * delta;
    this.velocity.z += (tempSteer.z + wz) * accel * delta;

    const speedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
    if (speedSq > this.moveSpeed * this.moveSpeed) {
      const s = this.moveSpeed / Math.sqrt(speedSq);
      this.velocity.x *= s;
      this.velocity.z *= s;
    }

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    for (const o of InstancedProps.obstacles) {
      ArcadePhysics.resolveSolidObstacle(this.position, this.radius, o);
    }

    this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z);

    // Turns to the player. This reproduces what Object3D.lookAt worked out when
    // the body was a group in the scene, spun about Y only. Note the sign:
    // lookAt swaps its arguments for anything that is not a camera or a light,
    // so it lays +Z along the line to the target rather than -Z.
    this.yaw = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);

    this.gait = Math.sin(this.lurch * 1.4);
  }

  public deactivate(): void {
    this.active = false;
    this.hpVisible = false;
    this.flashing = false;
    this.hot = false;
    this.position.set(0, -9999, 0);
  }
}
