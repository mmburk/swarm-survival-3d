import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';

export const ProjectileType = {
  PLAYER_LASER: 'PLAYER_LASER',
  PLAYER_MISSILE: 'PLAYER_MISSILE',
  ENEMY_PLASMA: 'ENEMY_PLASMA'
} as const;

export type ProjectileType = typeof ProjectileType[keyof typeof ProjectileType];

export class Projectile implements IPoolable {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public quaternion: THREE.Quaternion = new THREE.Quaternion();
  public type: ProjectileType = ProjectileType.PLAYER_LASER;
  public damage: number = 25;
  public isAOE: boolean = false;

  private lifeTime: number = 0;
  private maxLifeTime: number = 2.5;

  private particles: ParticleSystem;
  private audio: AudioManager;

  constructor(particles: ParticleSystem, audio: AudioManager) {
    this.particles = particles;
    this.audio = audio;
  }

  public reset(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number = 55,
    type: ProjectileType = ProjectileType.PLAYER_LASER,
    damage: number = 25
  ): void {
    this.type = type;
    this.damage = damage;
    this.lifeTime = 0;
    this.isAOE = (type === ProjectileType.PLAYER_MISSILE);

    // Hades-Style: Flatten direction vector Y component to 0
    const flatDir = direction.clone();
    flatDir.y = 0;
    if (flatDir.lengthSq() > 0) flatDir.normalize();

    this.position.copy(origin);
    this.velocity.copy(flatDir).multiplyScalar(speed);
    this.velocity.y = 0; // Strictly zero Y-velocity
    this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flatDir);

    if (type === ProjectileType.PLAYER_LASER) {
      this.maxLifeTime = 1.8;
      this.audio.playLaser();
    } else if (type === ProjectileType.PLAYER_MISSILE) {
      this.maxLifeTime = 2.5;
      this.audio.playPlasmaBlast();
    } else {
      this.maxLifeTime = 3.0;
    }
  }

  public update(delta: number): void {
    if (!this.active) return;

    this.lifeTime += delta;
    if (this.lifeTime >= this.maxLifeTime) {
      this.deactivate();
      return;
    }

    // Move purely in 2D XZ space (velocity.y = 0)
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    const colorHex = (this.type === ProjectileType.PLAYER_LASER) ? 0x00ffff :
                     (this.type === ProjectileType.PLAYER_MISSILE) ? 0xffaa00 : 0xff0055;
    this.particles.emitTrail(this.position, colorHex);
  }

  public explode(hitPoint: THREE.Vector3): void {
    const colorHex = (this.type === ProjectileType.PLAYER_LASER) ? 0x00ffff :
                     (this.type === ProjectileType.PLAYER_MISSILE) ? 0xffaa00 : 0xff0055;
    if (this.isAOE) {
      this.particles.emitBurst(hitPoint, 35, 0xffaa00, 14, 0.8);
      this.audio.playExplosion();
    } else {
      this.particles.emitBurst(hitPoint, 12, colorHex, 8, 0.4);
    }
    this.deactivate();
  }

  public deactivate(): void {
    this.active = false;
  }
}
