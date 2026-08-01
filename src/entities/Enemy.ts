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

interface Profile {
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

const PROFILES: Record<EnemyType, Profile> = {
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

export class Enemy implements IPoolable {
  public active: boolean = false;
  public group: THREE.Group;
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
  private baseFlesh: number = HEX.flesh;

  private body: THREE.Group;
  private fleshMat!: THREE.MeshStandardMaterial;
  private clothMat!: THREE.MeshStandardMaterial;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private hpBar!: THREE.Mesh;
  private hpBack!: THREE.Mesh;

  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private audio: AudioManager;
  private terrain: TerrainGenerator;

  constructor(scene: THREE.Scene, particles: ParticleSystem, audio: AudioManager, terrain: TerrainGenerator) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;
    this.id = nextEnemyId++;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.body = new THREE.Group();
    this.group.add(this.body);

    this.buildModel();
    this.scene.add(this.group);
  }

  private buildModel(): void {
    this.body.rotation.x = -0.22; // hunched

    this.fleshMat = new THREE.MeshStandardMaterial({ color: HEX.flesh, roughness: 0.95, metalness: 0.0, flatShading: true });
    this.clothMat = new THREE.MeshStandardMaterial({ color: 0x4c4b41, roughness: 1.0, metalness: 0.0, flatShading: true });

    const legGeo = new THREE.BoxGeometry(0.21, 0.62, 0.21);
    const ll = new THREE.Mesh(legGeo, this.clothMat);
    ll.position.set(-0.17, 0.31, 0.04);
    this.body.add(ll);
    const rl = new THREE.Mesh(legGeo, this.clothMat);
    rl.position.set(0.17, 0.31, 0.04);
    this.body.add(rl);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.42), this.clothMat);
    torso.position.y = 0.98;
    torso.castShadow = true;
    this.body.add(torso);

    // Exposed ribs / torn shirt front.
    const wound = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), this.fleshMat);
    wound.position.set(0.04, 0.96, -0.22);
    this.body.add(wound);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), this.fleshMat);
    head.position.set(0, 1.55, -0.06);
    head.rotation.z = 0.14; // lolling
    head.castShadow = true;
    this.body.add(head);

    // Sunken sockets — dark, not glowing.
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x14120e, roughness: 1.0 });
    const socketGeo = new THREE.BoxGeometry(0.09, 0.07, 0.05);
    const ls = new THREE.Mesh(socketGeo, socketMat);
    ls.position.set(-0.09, 1.59, -0.25);
    this.body.add(ls);
    const rs = new THREE.Mesh(socketGeo, socketMat);
    rs.position.set(0.09, 1.59, -0.25);
    this.body.add(rs);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x6b1a1a, roughness: 1.0 }));
    jaw.position.set(0, 1.42, -0.2);
    this.body.add(jaw);

    // Reaching arms.
    const armGeo = new THREE.BoxGeometry(0.15, 0.15, 0.7);
    this.leftArm = new THREE.Mesh(armGeo, this.fleshMat);
    this.leftArm.position.set(-0.38, 1.0, -0.38);
    this.leftArm.rotation.x = Math.PI / 2 - 0.2;
    this.body.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.fleshMat);
    this.rightArm.position.set(0.38, 1.0, -0.38);
    this.rightArm.rotation.x = Math.PI / 2 - 0.1;
    this.body.add(this.rightArm);

    // Damage readout — a scratched strip, only shown once hurt.
    this.hpBack = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x1a1a14, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.hpBack.position.set(0, 2.15, 0);
    this.hpBack.rotation.x = -Math.PI / 3.4;
    this.hpBack.visible = false;
    this.group.add(this.hpBack);

    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.06, 0.07),
      new THREE.MeshBasicMaterial({ color: HEX.blood, side: THREE.DoubleSide })
    );
    this.hpBar.position.set(0, 2.15, 0.012);
    this.hpBar.rotation.x = -Math.PI / 3.4;
    this.hpBar.visible = false;
    this.group.add(this.hpBar);
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
    this.baseFlesh = p.flesh;

    this.fleshMat.color.setHex(p.flesh);
    this.clothMat.color.setHex(p.cloth);

    this.hpBack.visible = false;
    this.hpBar.visible = false;

    this.spawnTimer = 0.22;
    this.group.scale.setScalar(this.baseScale * 0.45);
    this.group.position.copy(spawnPos);
    this.group.visible = true;
    this.active = true;
  }

  public takeDamage(damage: number, hitPoint: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;
    this.hitFlashTimer = 0.07;
    this.fleshMat.color.setHex(0xd8c6b4);

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
      this.hpBack.visible = true;
      this.hpBar.visible = true;
      const ratio = Math.max(0.02, this.health / this.maxHealth);
      this.hpBar.scale.x = ratio;
      this.hpBar.position.x = -(1.06 * (1 - ratio)) / 2;
    }

    if (this.health <= 0) {
      this.active = false;
      this.group.visible = false;
      this.hpBack.visible = false;
      this.hpBar.visible = false;
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
      this.group.scale.setScalar(this.baseScale * (0.45 + 0.55 * t));
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) this.fleshMat.color.setHex(this.baseFlesh);
    }

    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      this.velocity.multiplyScalar(0.86);
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      this.group.position.copy(this.position);
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
        this.group.scale.setScalar(this.baseScale * puff);
        this.fleshMat.color.setHex(Math.floor(frameCount / 4) % 2 === 0 ? 0xc9c06a : this.baseFlesh);

        if (this.swellTimer <= 0) {
          onBurst?.(this);
          this.deactivate();
          return;
        }
        this.group.position.copy(this.position);
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
    this.group.position.copy(this.position);
    this.group.lookAt(playerPos.x, this.position.y, playerPos.z);

    // Shuffling gait: the whole body rocks, arms paw forward out of phase.
    const gait = Math.sin(this.lurch * 1.4);
    this.body.rotation.z = gait * 0.09;
    this.body.position.y = Math.abs(gait) * 0.05;
    this.leftArm.rotation.x = Math.PI / 2 - 0.2 + gait * 0.12;
    this.rightArm.rotation.x = Math.PI / 2 - 0.1 - gait * 0.12;
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
    this.hpBack.visible = false;
    this.hpBar.visible = false;
    this.position.set(0, -9999, 0);
    this.group.position.set(0, -9999, 0);
  }
}
