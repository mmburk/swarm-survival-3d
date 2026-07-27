import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';

export class GravityCrystal implements IPoolable {
  public active: boolean = false;
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 1.2;

  public isTriggered: boolean = false;
  private pullTimer: number = 0;
  private mesh!: THREE.Mesh;
  private mat!: THREE.MeshStandardMaterial;

  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private audio: AudioManager;

  constructor(scene: THREE.Scene, particles: ParticleSystem, audio: AudioManager) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;

    this.group = new THREE.Group();
    this.group.visible = false;

    const geo = new THREE.OctahedronGeometry(1.2, 0);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xaa00ff,
      emissive: 0xaa00ff,
      emissiveIntensity: 0.8,
      flatShading: true,
      roughness: 0.2,
      metalness: 0.9
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    this.scene.add(this.group);
  }

  public reset(spawnPos: THREE.Vector3): void {
    this.position.copy(spawnPos);
    this.group.position.copy(spawnPos);
    this.isTriggered = false;
    this.pullTimer = 0;
    this.mat.color.setHex(0xaa00ff);
    this.mat.emissive.setHex(0xaa00ff);
    this.mat.emissiveIntensity = 0.8;
    this.group.visible = true;
    this.active = true;
  }

  public trigger(): void {
    if (this.isTriggered || !this.active) return;
    this.isTriggered = true;
    this.pullTimer = 3.5;
    this.mat.color.setHex(0x00ffff);
    this.mat.emissive.setHex(0x00ffff);
    this.mat.emissiveIntensity = 2.5;
    this.audio.playPlasmaBlast();
    this.particles.emitBurst(this.position, 25, 0x00ffff, 10, 0.6);
  }

  public update(
    delta: number,
    enemies: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; active: boolean; takeDamage: (dmg: number, pos: THREE.Vector3) => boolean; id: number }>,
    onKilledEnemy: (e: any) => void
  ): void {
    if (!this.active) return;

    this.mesh.rotation.y += delta * 2.0;

    if (this.isTriggered) {
      this.pullTimer -= delta;
      this.particles.emitTrail(this.position, 0xaa00ff);

      // Pull nearby enemies into the gravity well (pure 2D XZ plane math)
      const pullRadiusSq = 18.0 * 18.0;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active) continue;

        const dx = this.position.x - e.position.x;
        const dz = this.position.z - e.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < pullRadiusSq && distSq > 0.1) {
          const dist = Math.sqrt(distSq);
          const pullForce = (1.0 - dist / 18.0) * delta * 25.0;
          e.velocity.x += (dx / dist) * pullForce;
          e.velocity.z += (dz / dist) * pullForce;
        }
      }

      if (this.pullTimer <= 0) {
        // Detonate Gravity Well Shockwave!
        this.audio.playExplosion();
        this.particles.emitBurst(this.position, 60, 0xaa00ff, 16, 1.2);

        const blastRadiusSq = 14.0 * 14.0;
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!e.active) continue;

          const dx = this.position.x - e.position.x;
          const dz = this.position.z - e.position.z;
          if ((dx * dx + dz * dz) < blastRadiusSq) {
            const killed = e.takeDamage(220, e.position);
            if (killed) {
              onKilledEnemy(e);
            }
          }
        }
        this.deactivate();
      }
    }
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }
}
