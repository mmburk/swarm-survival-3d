import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { ArcadePhysics } from '../physics/ArcadePhysics';

export type ShipClass = 'VANGUARD' | 'STRIKER' | 'JUGGERNAUT';
export type WeaponSlot = 1 | 2 | 3; // 1: Rifle, 2: Shotgun, 3: Grenade

const tempPlayerLook = new THREE.Vector3();
const tempCamTarget = new THREE.Vector3();
const tempCamOffset = new THREE.Vector3(0, 20, 18);
const tempMuzzleOffset = new THREE.Vector3(0.35, 0.7, 1.1);
const tempMuzzlePos = new THREE.Vector3();
const tempHurtOffset = new THREE.Vector3();
const tempTargetQuat = new THREE.Quaternion();
const tempTargetMat = new THREE.Matrix4();

export class Player {
  public group: THREE.Group;
  public shipMeshGroup: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, 4, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 1.0;
  public shipClass: ShipClass = 'VANGUARD';

  // Active Weapon Inventory Slot
  public currentWeaponSlot: WeaponSlot = 1;

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

  // Procedural Motion State
  private hoverTime: number = 0;
  private recoilOffset: number = 0;

  private bodyMat!: THREE.MeshStandardMaterial;
  private gunMesh!: THREE.Mesh;

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
    this.shipMeshGroup = new THREE.Group();
    this.group.add(this.shipMeshGroup);

    this.createCommandoModel();
    this.scene.add(this.group);
  }

  private createCommandoModel(): void {
    // Tactical Commando / Soldier Body
    const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.2, 8, 16);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2b3a4a,
      roughness: 0.5,
      metalness: 0.4,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    bodyMesh.position.y = 0.8;
    this.shipMeshGroup.add(bodyMesh);

    // Tactical Helmet
    const headGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      emissive: 0x00ffff,
      emissiveIntensity: 0.2,
      roughness: 0.2
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, 1.5, 0.1);
    this.shipMeshGroup.add(headMesh);

    // Visible Assault Rifle Barrel
    const gunGeo = new THREE.BoxGeometry(0.2, 0.2, 1.2);
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.9
    });
    this.gunMesh = new THREE.Mesh(gunGeo, gunMat);
    this.gunMesh.position.set(0.35, 0.9, 0.6);
    this.shipMeshGroup.add(this.gunMesh);
  }

  public setShipClass(shipClass: ShipClass): void {
    this.shipClass = shipClass;
    if (shipClass === 'STRIKER') {
      this.maxHealth = 65;
      this.moveSpeed = 22;
      this.laserDamage = 24;
      this.bodyMat.color.setHex(0xd90429);
      this.shipMeshGroup.scale.set(0.85, 0.85, 0.85);
    } else if (shipClass === 'JUGGERNAUT') {
      this.maxHealth = 160;
      this.moveSpeed = 12.5;
      this.laserDamage = 22;
      this.bodyMat.color.setHex(0x3a0ca3);
      this.shipMeshGroup.scale.set(1.3, 1.3, 1.3);
    } else {
      this.maxHealth = 100;
      this.moveSpeed = 16;
      this.laserDamage = 30;
      this.bodyMat.color.setHex(0x2b3a4a);
      this.shipMeshGroup.scale.set(1.0, 1.0, 1.0);
    }
    this.health = this.maxHealth;
  }

  public resetStats(): void {
    this.health = this.maxHealth;
    this.dashStamina = this.maxDashStamina;
    this.ultCharge = 0;
    this.level = 1;
    this.xp = 0;
    this.maxXp = 100;
    this.recoilOffset = 0;
    this.currentWeaponSlot = 1;

    this.fireRateMultiplier = 1.0;
    this.dashCooldownMultiplier = 1.0;
    this.pickupRadius = 5.5;

    this.position.set(0, 4, 0);
    this.velocity.set(0, 0, 0);
    this.group.position.copy(this.position);
  }

  public triggerRecoil(): void {
    if (this.currentWeaponSlot === 2) {
      this.recoilOffset = -0.45; // Heavy shotgun kick
    } else if (this.currentWeaponSlot === 3) {
      this.recoilOffset = -0.30; // Grenade launcher thump
    } else {
      this.recoilOffset = -0.12; // Light rifle tap
    }
    // Muzzle flash spark
    const muzzle = this.getWeaponMuzzlePos();
    const flashColor = this.currentWeaponSlot === 2 ? 0xff6600 : this.currentWeaponSlot === 3 ? 0xffaa00 : 0x00ffff;
    this.particles.emitBurst(muzzle, this.currentWeaponSlot === 2 ? 8 : 4, flashColor, 5, 0.25);
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

    if (this.input.justSwappedWeapon) {
      this.currentWeaponSlot = this.input.selectedWeaponSlot as WeaponSlot;
      this.audio.playPickup();
    }

    this.hoverTime += delta;
    if (this.recoilOffset < 0) {
      this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, delta * 18);
    }

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

      camera.fov = THREE.MathUtils.lerp(camera.fov, 62, delta * 12);
      camera.updateProjectionMatrix();

      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveInput.x * this.moveSpeed, delta * 15);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveInput.y * this.moveSpeed, delta * 15);

      camera.fov = THREE.MathUtils.lerp(camera.fov, 55, delta * 8);
      camera.updateProjectionMatrix();
    }

    ArcadePhysics.integratePosition(this.position, this.velocity, delta, 0.88);

    const terrainY = this.terrain.getHeightAt(this.position.x, this.position.z) + 1.0 + Math.sin(this.hoverTime * 3.5) * 0.1;
    this.position.y = terrainY;

    this.group.position.copy(this.position);

    const aimPoint = this.input.aimPoint;
    tempPlayerLook.set(aimPoint.x, this.position.y, aimPoint.z);
    if (this.position.distanceToSquared(tempPlayerLook) > 0.1) {
      tempTargetMat.lookAt(this.position, tempPlayerLook, new THREE.Vector3(0, 1, 0));
      tempTargetQuat.setFromRotationMatrix(tempTargetMat);
      this.group.quaternion.slerp(tempTargetQuat, delta * 14);
    }

    const targetRoll = -this.velocity.x * 0.015;
    const targetPitch = this.velocity.z * 0.015;
    this.shipMeshGroup.rotation.z = THREE.MathUtils.lerp(this.shipMeshGroup.rotation.z, targetRoll, delta * 12);
    this.shipMeshGroup.rotation.x = THREE.MathUtils.lerp(this.shipMeshGroup.rotation.x, targetPitch, delta * 12);
    this.shipMeshGroup.position.z = this.recoilOffset;

    tempCamTarget.copy(this.position).add(tempCamOffset);
    camera.position.lerp(tempCamTarget, delta * 7);
    camera.lookAt(this.position.x, this.position.y + 0.5, this.position.z);
  }

  public getWeaponMuzzlePos(): THREE.Vector3 {
    tempMuzzlePos.copy(tempMuzzleOffset).applyQuaternion(this.group.quaternion).add(this.group.position);
    return tempMuzzlePos;
  }
}
