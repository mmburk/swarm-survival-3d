import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { ArcadePhysics } from '../physics/ArcadePhysics';

const tempPlayerLook = new THREE.Vector3();
const tempCamTarget = new THREE.Vector3();
const tempCamOffset = new THREE.Vector3(0, 24, 20);
const tempMuzzleOffset = new THREE.Vector3(0.45, 0.7, 0.9);
const tempMuzzlePos = new THREE.Vector3();
const tempHurtOffset = new THREE.Vector3();

export class Player {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, 4, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 1.0;

  // Base Stats & Health
  public health: number = 100;
  public maxHealth: number = 100;
  public dashStamina: number = 100;
  public maxDashStamina: number = 100;
  public moveSpeed: number = 16;

  // Ultimate Charge (Cyber Nova)
  public ultCharge: number = 0;
  public maxUltCharge: number = 100;

  // Level & XP Stats
  public level: number = 1;
  public xp: number = 0;
  public maxXp: number = 100;

  // Upgradeable Weapons & Perks
  public fireRateMultiplier: number = 1.0;
  public laserDamage: number = 30;
  public missileAOERadius: number = 8.5;
  public missileDamage: number = 140;
  public dashCooldownMultiplier: number = 1.0;
  public pickupRadius: number = 5.5;

  public primaryCooldown: number = 0;
  public secondaryCooldown: number = 0;

  private isDashing: boolean = false;
  private dashTimer: number = 0;
  private dashDir: THREE.Vector3 = new THREE.Vector3();

  private visorMesh!: THREE.Mesh;
  private weaponMesh!: THREE.Mesh;

  private scene: THREE.Scene;
  private input: InputManager;
  private particles: ParticleSystem;
  private audio: AudioManager;
  private terrain: TerrainGenerator;

  constructor(
    scene: THREE.Scene,
    input: InputManager,
    particles: ParticleSystem,
    audio: AudioManager,
    terrain: TerrainGenerator
  ) {
    this.scene = scene;
    this.input = input;
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;

    this.group = new THREE.Group();
    this.createModel();
    this.scene.add(this.group);
  }

  private createModel(): void {
    const torsoGeo = new THREE.CylinderGeometry(0.5, 0.3, 1.2, 8);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x052044,
      metalness: 0.8,
      roughness: 0.2,
      flatShading: true
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.6;
    torso.castShadow = true;
    this.group.add(torso);

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x0f3460,
      metalness: 0.9,
      roughness: 0.1
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.45;
    head.castShadow = true;
    this.group.add(head);

    const visorGeo = new THREE.BoxGeometry(0.52, 0.15, 0.25);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.5,
      toneMapped: false
    });
    this.visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.visorMesh.position.set(0, 1.45, 0.2);
    this.group.add(this.visorMesh);

    const weaponGeo = new THREE.BoxGeometry(0.25, 0.25, 0.9);
    const weaponMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.1
    });
    this.weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
    this.weaponMesh.position.set(0.45, 0.7, 0.3);
    this.weaponMesh.castShadow = true;
    this.group.add(this.weaponMesh);
  }

  public resetStats(): void {
    this.health = this.maxHealth;
    this.dashStamina = this.maxDashStamina;
    this.ultCharge = 0;
    this.level = 1;
    this.xp = 0;
    this.maxXp = 100;

    this.fireRateMultiplier = 1.0;
    this.laserDamage = 30;
    this.missileAOERadius = 8.5;
    this.missileDamage = 140;
    this.dashCooldownMultiplier = 1.0;
    this.moveSpeed = 16;
    this.pickupRadius = 5.5;

    this.position.set(0, 4, 0);
    this.velocity.set(0, 0, 0);
    this.group.position.copy(this.position);
  }

  public addXp(amount: number): boolean {
    this.xp += amount;
    this.audio.playPickup();
    if (this.xp >= this.maxXp) {
      this.xp -= this.maxXp;
      this.level++;
      this.maxXp = Math.floor(this.maxXp * 1.4);
      this.audio.playLevelUp();
      return true;
    }
    return false;
  }

  public addUltCharge(amount: number): void {
    this.ultCharge = Math.min(this.maxUltCharge, this.ultCharge + amount);
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.audio.playPickup();
  }

  public takeDamage(damage: number): void {
    this.health = Math.max(0, this.health - damage);
    this.audio.playPlayerHurt();
    tempHurtOffset.copy(this.group.position).add(new THREE.Vector3(0, 1, 0));
    this.particles.emitBurst(tempHurtOffset, 15, 0xff0044, 8, 0.4);
  }

  public update(delta: number, camera: THREE.PerspectiveCamera): void {
    if (this.primaryCooldown > 0) this.primaryCooldown -= delta;
    if (this.secondaryCooldown > 0) this.secondaryCooldown -= delta;

    if (this.dashStamina < this.maxDashStamina) {
      this.dashStamina = Math.min(this.maxDashStamina, this.dashStamina + delta * 35 * this.dashCooldownMultiplier);
    }

    const moveInput = this.input.getMoveVector();

    if (this.input.justDashed && this.dashStamina >= 30 && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = 0.22;
      this.dashStamina -= 30;
      this.audio.playDash();

      if (moveInput.x !== 0 || moveInput.y !== 0) {
        this.dashDir.set(moveInput.x, 0, moveInput.y).normalize();
      } else {
        this.dashDir.set(0, 0, 1).applyQuaternion(this.group.quaternion).normalize();
      }
    }

    if (this.isDashing) {
      this.dashTimer -= delta;
      this.velocity.x = this.dashDir.x * 34;
      this.velocity.z = this.dashDir.z * 34;
      this.particles.emitTrail(this.position, 0x00ffff);

      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveInput.x * this.moveSpeed, delta * 15);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveInput.y * this.moveSpeed, delta * 15);
    }

    ArcadePhysics.integratePosition(this.position, this.velocity, delta, 0.88);

    const terrainY = this.terrain.getHeightAt(this.position.x, this.position.z) + 1.0;
    this.position.y = terrainY;

    this.group.position.copy(this.position);

    const aimPoint = this.input.aimPoint;
    tempPlayerLook.set(aimPoint.x, this.position.y, aimPoint.z);
    if (this.position.distanceToSquared(tempPlayerLook) > 0.1) {
      this.group.lookAt(tempPlayerLook);
    }

    tempCamTarget.copy(this.position).add(tempCamOffset);
    camera.position.lerp(tempCamTarget, delta * 8);
    camera.lookAt(this.position.x, this.position.y + 0.5, this.position.z);
  }

  public getWeaponMuzzlePos(): THREE.Vector3 {
    tempMuzzlePos.copy(tempMuzzleOffset).applyQuaternion(this.group.quaternion).add(this.group.position);
    return tempMuzzlePos;
  }
}
