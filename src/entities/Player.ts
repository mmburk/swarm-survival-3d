import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import { InstancedProps } from '../graphics/InstancedProps';
import { CAMERA_RIG } from '../graphics/CameraRig';
import { HEX } from '../theme/Palette';
import { WEAPONS, WEAPON_ORDER, resolveWeaponStats, type WeaponId, type WeaponStats } from '../config/Weapons';
import type { Enemy } from './Enemy';

const tempLook = new THREE.Vector3();
const tempCamTarget = new THREE.Vector3();
const tempMove = new THREE.Vector2();
const tempMuzzleOffset = new THREE.Vector3();
const tempMuzzlePos = new THREE.Vector3();
const tempHurtOffset = new THREE.Vector3();
const tempTargetQuat = new THREE.Quaternion();
const tempTargetMat = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

export interface ActiveBuff {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}

export class Player {
  public group: THREE.Group;
  public rig: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 0.85;

  // ---- loadout ------------------------------------------------------------
  public weaponId: WeaponId = 'RANGER';
  public weapon: WeaponStats = resolveWeaponStats('RANGER', false);
  public weaponModActive: boolean = false;

  // ---- vitals -------------------------------------------------------------
  public health: number = 100;
  public maxHealth: number = 100;
  public baseMaxHealth: number = 100;
  public stamina: number = 100;
  public maxStamina: number = 100;
  public moveSpeed: number = 8.2;

  /** Fills as you kill; spends on the road flare. */
  public adrenaline: number = 0;
  public maxAdrenaline: number = 100;

  // ---- run modifiers (reset every run, granted by boons) -------------------
  public damageMultiplier: number = 1.0;
  public fireRateMultiplier: number = 1.0;
  public critChance: number = 0.05;
  public critMultiplier: number = 2.0;
  public bonusPierce: number = 0;
  public bulletSpeedMultiplier: number = 1.0;
  public lifestealChance: number = 0;
  public lifestealAmount: number = 0;
  public pickupRadius: number = 5.5;
  public altCooldownMultiplier: number = 1.0;
  public healPotency: number = 1.0;
  /** Chance a killed enemy bursts, damaging its neighbours. */
  public burstChance: number = 0;
  /** Flat damage reduction fraction. */
  public toughness: number = 0;

  public activeBuffs: Map<string, ActiveBuff> = new Map();

  // ---- state --------------------------------------------------------------
  public damageIFrameTimer: number = 0;
  public isInvulnerable: boolean = false;
  public shoveCooldown: number = 0;
  public primaryCooldown: number = 0;
  public altCooldown: number = 0;
  public isDodging: boolean = false;

  public getUpsRemaining: number = 1;
  public maxGetUps: number = 1;

  public onTakeDamage?: () => void;
  public onGetUp?: () => void;
  public onDied?: () => void;

  private dodgeTimer: number = 0;
  private dodgeDir: THREE.Vector3 = new THREE.Vector3();

  private walkCycle: number = 0;
  private recoilOffset: number = 0;
  private flashTimer: number = 0;
  private isFlashed: boolean = false;

  private jacketMat!: THREE.MeshStandardMaterial;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private weaponRigs: Map<WeaponId, THREE.Group> = new Map();

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
    this.rig = new THREE.Group();
    this.group.add(this.rig);

    this.buildSurvivor();
    this.buildWeaponRigs();
    this.setWeapon('RANGER', false);

    this.scene.add(this.group);
  }

  // ---------------------------------------------------------------- visuals

  /** A person in a work jacket and a pack. Faces -Z. */
  private buildSurvivor(): void {
    const boot = new THREE.MeshStandardMaterial({ color: 0x2a2419, roughness: 0.95 });
    const denim = new THREE.MeshStandardMaterial({ color: HEX.denim, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x9c7c5e, roughness: 0.8 });

    const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.26);
    this.leftLeg = new THREE.Mesh(legGeo, denim);
    this.leftLeg.position.set(-0.19, 0.38, 0);
    this.leftLeg.castShadow = true;
    this.rig.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, denim);
    this.rightLeg.position.set(0.19, 0.38, 0);
    this.rightLeg.castShadow = true;
    this.rig.add(this.rightLeg);

    const bootGeo = new THREE.BoxGeometry(0.28, 0.18, 0.36);
    const lb = new THREE.Mesh(bootGeo, boot);
    lb.position.set(-0.19, 0.09, -0.04);
    this.rig.add(lb);
    const rb = new THREE.Mesh(bootGeo, boot);
    rb.position.set(0.19, 0.09, -0.04);
    this.rig.add(rb);

    // Canvas work jacket.
    this.jacketMat = new THREE.MeshStandardMaterial({
      color: 0x5a5236,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.44), this.jacketMat);
    torso.position.y = 1.12;
    torso.castShadow = true;
    this.rig.add(torso);

    // Strapped-on scrap plate, the only "armour" in the game.
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.34, 0.1),
      new THREE.MeshStandardMaterial({ color: HEX.steel, roughness: 0.7, metalness: 0.6, flatShading: true })
    );
    plate.position.set(0, 1.2, -0.25);
    this.rig.add(plate);

    // Backpack.
    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.55, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x4a3f2c, roughness: 1.0 })
    );
    pack.position.set(0, 1.16, 0.34);
    pack.castShadow = true;
    this.rig.add(pack);

    const bedroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b5c3f, roughness: 1.0 })
    );
    bedroll.rotation.z = Math.PI / 2;
    bedroll.position.set(0, 1.44, 0.36);
    this.rig.add(bedroll);

    // Head, hood and a scarf pulled up. No glowing visor anywhere.
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skin);
    head.position.set(0, 1.68, 0);
    head.castShadow = true;
    this.rig.add(head);

    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.26, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4d4630, roughness: 1.0, flatShading: true })
    );
    hood.position.set(0, 1.83, 0.02);
    this.rig.add(hood);

    const scarf = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.14, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x7a3b2c, roughness: 1.0 })
    );
    scarf.position.set(0, 1.53, 0);
    this.rig.add(scarf);

    // Support arm holding the fore-end.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.6, 0.17), this.jacketMat);
    arm.position.set(-0.36, 1.12, -0.28);
    arm.rotation.set(Math.PI / 3.4, -Math.PI / 7, 0);
    this.rig.add(arm);
  }

  /** One small procedural mesh per firearm, only the equipped one is visible. */
  private buildWeaponRigs(): void {
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x24261f, roughness: 0.55, metalness: 0.7, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.85, metalness: 0.05, flatShading: true });
    const tank = new THREE.MeshStandardMaterial({ color: 0x5c6a4a, roughness: 0.8, metalness: 0.4, flatShading: true });

    const make = (id: WeaponId, build: (g: THREE.Group) => void) => {
      const g = new THREE.Group();
      g.position.set(0.33, 1.1, 0);
      build(g);
      g.visible = false;
      this.rig.add(g);
      this.weaponRigs.set(id, g);
    };

    make('RANGER', (g) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 1.15), gunmetal);
      body.position.z = -0.55;
      g.add(body);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.19, 0.42), wood);
      stock.position.z = 0.18;
      g.add(stock);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.14), gunmetal);
      mag.position.set(0, -0.2, -0.35);
      mag.rotation.x = 0.16;
      g.add(mag);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8), gunmetal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.14, -0.42);
      g.add(scope);
    });

    make('BOOMSTICK', (g) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.5), wood);
      body.position.z = -0.18;
      g.add(body);
      const barrel = new THREE.CylinderGeometry(0.055, 0.055, 0.72, 8);
      barrel.rotateX(-Math.PI / 2);
      const lb = new THREE.Mesh(barrel, gunmetal);
      lb.position.set(-0.055, 0.02, -0.6);
      g.add(lb);
      const rb = new THREE.Mesh(barrel, gunmetal);
      rb.position.set(0.055, 0.02, -0.6);
      g.add(rb);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.16), wood);
      grip.position.set(0, -0.16, 0.06);
      grip.rotation.x = -0.3;
      g.add(grip);
    });

    make('WIDOWMAKER', (g) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.72), wood);
      body.position.z = -0.32;
      g.add(body);
      const barrel = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8);
      barrel.rotateX(-Math.PI / 2);
      const b = new THREE.Mesh(barrel, gunmetal);
      b.position.set(0, 0.01, -1.0);
      g.add(b);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.46, 10), gunmetal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.16, -0.42);
      g.add(scope);
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), gunmetal);
      bolt.position.set(0.1, 0.06, -0.05);
      g.add(bolt);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.5), wood);
      stock.position.z = 0.22;
      g.add(stock);
    });

    make('STUTTER', (g) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.46), gunmetal);
      body.position.z = -0.2;
      g.add(body);
      const barrel = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6);
      barrel.rotateX(-Math.PI / 2);
      const b = new THREE.Mesh(barrel, gunmetal);
      b.position.set(0, 0.02, -0.55);
      g.add(b);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.1), gunmetal);
      mag.position.set(0, -0.24, -0.16);
      g.add(mag);
    });

    make('HARVESTER', (g) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.78), tank);
      body.position.z = -0.36;
      g.add(body);
      const barrel = new THREE.CylinderGeometry(0.028, 0.028, 0.7, 6);
      barrel.rotateX(-Math.PI / 2);
      const b = new THREE.Mesh(barrel, gunmetal);
      b.position.set(0, 0.02, -0.95);
      g.add(b);
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 10), tank);
      bottle.rotation.x = Math.PI / 2;
      bottle.position.set(0, -0.16, 0.05);
      g.add(bottle);
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12), gunmetal);
      hose.position.set(0, -0.05, -0.2);
      g.add(hose);
    });
  }

  // ---------------------------------------------------------------- loadout

  public setWeapon(id: WeaponId, modActive: boolean): void {
    this.weaponId = WEAPONS[id] ? id : 'RANGER';
    this.weaponModActive = modActive;
    this.weapon = resolveWeaponStats(this.weaponId, modActive);

    for (const w of WEAPON_ORDER) {
      const rig = this.weaponRigs.get(w);
      if (rig) rig.visible = w === this.weaponId;
    }
    this.primaryCooldown = 0;
    this.altCooldown = 0;
  }

  public get weaponDef() {
    return WEAPONS[this.weaponId];
  }

  public getMuzzlePos(): THREE.Vector3 {
    const z = this.weaponId === 'WIDOWMAKER' ? -1.75
      : this.weaponId === 'BOOMSTICK' ? -0.98
      : this.weaponId === 'HARVESTER' ? -1.3
      : this.weaponId === 'STUTTER' ? -0.74
      : -1.15;
    tempMuzzleOffset.set(0.33, 1.1, z);
    tempMuzzlePos.copy(tempMuzzleOffset).applyQuaternion(this.group.quaternion).add(this.position);
    return tempMuzzlePos;
  }

  // ---------------------------------------------------------------- run state

  /**
   * Wipes everything a boon could have touched and re-applies the permanent
   * workbench ranks. Called once at the start of each run.
   */
  public beginRun(opts: {
    weaponId: WeaponId;
    weaponMod: boolean;
    bonusHealth: number;
    bonusSpeed: number;
    fireRateBonus: number;
    critBonus: number;
    pickupBonus: number;
    healBonus: number;
    extraGetUps: number;
  }): void {
    this.setWeapon(opts.weaponId, opts.weaponMod);

    this.baseMaxHealth = 100 + opts.bonusHealth;
    this.maxHealth = this.baseMaxHealth;
    this.health = this.maxHealth;

    this.moveSpeed = 8.2 + opts.bonusSpeed;
    this.stamina = this.maxStamina;
    this.adrenaline = 0;

    this.damageMultiplier = 1.0;
    this.fireRateMultiplier = Math.max(0.4, 1.0 - opts.fireRateBonus);
    this.critChance = 0.05 + opts.critBonus;
    this.critMultiplier = 2.0;
    this.bonusPierce = 0;
    this.bulletSpeedMultiplier = 1.0;
    this.lifestealChance = 0;
    this.lifestealAmount = 0;
    this.pickupRadius = 5.5 + opts.pickupBonus;
    this.altCooldownMultiplier = 1.0;
    this.healPotency = 1.0 + opts.healBonus;
    this.burstChance = 0;
    this.toughness = 0;

    this.maxGetUps = 1 + opts.extraGetUps;
    this.getUpsRemaining = this.maxGetUps;

    this.damageIFrameTimer = 0;
    this.isInvulnerable = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.primaryCooldown = 0;
    this.altCooldown = 0;
    this.shoveCooldown = 0;
    this.activeBuffs.clear();
    this.jacketMat.color.setHex(0x5a5236);
  }

  public addBuff(id: string, name: string, icon: string, color: string): void {
    const existing = this.activeBuffs.get(id);
    if (existing) {
      existing.count++;
    } else {
      this.activeBuffs.set(id, { id, name, icon, count: 1, color });
    }
  }

  public getActiveBuffList(): ActiveBuff[] {
    return Array.from(this.activeBuffs.values());
  }

  public resetPositionAndVelocity(pos?: THREE.Vector3): void {
    if (pos) this.position.copy(pos);
    else this.position.set(0, 1, 0);

    this.velocity.set(0, 0, 0);
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.group.position.copy(this.position);
  }

  public clampToBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    let clamped = false;
    if (this.position.x < minX) { this.position.x = minX; clamped = true; }
    if (this.position.x > maxX) { this.position.x = maxX; clamped = true; }
    if (this.position.z < minZ) { this.position.z = minZ; clamped = true; }
    if (this.position.z > maxZ) { this.position.z = maxZ; clamped = true; }

    if (clamped) {
      this.velocity.set(0, 0, 0);
      if (this.isDodging) {
        this.isDodging = false;
        this.dodgeTimer = 0;
      }
      this.group.position.copy(this.position);
    }
  }

  // ---------------------------------------------------------------- combat

  public triggerRecoil(): void {
    this.recoilOffset = Math.min(0.5, this.weapon.recoil);
    const muzzle = this.getMuzzlePos();
    this.particles.emitBurst(muzzle, this.weapon.pellets > 3 ? 7 : 3, HEX.muzzle, 5, 0.2);
  }

  public addAdrenaline(amount: number): void {
    this.adrenaline = Math.min(this.maxAdrenaline, this.adrenaline + amount);
  }

  public heal(amount: number): void {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount * this.healPotency);
    if (this.health > before) this.audio.playPickup();
  }

  /** Boot to the chest: knocks the nearest bodies off you and stuns them. */
  public shove(enemies: Enemy[]): boolean {
    if (this.shoveCooldown > 0) return false;
    this.shoveCooldown = 5.0;
    this.audio.playShove();
    this.particles.emitShockwave(this.position, 5.0, HEX.smoke);

    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
    let hits = 0;

    for (const e of enemies) {
      if (!e.active) continue;
      const dx = e.position.x - this.position.x;
      const dz = e.position.z - this.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 30.25) continue; // 5.5m

      const d = Math.sqrt(d2) || 1;
      // Anything vaguely in front takes the full hit; behind you it is a nudge.
      const facingDot = (dx / d) * facing.x + (dz / d) * facing.z;
      const force = facingDot > 0.1 ? 26 : 10;

      e.velocity.x += (dx / d) * force;
      e.velocity.z += (dz / d) * force;
      e.stunTimer = facingDot > 0.1 ? 1.4 : 0.6;
      e.takeDamage(12, this.position);
      hits++;
    }

    if (hits > 0) this.particles.emitBurst(this.position, 10, HEX.smoke, 7, 0.4);
    return true;
  }

  public takeDamage(damage: number): void {
    if (this.isInvulnerable || this.isDodging || this.damageIFrameTimer > 0 || this.health <= 0) return;

    const reduced = Math.max(1, Math.round(damage * (1 - this.toughness)));

    if (this.health - reduced <= 0 && this.getUpsRemaining > 0) {
      this.getUpsRemaining--;
      this.health = Math.floor(this.maxHealth * 0.45);
      this.damageIFrameTimer = 2.2;
      this.isInvulnerable = true;
      this.audio.playGetUp();
      this.particles.emitExplosion(this.position, 8.0, HEX.amber);
      this.onGetUp?.();
      return;
    }

    this.health = Math.max(0, this.health - reduced);
    this.damageIFrameTimer = 0.45;
    this.isInvulnerable = true;
    this.audio.playPlayerHurt();

    tempHurtOffset.copy(this.group.position).setY(this.group.position.y + 1.1);
    this.particles.emitBurst(tempHurtOffset, 12, HEX.gore, 7, 0.34);

    this.onTakeDamage?.();
    if (this.health <= 0) this.onDied?.();
  }

  // ---------------------------------------------------------------- tick

  public update(delta: number, camera: THREE.OrthographicCamera, allowMove: boolean = true): void {
    if (this.primaryCooldown > 0) this.primaryCooldown -= delta;
    if (this.altCooldown > 0) this.altCooldown -= delta;
    if (this.shoveCooldown > 0) this.shoveCooldown = Math.max(0, this.shoveCooldown - delta);
    if (this.recoilOffset > 0) this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, delta * 16);

    // Hit flash — the jacket goes pale for a few frames instead of strobing red.
    if (this.damageIFrameTimer > 0) {
      this.damageIFrameTimer = Math.max(0, this.damageIFrameTimer - delta);
      this.flashTimer += delta;
      if (this.flashTimer >= 0.05) {
        this.flashTimer = 0;
        this.isFlashed = !this.isFlashed;
        this.jacketMat.color.setHex(this.isFlashed ? 0x9b2f2f : 0x5a5236);
      }
      if (this.damageIFrameTimer <= 0) {
        this.isInvulnerable = false;
        this.jacketMat.color.setHex(0x5a5236);
      }
    }

    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 38);
    }

    // Input is read in screen space and rotated into the world, so pushing
    // "up" always walks away from the camera even when the rig is swung round
    // to a corner (the shelter). On open ground the rig is dead-on and this is
    // an identity.
    const move = allowMove ? this.input.getMoveVector() : { x: 0, y: 0 };
    CAMERA_RIG.toWorld(move.x, move.y, tempMove);
    const moveX = tempMove.x;
    const moveZ = tempMove.y;

    if (allowMove && this.input.justDashed && this.stamina >= 34 && !this.isDodging) {
      this.isDodging = true;
      this.dodgeTimer = 0.24;
      this.stamina -= 34;
      this.audio.playDodge();

      if (moveX !== 0 || moveZ !== 0) {
        this.dodgeDir.set(moveX, 0, moveZ).normalize();
      } else {
        this.dodgeDir.set(0, 0, -1).applyQuaternion(this.group.quaternion).normalize();
      }
    }

    if (this.isDodging) {
      this.dodgeTimer -= delta;
      this.velocity.x = this.dodgeDir.x * 21;
      this.velocity.z = this.dodgeDir.z * 21;
      this.particles.emitTrail(this.position, HEX.smoke);

      // The dash punch. An ortho camera has no field of view to flare, so the
      // same beat is played on zoom instead: below 1 the frame takes in more
      // world, which is the pull-back you feel when you roll.
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, 0.93, delta * 12);
      camera.updateProjectionMatrix();

      if (this.dodgeTimer <= 0) this.isDodging = false;
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveX * this.moveSpeed, delta * 15);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveZ * this.moveSpeed, delta * 15);

      camera.zoom = THREE.MathUtils.lerp(camera.zoom, 1, delta * 8);
      camera.updateProjectionMatrix();
    }

    ArcadePhysics.integratePosition(this.position, this.velocity, delta, 0.88);

    for (const o of InstancedProps.obstacles) {
      ArcadePhysics.resolveSolidObstacle(this.position, this.radius, o);
    }

    this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    // Face the cursor.
    const aim = this.input.aimPoint;
    tempLook.set(aim.x, this.position.y, aim.z);
    if (this.position.distanceToSquared(tempLook) > 0.1) {
      tempTargetMat.lookAt(this.position, tempLook, UP);
      tempTargetQuat.setFromRotationMatrix(tempTargetMat);
      this.group.quaternion.slerp(tempTargetQuat, delta * 15);
    }

    // Walk cycle — legs swing while moving, settle when still.
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.6) {
      this.walkCycle += delta * (5.5 + speed * 0.55);
      const swing = Math.sin(this.walkCycle) * 0.34;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.rig.position.y = Math.abs(Math.sin(this.walkCycle)) * 0.045;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 10);
      this.rig.position.y = THREE.MathUtils.lerp(this.rig.position.y, 0, delta * 10);
    }

    this.rig.rotation.z = THREE.MathUtils.lerp(this.rig.rotation.z, -this.velocity.x * 0.012, delta * 10);
    this.rig.position.z = this.recoilOffset;

    tempCamTarget.copy(this.position).add(CAMERA_RIG.offset);
    camera.position.lerp(tempCamTarget, delta * 7);
    camera.lookAt(this.position.x, this.position.y + CAMERA_RIG.lookHeight, this.position.z);
  }
}
