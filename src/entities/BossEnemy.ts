import * as THREE from 'three';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';

export type BossArchetype = 'ANNIHILATOR' | 'HIVEMIND' | 'PHANTOM';

const tempPlayerDir = new THREE.Vector3();
const tempRingDir = new THREE.Vector3();

export class BossEnemy {
  public active: boolean = false;
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 2.8;

  public archetype: BossArchetype = 'ANNIHILATOR';
  public health: number = 1200;
  public maxHealth: number = 1200;

  private phase: number = 1;
  private attackTimer: number = 0;
  private laserAngle: number = 0;
  private teleportTimer: number = 0;

  private bodyMesh!: THREE.Mesh;
  private eyeMesh!: THREE.Mesh;
  private mat!: THREE.MeshStandardMaterial;
  private eyeMat!: THREE.MeshStandardMaterial;

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
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;

    this.group = new THREE.Group();
    this.createModel();
    this.scene.add(this.group);
  }

  private createModel(): void {
    const geo = new THREE.DodecahedronGeometry(2.8, 0);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xaa0033,
      emissive: 0xff0044,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.2,
      flatShading: true
    });
    this.bodyMesh = new THREE.Mesh(geo, this.mat);
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    const eyeGeo = new THREE.SphereGeometry(1.2, 16, 16);
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 2.0,
      toneMapped: false
    });
    this.eyeMesh = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.eyeMesh.position.set(0, 0, 2.0);
    this.group.add(this.eyeMesh);
  }

  public spawn(spawnPos: THREE.Vector3): void {
    const archetypes: BossArchetype[] = ['ANNIHILATOR', 'HIVEMIND', 'PHANTOM'];
    this.archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    this.maxHealth = 1200;
    this.health = this.maxHealth;
    this.phase = 1;
    this.attackTimer = 0;
    this.teleportTimer = 0;

    if (this.archetype === 'HIVEMIND') {
      this.mat.color.setHex(0x9900ff);
      this.eyeMat.color.setHex(0x00ffff);
      this.eyeMat.emissive.setHex(0x00ffff);
    } else if (this.archetype === 'PHANTOM') {
      this.mat.color.setHex(0x00ffaa);
      this.eyeMat.color.setHex(0xffaa00);
      this.eyeMat.emissive.setHex(0xffaa00);
    } else {
      this.mat.color.setHex(0xaa0033);
      this.eyeMat.color.setHex(0xffff00);
      this.eyeMat.emissive.setHex(0xffff00);
    }

    this.position.copy(spawnPos);
    this.group.position.copy(spawnPos);
    this.group.visible = true;
    this.active = true;

    this.audio.playExplosion();
    this.particles.emitBurst(this.position, 60, 0xff0044, 15, 1.2);
  }

  public takeDamage(damage: number, hitPoint: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;
    this.audio.playPlayerHurt();
    this.particles.emitBurst(hitPoint, 8, 0xff0044, 8, 0.4);

    if (this.health <= this.maxHealth * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.audio.playExplosion();
      this.particles.emitBurst(this.position, 50, 0xffff00, 16, 1.0);
    }

    if (this.health <= 0) {
      this.deactivate();
      return true; // Defeated
    }
    return false;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    onFirePlasma: (origin: THREE.Vector3, dir: THREE.Vector3) => void,
    onSummonMinions: (pos: THREE.Vector3) => void
  ): void {
    if (!this.active) return;

    this.bodyMesh.rotation.y += delta * 1.5;
    this.attackTimer += delta;

    if (this.archetype === 'HIVEMIND') {
      // HIVEMIND: Stationary turret with rotating linear laser and minion spawns
      this.laserAngle += delta * 2.0;
      if (this.attackTimer >= 0.15) {
        this.attackTimer = 0;
        tempRingDir.set(Math.cos(this.laserAngle), 0, Math.sin(this.laserAngle));
        onFirePlasma(this.position, tempRingDir);
      }
      if (Math.random() < 0.005) {
        onSummonMinions(this.position);
      }
    } else if (this.archetype === 'PHANTOM') {
      // PHANTOM: Teleports across XZ plane leaving phantom pulses
      this.teleportTimer += delta;
      if (this.teleportTimer >= 3.5) {
        this.teleportTimer = 0;
        this.audio.playDash();
        this.particles.emitBurst(this.position, 30, 0x00ffaa, 10, 0.6);

        // Teleport near player
        const angle = Math.random() * Math.PI * 2;
        this.position.x = playerPos.x + Math.cos(angle) * 14;
        this.position.z = playerPos.z + Math.sin(angle) * 14;
        this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z) + 2.5;
        this.group.position.copy(this.position);

        this.particles.emitBurst(this.position, 30, 0x00ffaa, 10, 0.6);
      }

      if (this.attackTimer >= 0.4) {
        this.attackTimer = 0;
        tempPlayerDir.copy(playerPos).sub(this.position);
        tempPlayerDir.y = 0;
        if (tempPlayerDir.lengthSq() > 0) tempPlayerDir.normalize();
        onFirePlasma(this.position, tempPlayerDir);
      }
    } else {
      // ANNIHILATOR: Radial ring blasts and direct charges
      const speed = (this.phase === 2) ? 11 : 7;
      tempPlayerDir.copy(playerPos).sub(this.position);
      tempPlayerDir.y = 0;
      if (tempPlayerDir.lengthSq() > 0) tempPlayerDir.normalize();

      this.position.x += tempPlayerDir.x * speed * delta;
      this.position.z += tempPlayerDir.z * speed * delta;
      this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z) + 2.5;
      this.group.position.copy(this.position);
      this.group.lookAt(playerPos.x, this.position.y, playerPos.z);

      const fireInterval = (this.phase === 2) ? 1.4 : 2.2;
      if (this.attackTimer >= fireInterval) {
        this.attackTimer = 0;
        const count = 12;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          tempRingDir.set(Math.cos(angle), 0, Math.sin(angle));
          onFirePlasma(this.position, tempRingDir);
        }
      }
    }
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }
}
