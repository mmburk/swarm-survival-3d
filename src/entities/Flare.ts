import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import type { Enemy } from './Enemy';

/**
 * ROAD FLARE — the special.
 *
 * You strike it and throw it. The light and noise pull the horde in, it cooks
 * everything standing in it, and when the phosphorus runs out it goes up.
 * The trade is deliberate: it makes the crowd worse before it makes it better.
 */
export class Flare implements IPoolable {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 1.0;

  private burnTime: number = 0;
  private totalBurn: number = 5.0;
  private tickTimer: number = 0;
  private detonated: boolean = false;

  public damagePerTick: number = 14;
  public detonationDamage: number = 260;

  private group: THREE.Group;
  private stick!: THREE.Mesh;
  private glow!: THREE.PointLight;
  private ring!: THREE.Mesh;
  private ringMat!: THREE.MeshBasicMaterial;

  private particles: ParticleSystem;
  private audio: AudioManager;

  constructor(scene: THREE.Scene, particles: ParticleSystem, audio: AudioManager) {
    this.particles = particles;
    this.audio = audio;

    this.group = new THREE.Group();
    this.group.visible = false;

    this.stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xb03a20, emissive: 0x5c1a08, roughness: 0.7 })
    );
    this.stick.rotation.z = Math.PI / 2.4;
    this.stick.position.y = 0.2;
    this.group.add(this.stick);

    this.glow = new THREE.PointLight(0xff6a1f, 75, 26, 2);
    this.glow.position.y = 0.7;
    this.group.add(this.glow);

    const ringGeo = new THREE.RingGeometry(9.6, 10.0, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xd2622a,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.position.y = 0.05;
    this.group.add(this.ring);

    scene.add(this.group);
  }

  public reset(pos: THREE.Vector3, damagePerTick: number, detonationDamage: number): void {
    this.position.copy(pos);
    this.position.y = Math.max(0, pos.y);
    this.group.position.copy(this.position);
    this.burnTime = this.totalBurn;
    this.tickTimer = 0;
    this.detonated = false;
    this.damagePerTick = damagePerTick;
    this.detonationDamage = detonationDamage;
    this.group.visible = true;
    this.active = true;

    this.audio.playFlare();
    this.particles.emitBurst(this.position, 18, 0xff7a2a, 6, 0.5);
  }

  public update(
    delta: number,
    enemies: Enemy[],
    onKill: (e: Enemy) => void
  ): void {
    if (!this.active) return;

    this.burnTime -= delta;
    const t = Math.max(0, this.burnTime / this.totalBurn);

    // Sputtering light and a shrinking marker ring that doubles as a timer.
    this.glow.intensity = 58 + Math.sin(this.burnTime * 30) * 15 + Math.random() * 11;
    this.ring.scale.setScalar(0.35 + t * 0.65);
    this.ringMat.opacity = 0.14 + t * 0.2;
    this.particles.emitTrail(this.position, 0xff7a2a);

    this.tickTimer += delta;
    const doTick = this.tickTimer >= 0.25;
    if (doTick) this.tickTimer = 0;

    const lureRadius = 10.0 * (0.35 + t * 0.65);
    const lureSq = lureRadius * lureRadius;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) continue;

      const dx = this.position.x - e.position.x;
      const dz = this.position.z - e.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 400 || d2 < 0.01) continue; // 20m lure envelope

      // Drawn toward the light from a long way out.
      const d = Math.sqrt(d2);
      const pull = (1 - d / 20) * 14.0 * delta;
      e.velocity.x += (dx / d) * pull;
      e.velocity.z += (dz / d) * pull;

      // Burned only inside the flame ring.
      if (doTick && d2 <= lureSq) {
        if (e.takeDamage(this.damagePerTick, e.position)) onKill(e);
      }
    }

    if (this.burnTime <= 0 && !this.detonated) {
      this.detonated = true;
      this.audio.playExplosion();
      this.particles.emitExplosion(this.position, 12.0, 0xff6a1f);

      const blastSq = 12.0 * 12.0;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active) continue;
        const dx = this.position.x - e.position.x;
        const dz = this.position.z - e.position.z;
        if (dx * dx + dz * dz <= blastSq) {
          if (e.takeDamage(this.detonationDamage, this.position)) onKill(e);
        }
      }
      this.deactivate();
    }
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
    this.position.set(0, -9999, 0);
    this.group.position.copy(this.position);
  }
}
