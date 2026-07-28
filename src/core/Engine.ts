import * as THREE from 'three';
import { RenderPipeline, type BiomeType } from '../graphics/RenderPipeline';
import { InputManager } from '../core/InputManager';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { InstancedProps } from '../graphics/InstancedProps';
import { InstancedProjectiles } from '../graphics/InstancedProjectiles';
import { InstancedPickups } from '../graphics/InstancedPickups';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { CameraJuice } from '../graphics/CameraJuice';
import { ObjectPool } from '../pooling/ObjectPool';
import { Player, type ShipClass } from '../entities/Player';
import { Enemy, EnemyType } from '../entities/Enemy';
import { BossEnemy } from '../entities/BossEnemy';
import { Projectile, ProjectileType } from '../entities/Projectile';
import { Pickup, PickupType } from '../entities/Pickup';
import { GravityCrystal } from '../entities/GravityCrystal';
import { SpatialHashGrid } from '../utils/SpatialHashGrid';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import { HUD } from '../ui/HUD';
import { MenuSystem, type PerkOption } from '../ui/MenuSystem';

const tempSpawnPos = new THREE.Vector3();
const tempFireDir = new THREE.Vector3();
const tempUpAxis = new THREE.Vector3(0, 1, 0);

export type RiftType = 'OVERCLOCK' | 'GRAVITY_SURGE' | 'BLOODLUST';

interface WaveConfig {
  runners: number;
  spitters: number;
  brutes: number;
  isBossWave?: boolean;
}

export class Engine {
  private renderPipeline: RenderPipeline;
  private input: InputManager;
  private audio: AudioManager;
  private terrain: TerrainGenerator;
  private particles: ParticleSystem;
  private cameraJuice: CameraJuice;

  private player: Player;
  private boss: BossEnemy;
  private enemyPool: ObjectPool<Enemy>;
  private projectilePool: ObjectPool<Projectile>;
  private pickupPool: ObjectPool<Pickup>;
  private gravityCrystalPool: ObjectPool<GravityCrystal>;
  private instancedProjectiles: InstancedProjectiles;
  private instancedPickups: InstancedPickups;
  private spatialGrid: SpatialHashGrid<Enemy>;

  private hud: HUD;
  private menuSystem: MenuSystem;

  private isPlaying: boolean = false;
  private isPausedForUpgrade: boolean = false;
  private isIntermission: boolean = false;
  private intermissionTimer: number = 0;
  private hitStopTimer: number = 0;
  private gameTimer: number = 0;
  private lastTime: number = 0;
  private frameCount: number = 0;

  // Anomaly Rift Event System
  private activeRift: RiftType | null = null;
  private riftTimer: number = 0;

  // Dynamic Combo System
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private comboMult: number = 1;

  // Wave State
  private score: number = 0;
  private wave: number = 1;
  private kills: number = 0;
  private runnersToSpawn: number = 0;
  private spittersToSpawn: number = 0;
  private brutesToSpawn: number = 0;
  private isBossWave: boolean = false;
  private spawnTimer: number = 0;

  private availablePerks: PerkOption[] = [
    { id: 'laser_rate', icon: '⚡', title: 'Laser Pulse Upgrade', description: '+20% Fire Rate & +10 Laser Damage', color: '#00ffff' },
    { id: 'missile_aoe', icon: '💥', title: 'Plasma Warhead', description: '+35% Missile Blast Radius & +40 Damage', color: '#ffaa00' },
    { id: 'thruster_boost', icon: '💨', title: 'Thruster Overclock', description: '-25% Dash CD & +15% Move Speed', color: '#00ffaa' },
    { id: 'hull_repair', icon: '🛡️', title: 'Armor Repair', description: 'Restore 40 HP & Increase Max Armor', color: '#ff0055' },
    { id: 'magnet_field', icon: '💎', title: 'Attraction Field', description: '+50% XP Pickup Collection Range', color: '#aa00ff' }
  ];

  constructor(container: HTMLElement) {
    this.audio = new AudioManager();
    this.renderPipeline = new RenderPipeline(container);

    this.input = new InputManager();
    this.input.setCamera(this.renderPipeline.camera);

    this.input.onPointerLockExited = () => {
      if (this.isPlaying && !this.isPausedForUpgrade) {
        this.isPausedForUpgrade = true;
        this.menuSystem.showStartMenu();
      }
    };

    this.cameraJuice = new CameraJuice(this.renderPipeline.camera);
    this.terrain = new TerrainGenerator(this.renderPipeline.scene);
    new InstancedProps(this.renderPipeline.scene, this.terrain);
    this.particles = new ParticleSystem(this.renderPipeline.scene);
    this.instancedProjectiles = new InstancedProjectiles(this.renderPipeline.scene);
    this.instancedPickups = new InstancedPickups(this.renderPipeline.scene);
    this.spatialGrid = new SpatialHashGrid<Enemy>(6.0);

    this.player = new Player(
      this.renderPipeline.scene,
      this.input,
      this.particles,
      this.audio,
      this.terrain
    );

    this.boss = new BossEnemy(
      this.renderPipeline.scene,
      this.particles,
      this.audio,
      this.terrain
    );

    this.enemyPool = new ObjectPool<Enemy>(() => {
      return new Enemy(
        this.renderPipeline.scene,
        this.particles,
        this.audio,
        this.terrain
      );
    }, 220, 300);

    this.projectilePool = new ObjectPool<Projectile>(() => {
      return new Projectile(
        this.particles,
        this.audio
      );
    }, 150, 400);

    this.pickupPool = new ObjectPool<Pickup>(() => {
      return new Pickup();
    }, 100, 200);

    this.gravityCrystalPool = new ObjectPool<GravityCrystal>(() => {
      return new GravityCrystal(
        this.renderPipeline.scene,
        this.particles,
        this.audio
      );
    }, 10, 20);

    this.hud = new HUD();
    this.menuSystem = new MenuSystem(
      (shipClass) => this.startGame(shipClass),
      () => this.audio.toggleMute(),
      (enabled) => {
        this.renderPipeline.bloomPass.enabled = enabled;
      }
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  private getWaveConfig(wave: number): WaveConfig {
    if (wave === 1) return { runners: 30, spitters: 0, brutes: 0 };
    if (wave === 2) return { runners: 35, spitters: 10, brutes: 0 };
    if (wave === 3) return { runners: 40, spitters: 15, brutes: 5 };
    if (wave === 4) return { runners: 50, spitters: 20, brutes: 10 };
    return { runners: 15, spitters: 8, brutes: 4, isBossWave: true };
  }

  private startGame(shipClass: ShipClass = 'VANGUARD'): void {
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.gameTimer = 0;
    this.frameCount = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMult = 1;
    this.activeRift = null;
    this.riftTimer = 0;
    this.isPausedForUpgrade = false;
    this.isIntermission = false;

    this.enemyPool.releaseAll();
    this.projectilePool.releaseAll();
    this.pickupPool.releaseAll();
    this.gravityCrystalPool.releaseAll();
    this.spatialGrid.clear();
    this.boss.deactivate();
    this.instancedProjectiles.hideAll();
    this.instancedPickups.hideAll();

    this.player.setShipClass(shipClass);
    this.player.resetStats();

    const meta = this.menuSystem.metaUpgrades;
    if (meta.speedLevel > 0) {
      this.player.moveSpeed += this.player.moveSpeed * (meta.speedLevel * 0.05);
    }
    if (meta.healthLevel > 0) {
      this.player.maxHealth += meta.healthLevel * 10;
      this.player.heal(999);
    }

    this.renderPipeline.setBossTheme(false);
    this.hud.showBossHealthBar(false);
    this.hud.resetOnboarding();

    this.setupWave(1);
    this.audio.playWaveStart();
    this.audio.startBackgroundMusic();
    this.lastTime = performance.now();
    this.isPlaying = true;
  }

  private triggerRiftEvent(): void {
    const rifts: RiftType[] = ['OVERCLOCK', 'GRAVITY_SURGE', 'BLOODLUST'];
    this.activeRift = rifts[Math.floor(Math.random() * rifts.length)];
    this.riftTimer = 30.0;
    this.audio.playExplosion();
    this.cameraJuice.addTrauma(0.5);

    if (this.activeRift === 'OVERCLOCK') {
      this.hud.showToast('⚡ ANOMALY: OVERCLOCK RIFT! (2X FIRE RATE / +25% TAKEN DMG)');
    } else if (this.activeRift === 'GRAVITY_SURGE') {
      this.hud.showToast('🌀 ANOMALY: GRAVITY SURGE! (-20% SPEED / 2X XP DROPS)');
    } else if (this.activeRift === 'BLOODLUST') {
      this.hud.showToast('🔥 ANOMALY: NEON BLOODLUST! (-60% DASH CD / +15 HP REGEN KILLS)');
    }
  }

  private setupWave(wave: number): void {
    const config = this.getWaveConfig(wave);
    this.runnersToSpawn = config.runners;
    this.spittersToSpawn = config.spitters;
    this.brutesToSpawn = config.brutes;
    this.isBossWave = !!config.isBossWave;
    this.isIntermission = false;
    this.hud.showIntermission(false);

    this.audio.setWaveIntensity(wave);

    let biome: BiomeType = 'NEON_GRID';
    if (wave === 3 || wave === 4) biome = 'VOLCANO_RED';
    else if (wave >= 5 && !this.isBossWave) biome = 'TOXIC_WASTELAND';
    this.renderPipeline.setBiome(biome);

    if (wave % 2 === 0 && !this.isBossWave) {
      this.triggerRiftEvent();
    } else {
      this.activeRift = null;
    }

    this.gravityCrystalPool.releaseAll();
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 18 + Math.random() * 20;
      const playerPos = this.player.group.position;
      const cx = playerPos.x + Math.cos(angle) * dist;
      const cz = playerPos.z + Math.sin(angle) * dist;
      const cy = this.terrain.getHeightAt(cx, cz) + 1.2;
      this.gravityCrystalPool.get(new THREE.Vector3(cx, cy, cz));
    }

    if (this.isBossWave) {
      const playerPos = this.player.group.position;
      const bossSpawn = new THREE.Vector3(playerPos.x, playerPos.y + 4, playerPos.z - 30);
      this.boss.spawn(bossSpawn);
      this.renderPipeline.setBossTheme(true);
      this.cameraJuice.addTrauma(0.8);
      this.hud.showBossHealthBar(true, this.boss.health, this.boss.maxHealth);
    }
  }

  private spawnWaveEnemy(): void {
    if (this.runnersToSpawn <= 0 && this.spittersToSpawn <= 0 && this.brutesToSpawn <= 0) return;

    let type: EnemyType = EnemyType.RUNNER;
    if (this.brutesToSpawn > 0 && (Math.random() < 0.25 || (this.runnersToSpawn <= 0 && this.spittersToSpawn <= 0))) {
      type = EnemyType.BRUTE;
      this.brutesToSpawn--;
    } else if (this.spittersToSpawn > 0 && (Math.random() < 0.4 || this.runnersToSpawn <= 0)) {
      type = EnemyType.SPITTER;
      this.spittersToSpawn--;
    } else if (this.runnersToSpawn > 0) {
      type = EnemyType.RUNNER;
      this.runnersToSpawn--;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = 35 + Math.random() * 20;
    const playerPos = this.player.group.position;
    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;
    const y = this.terrain.getHeightAt(x, z) + 1.5;

    tempSpawnPos.set(x, y, z);
    this.enemyPool.get(tempSpawnPos, type);
  }

  private handleEnemyDeath(enemy: Enemy): void {
    this.hitStopTimer = 0.030;
    this.comboTimer = 2.5;
    this.comboCount++;
    this.audio.playComboKill(this.comboCount);

    this.comboMult = Math.min(10, 1 + Math.floor(this.comboCount / 3));
    this.score += enemy.scoreValue * this.comboMult;
    this.kills++;
    this.player.addUltCharge(6);

    if (this.activeRift === 'BLOODLUST') {
      this.player.heal(15);
    }

    if (this.comboCount === 2) this.hud.showMultiKillPopup('DOUBLE KILL!');
    else if (this.comboCount === 3) this.hud.showMultiKillPopup('TRIPLE KILL!');
    else if (this.comboCount === 5) this.hud.showMultiKillPopup('OVERKILL!');
    else if (this.comboCount === 10) this.hud.showMultiKillPopup('ZOMBIE EXTINCTION!');

    this.particles.emitDebris(enemy.group.position, 14, 0x800020);
    this.cameraJuice.addTrauma(enemy.type === EnemyType.BRUTE ? 0.4 : 0.2);

    const rand = Math.random();
    if (rand < 0.15) {
      this.pickupPool.get(enemy.group.position, PickupType.HEALTH_PACK, 30);
    } else {
      let xpVal = (enemy.type === EnemyType.BRUTE) ? 45 : (enemy.type === EnemyType.SPITTER) ? 25 : 15;
      if (this.activeRift === 'GRAVITY_SURGE') xpVal *= 2;
      this.pickupPool.get(enemy.group.position, PickupType.XP_ORB, xpVal);
    }
  }

  private triggerCyberNova(): void {
    if (this.player.ultCharge < this.player.maxUltCharge) return;
    this.player.ultCharge = 0;

    const playerPos = this.player.position;
    this.audio.playExplosion();
    this.cameraJuice.addTrauma(0.7);
    this.particles.emitBurst(playerPos, 80, 0xffff00, 18, 1.4);

    const novaRadiusSq = 18.0 * 18.0;
    const activeEnemies = this.enemyPool.getActiveItems();

    for (let i = 0; i < activeEnemies.length; i++) {
      const e = activeEnemies[i];
      if (!e || !e.active) continue;

      const ePos = e.position;
      const dx = ePos.x - playerPos.x;
      const dz = ePos.z - playerPos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < novaRadiusSq) {
        const dist = Math.sqrt(distSq) || 0.1;
        e.velocity.x += (dx / dist) * 28;
        e.velocity.z += (dz / dist) * 28;

        const killed = e.takeDamage(250, ePos);
        if (killed) {
          this.handleEnemyDeath(e);
        }
      }
    }
  }

  private triggerLevelUpModal(): void {
    this.isPausedForUpgrade = true;

    const shuffled = [...this.availablePerks].sort(() => 0.5 - Math.random());
    const selectedOptions = shuffled.slice(0, 3);

    this.menuSystem.showLevelUpModal(this.player.level, selectedOptions, (perkId) => {
      this.applyPerk(perkId);
      this.isPausedForUpgrade = false;
      this.lastTime = performance.now();
    });
  }

  private applyPerk(perkId: string): void {
    if (perkId === 'laser_rate') {
      this.player.fireRateMultiplier *= 0.8;
      this.player.laserDamage += 10;
    } else if (perkId === 'missile_aoe') {
      this.player.missileAOERadius *= 1.35;
      this.player.missileDamage += 40;
    } else if (perkId === 'thruster_boost') {
      this.player.dashCooldownMultiplier *= 0.75;
      this.player.moveSpeed += 2.5;
    } else if (perkId === 'hull_repair') {
      this.player.maxHealth += 20;
      this.player.heal(40);
    } else if (perkId === 'magnet_field') {
      this.player.pickupRadius *= 1.5;
    }
  }

  private firePlayerPrimary(): void {
    if (this.player.primaryCooldown > 0) return;

    let rateMult = this.player.fireRateMultiplier;
    if (this.activeRift === 'OVERCLOCK') rateMult *= 0.5;

    const muzzle = this.player.getWeaponMuzzlePos();
    const aim = this.input.aimPoint;
    tempFireDir.copy(aim).sub(muzzle);
    tempFireDir.y = 0;
    if (tempFireDir.lengthSq() > 0) tempFireDir.normalize();

    this.player.triggerRecoil();

    try {
      if (this.player.currentWeaponSlot === 1) {
        // Slot 1: Assault Rifle - fast cadence, light vibration
        this.player.primaryCooldown = 0.10 * rateMult;
        this.cameraJuice.addTrauma(0.08);
        this.projectilePool.get(muzzle, tempFireDir, 62, ProjectileType.PLAYER_LASER, 30);
      } else if (this.player.currentWeaponSlot === 2) {
        // Slot 2: Shotgun (5-Pellet Cone Spread) - heavy blast
        this.player.primaryCooldown = 0.70 * rateMult;
        this.cameraJuice.addTrauma(0.35);
        this.audio.playShotgunBlast();
        const angles = [-0.22, -0.11, 0, 0.11, 0.22];
        for (let i = 0; i < angles.length; i++) {
          const spreadDir = tempFireDir.clone().applyAxisAngle(tempUpAxis, angles[i]);
          this.projectilePool.get(muzzle, spreadDir, 48, ProjectileType.PLAYER_LASER, 18);
        }
      } else if (this.player.currentWeaponSlot === 3) {
        // Slot 3: Grenade Launcher (AOE Blast)
        this.player.primaryCooldown = 1.20 * rateMult;
        this.cameraJuice.addTrauma(0.45);
        this.projectilePool.get(muzzle, tempFireDir, 32, ProjectileType.PLAYER_MISSILE, 180);
      }
    } catch (err) {
      console.error('Error firing primary weapon:', err);
    }
  }

  private firePlayerSecondary(): void {
    if (this.player.secondaryCooldown > 0) return;
    this.player.secondaryCooldown = 3.5;

    this.player.triggerRecoil();

    const muzzle = this.player.getWeaponMuzzlePos();
    const aim = this.input.aimPoint;
    tempFireDir.copy(aim).sub(muzzle);
    tempFireDir.y = 0;
    if (tempFireDir.lengthSq() > 0) tempFireDir.normalize();

    this.cameraJuice.addTrauma(0.35);
    this.projectilePool.get(muzzle, tempFireDir, 35, ProjectileType.PLAYER_MISSILE, this.player.missileDamage);
  }

  private checkCollisions(): void {
    const activeBullets = this.projectilePool.getActiveItems();
    const activeEnemies = this.enemyPool.getActiveItems();
    const activeCrystals = this.gravityCrystalPool.getActiveItems();
    const playerPos = this.player.position;

    for (let i = 0; i < activeBullets.length; i++) {
      const b = activeBullets[i];
      if (!b || !b.active) continue;

      const bPos = b.position;

      if (b.type === ProjectileType.PLAYER_LASER || b.type === ProjectileType.PLAYER_MISSILE) {
        for (let c = 0; c < activeCrystals.length; c++) {
          const crystal = activeCrystals[c];
          if (!crystal || !crystal.active || crystal.isTriggered) continue;

          const cPos = crystal.position;
          const cdx = bPos.x - cPos.x;
          const cdz = bPos.z - cPos.z;
          if ((cdx * cdx + cdz * cdz) < (crystal.radius + 0.8) * (crystal.radius + 0.8)) {
            b.explode(bPos);
            crystal.trigger();
            break;
          }
        }

        if (this.boss.active) {
          const bossPos = this.boss.position;
          const bdx = bPos.x - bossPos.x;
          const bdz = bPos.z - bossPos.z;
          const bossDistSq = bdx * bdx + bdz * bdz;
          const bossHitRadius = this.boss.radius + 1.2;

          if (bossDistSq < bossHitRadius * bossHitRadius) {
            b.explode(bPos);
            this.particles.emitDamageText(bPos, b.isAOE);

            const defeated = this.boss.takeDamage(b.damage, bPos);
            if (defeated) {
              this.score += 2500;
              this.kills++;
              this.isPlaying = false;
              this.hud.showBossHealthBar(false);
              this.renderPipeline.setBossTheme(false);
              this.menuSystem.showVictoryScreen(this.score, this.gameTimer, this.kills, this.player.level);
            }
            continue;
          }
        }

        const queryRadius = b.isAOE ? this.player.missileAOERadius : 2.0;
        const nearbyEnemies = this.spatialGrid.query(bPos, queryRadius);

        for (let j = 0; j < nearbyEnemies.length; j++) {
          const e = nearbyEnemies[j];
          if (!e || !e.active) continue;

          const ePos = e.position;
          const dx = bPos.x - ePos.x;
          const dz = bPos.z - ePos.z;
          const distSq = dx * dx + dz * dz;
          const hitRadius = e.radius + 0.8;
          const hitRadiusSq = hitRadius * hitRadius;

          if (distSq < hitRadiusSq) {
            this.particles.emitDamageText(ePos, b.isAOE);
            this.audio.playBulletImpact();

            if (this.player.currentWeaponSlot === 2) {
              const dist = Math.sqrt(distSq) || 0.1;
              e.velocity.x += (-dx / dist) * 9.6;
              e.velocity.z += (-dz / dist) * 9.6;
            }

            if (b.isAOE) {
              b.explode(bPos);
              this.cameraJuice.addTrauma(0.5);
              const aoeRadiusSq = this.player.missileAOERadius * this.player.missileAOERadius;

              for (let k = 0; k < nearbyEnemies.length; k++) {
                const nearE = nearbyEnemies[k];
                if (nearE && nearE.active) {
                  const nPos = nearE.position;
                  const ndx = bPos.x - nPos.x;
                  const ndz = bPos.z - nPos.z;
                  if ((ndx * ndx + ndz * ndz) < aoeRadiusSq) {
                    const killed = nearE.takeDamage(b.damage, nearE.position);
                    if (killed) {
                      this.handleEnemyDeath(nearE);
                    }
                  }
                }
              }
            } else {
              b.explode(bPos);
              const killed = e.takeDamage(b.damage, bPos);
              if (killed) {
                this.handleEnemyDeath(e);
              }
            }
            break;
          }
        }
      } else if (b.type === ProjectileType.ENEMY_PLASMA) {
        const dx = bPos.x - playerPos.x;
        const dz = bPos.z - playerPos.z;
        if ((dx * dx + dz * dz) < 1.69) {
          b.explode(bPos);

          let dmg = 20;
          if (this.activeRift === 'OVERCLOCK') dmg *= 1.25;
          this.player.takeDamage(dmg);
          this.cameraJuice.addTrauma(0.4);
        }
      }
    }

    if (this.boss.active) {
      const bossPos = this.boss.position;
      const bdx = bossPos.x - playerPos.x;
      const bdz = bossPos.z - playerPos.z;
      if ((bdx * bdx + bdz * bdz) < (this.boss.radius + 1.0) * (this.boss.radius + 1.0)) {
        let dmg = 25;
        if (this.activeRift === 'OVERCLOCK') dmg *= 1.25;
        this.player.takeDamage(dmg);
        this.cameraJuice.addTrauma(0.6);
      }
    }

    for (let i = 0; i < activeEnemies.length; i++) {
      const e = activeEnemies[i];
      if (!e || !e.active) continue;

      const ePos = e.position;
      const dx = ePos.x - playerPos.x;
      const dz = ePos.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      const minRadiusSq = (e.radius + 0.7) * (e.radius + 0.7);

      if (distSq < minRadiusSq) {
        let dmg = 12 * (e.type === EnemyType.BRUTE ? 2 : 1);
        if (this.activeRift === 'OVERCLOCK') dmg *= 1.25;
        this.player.takeDamage(dmg);
        this.cameraJuice.addTrauma(0.35);
        ArcadePhysics.resolveSoftOverlap(e.position, e.velocity, playerPos, e.radius, this.player.radius, 16.0);
      }
    }
  }

  private updatePickups(delta: number): void {
    const activePickups = this.pickupPool.getActiveItems();
    const playerPos = this.player.position;
    const magRadiusSq = this.player.pickupRadius * this.player.pickupRadius;

    for (let i = 0; i < activePickups.length; i++) {
      const p = activePickups[i];
      if (!p || !p.active) continue;

      p.update(delta);

      const dx = playerPos.x - p.position.x;
      const dz = playerPos.z - p.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < magRadiusSq) {
        const speed = delta * 18;
        p.position.x += dx * speed;
        p.position.z += dz * speed;

        if (distSq < 1.96) {
          if (p.type === PickupType.XP_ORB) {
            const leveledUp = this.player.addXp(p.value);
            if (leveledUp) {
              this.triggerLevelUpModal();
            }
          } else if (p.type === PickupType.HEALTH_PACK) {
            this.player.heal(p.value);
          }
          p.deactivate();
        }
      }
    }

    this.instancedPickups.renderPickups(activePickups, performance.now() / 1000);
  }

  private update(delta: number): void {
    this.frameCount++;
    this.input.update();

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= delta;
      return;
    }

    if (this.input.justMuted) {
      const isEnabled = this.audio.toggleMute();
      this.hud.showToast(isEnabled ? '🔊 AUDIO: UNMUTED' : '🔇 AUDIO: MUTED');
    }

    if (this.input.justRestarted && !this.isPlaying) {
      this.menuSystem.showStartMenu();
    }

    if (this.input.justToggledPause && this.isPlaying) {
      this.isPausedForUpgrade = !this.isPausedForUpgrade;
      if (this.isPausedForUpgrade) {
        this.menuSystem.showStartMenu();
      } else {
        this.lastTime = performance.now();
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMult = 1;
      }
    }

    if (this.riftTimer > 0) {
      this.riftTimer -= delta;
      if (this.riftTimer <= 0) {
        this.activeRift = null;
        this.hud.showToast('✨ ANOMALY RIFT CLOSED');
      }
    }

    const playerPos = this.player.position;

    if (this.isPlaying && !this.isPausedForUpgrade) {
      this.gameTimer += delta;
      const activeEnemies = this.enemyPool.getActiveItems();

      this.spatialGrid.clear();
      for (let i = 0; i < activeEnemies.length; i++) {
        if (activeEnemies[i]) this.spatialGrid.insert(activeEnemies[i]);
      }

      const hasRemainingToSpawn = (this.runnersToSpawn > 0 || this.spittersToSpawn > 0 || this.brutesToSpawn > 0);
      if (hasRemainingToSpawn && activeEnemies.length < 180) {
        this.spawnTimer += delta;
        if (this.spawnTimer >= 0.035) {
          this.spawnTimer = 0;
          this.spawnWaveEnemy();
        }
      }

      const isWaveComplete = (!hasRemainingToSpawn && activeEnemies.length === 0 && (!this.isBossWave || !this.boss.active));
      if (isWaveComplete && !this.isIntermission) {
        this.isIntermission = true;
        this.intermissionTimer = 8.0;
      }

      if (this.isIntermission) {
        this.intermissionTimer -= delta;
        this.hud.showIntermission(true, this.intermissionTimer);

        if (this.intermissionTimer <= 0 || this.input.justDashed) {
          this.wave++;
          this.setupWave(this.wave);
          this.audio.playWaveStart();
        }
      }

      this.player.update(delta, this.renderPipeline.camera);

      if (this.input.isMouseDown) {
        this.firePlayerPrimary();
      }
      if (this.input.isRightMouseDown) {
        this.firePlayerSecondary();
      }
      if (this.input.justFiredUlt) {
        this.triggerCyberNova();
      }

      const activeCrystals = this.gravityCrystalPool.getActiveItems();
      for (let i = 0; i < activeCrystals.length; i++) {
        if (activeCrystals[i]) {
          activeCrystals[i].update(delta, activeEnemies, (deadE) => this.handleEnemyDeath(deadE));
        }
      }

      if (this.boss.active) {
        this.boss.update(
          delta,
          playerPos,
          (origin, dir) => {
            this.projectilePool.get(origin, dir, 24, ProjectileType.ENEMY_PLASMA, 18);
          },
          (pos) => {
            for (let i = 0; i < 4; i++) {
              this.enemyPool.get(pos, EnemyType.RUNNER);
            }
          }
        );
        this.hud.showBossHealthBar(true, this.boss.health, this.boss.maxHealth);
      }

      for (let i = 0; i < activeEnemies.length; i++) {
        if (activeEnemies[i]) {
          activeEnemies[i].updateAI(delta, this.frameCount, playerPos, this.spatialGrid, (origin, dir) => {
            this.projectilePool.get(origin, dir, 22, ProjectileType.ENEMY_PLASMA, 15);
          });
        }
      }

      const activeBullets = this.projectilePool.getActiveItems();
      for (let i = 0; i < activeBullets.length; i++) {
        if (activeBullets[i]) activeBullets[i].update(delta);
      }

      this.instancedProjectiles.renderProjectiles(activeBullets);
      this.updatePickups(delta);
      this.checkCollisions();

      if (this.player.health <= 0) {
        this.isPlaying = false;
        this.cameraJuice.addTrauma(1.0);
        this.renderPipeline.setBossTheme(false);
        this.hud.showBossHealthBar(false);
        this.menuSystem.showGameOver(this.score, this.wave, this.kills);
      }

      this.hud.updateHUD(
        delta,
        this.player.health,
        this.player.maxHealth,
        this.player.dashStamina,
        this.player.maxDashStamina,
        this.player.xp,
        this.player.maxXp,
        this.player.ultCharge,
        this.player.maxUltCharge,
        this.player.level,
        this.score,
        this.wave,
        this.kills,
        this.player.secondaryCooldown,
        this.comboCount,
        this.comboMult
      );

      this.hud.drawMinimap(delta, { x: playerPos.x, z: playerPos.z }, activeEnemies);
      this.hud.updateWeaponSlot(this.player.currentWeaponSlot);
    }

    this.cameraJuice.update(delta, playerPos);
    this.particles.update(delta);
    this.input.clearFrameState();
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp;
    const delta = Math.min(0.033, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(delta);
    this.renderPipeline.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}
