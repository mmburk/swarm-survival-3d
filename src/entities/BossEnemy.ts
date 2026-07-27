import * as THREE from 'three';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';

export class BossEnemy {
  public active: boolean = false;
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public health: number = 1200;
  public maxHealth: number = 1200;
  public radius: number = 3.2;
  public phase: number = 1;

  private meshCore!: THREE.Mesh;
  private meshRing!: THREE.Mesh;
  private coreMat!: THREE.MeshStandardMaterial;
  private attackTimer: number = 0;
  private chargeTimer: number = 0;
  private isCharging: boolean = false;
  private chargeDir: THREE.Vector3 = new THREE.Vector3();

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
    this.group.visible = false;

    this.createModel();
    this.scene.add(this.group);
  }

  private createModel(): void {
    const coreGeo = new THREE.IcosahedronGeometry(2.8, 1);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff0022,
      emissiveIntensity: 0.8,
      flatShading: true,
      roughness: 0.3,
      metalness: 0.8
    });
    this.meshCore = new THREE.Mesh(coreGeo, this.coreMat);
    this.meshCore.castShadow = true;
    this.group.add(this.meshCore);

    const ringGeo = new THREE.TorusGeometry(4.2, 0.4, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff4400,
      emissiveIntensity: 0.6,
      flatShading: true,
      metalness: 0.9
    });
    this.meshRing = new THREE.Mesh(ringGeo, ringMat);
    this.meshRing.rotation.x = Math.PI / 3;
    this.meshRing.castShadow = true;
    this.group.add(this.meshRing);
  }

  public spawn(spawnPos: THREE.Vector3): void {
    this.health = 1200;
    this.maxHealth = 1200;
    this.phase = 1;
    this.attackTimer = 0;
    this.chargeTimer = 0;
    this.isCharging = false;

    this.coreMat.color.setHex(0xff0033);
    this.coreMat.emissive.setHex(0xff0022);
    this.coreMat.emissiveIntensity = 0.8;

    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.group.position.copy(spawnPos);
    this.group.visible = true;
    this.active = true;

    this.audio.playExplosion();
    this.particles.emitBurst(spawnPos, 50, 0xff0033, 14, 1.2);
  }

  public takeDamage(damage: number, impactPoint?: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;

    // GPU-friendly Hit Flash: boost emissive intensity scalar
    this.coreMat.emissiveIntensity = 3.0;

    if (impactPoint) {
      this.particles.emitBurst(impactPoint, 10, 0xff0044, 8, 0.4);
    }

    if (this.health <= this.maxHealth * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.coreMat.color.setHex(0xffaa00);
      this.coreMat.emissive.setHex(0xffaa00);
      this.audio.playExplosion();
      this.particles.emitBurst(this.position, 60, 0xffaa00, 16, 1.0);
    }

    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.audio.playExplosion();
    this.particles.emitBurst(this.position, 120, 0xff0033, 18, 1.8);
    this.particles.emitDebris(this.position, 40, 0xffaa00);
    this.deactivate();
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    fireRadialCallback: (origin: THREE.Vector3, dir: THREE.Vector3) => void,
    spawnMinionsCallback: (pos: THREE.Vector3) => void
  ): void {
    if (!this.active) return;

    // Smoothly decay hit flash emissive intensity back to base (0.8)
    if (this.coreMat.emissiveIntensity > 0.8) {
      this.coreMat.emissiveIntensity = THREE.MathUtils.lerp(this.coreMat.emissiveIntensity, 0.8, delta * 20);
    }

    this.meshRing.rotation.z += delta * 1.5;
    this.meshCore.rotation.y += delta * 0.8;

    const dirToPlayer = playerPos.clone().sub(this.position);
    dirToPlayer.y = 0;
    const distToPlayer = dirToPlayer.length();
    if (distToPlayer > 0.001) dirToPlayer.normalize();

    if (this.isCharging) {
      this.chargeTimer -= delta;
      this.position.x += this.chargeDir.x * delta * 24;
      this.position.z += this.chargeDir.z * delta * 24;
      this.particles.emitTrail(this.position, 0xffaa00);

      if (this.chargeTimer <= 0) {
        this.isCharging = false;
      }
    } else {
      const speed = this.phase === 2 ? 6.5 : 4.5;
      this.position.x += dirToPlayer.x * delta * speed;
      this.position.z += dirToPlayer.z * delta * speed;
    }

    const terrainY = this.terrain.getHeightAt(this.position.x, this.position.z) + 3.0;
    this.position.y = THREE.MathUtils.lerp(this.position.y, terrainY, delta * 4);
    this.group.position.copy(this.position);

    this.attackTimer += delta;

    if (this.phase === 1) {
      if (this.attackTimer >= 3.2) {
        this.attackTimer = 0;
        const ringProjectiles = 12;
        for (let i = 0; i < ringProjectiles; i++) {
          const angle = (i / ringProjectiles) * Math.PI * 2;
          const radialDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          fireRadialCallback(this.position.clone(), radialDir);
        }
      }
    } else {
      if (this.attackTimer >= 4.0) {
        this.attackTimer = 0;

        if (Math.random() < 0.5) {
          this.isCharging = true;
          this.chargeTimer = 1.0;
          this.chargeDir.copy(dirToPlayer);
        } else {
          spawnMinionsCallback(this.position);
          this.particles.emitBurst(this.position, 30, 0xffaa00, 10, 0.6);
        }
      }
    }
  }
}
