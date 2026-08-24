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
  BURSTER: 'BURSTER',
  /** Keeps its distance and calls the street down on you. */
  SCREAMER: 'SCREAMER',
  /** Gets hold of you and does not let go. */
  CLINGER: 'CLINGER'
} as const;

export type EnemyType = typeof EnemyType[keyof typeof EnemyType];

export interface Profile {
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

export const PROFILES: Record<EnemyType, Profile> = {
  SHAMBLER: { health: 34, speed: 2.6, radius: 0.85, contact: 12, score: 100, scrap: 1, scale: 0.95, flesh: HEX.flesh, cloth: 0x4c4b41 },
  SPRINTER: { health: 22, speed: 7.4, radius: 0.78, contact: 15, score: 150, scrap: 1, scale: 0.85, flesh: 0x9c8a72, cloth: 0x5e3730 },
  BLOATER: { health: 60, speed: 3.0, radius: 1.0, contact: 10, score: 190, scrap: 2, scale: 1.05, flesh: 0x7d8a5c, cloth: 0x3f4a34 },
  BUTCHER: { health: 210, speed: 2.9, radius: 1.55, contact: 26, score: 360, scrap: 4, scale: 1.65, flesh: 0x6f7259, cloth: 0x53372b },
  BURSTER: { health: 40, speed: 4.6, radius: 0.95, contact: 22, score: 230, scrap: 2, scale: 1.0, flesh: 0x8f9152, cloth: 0x4a4a2c },
  // Thin, and worth more than it can do to you by itself. Everything a
  // Screamer costs the player arrives afterwards.
  SCREAMER: { health: 25, speed: 3.4, radius: 0.78, contact: 8, score: 260, scrap: 3, scale: 0.92, flesh: 0xb0a894, cloth: 0x6a5f52 },
  // Low contact damage on purpose: what a Clinger costs you is the seconds,
  // not the bite. Everything else on the street is what actually hurts.
  CLINGER: { health: 55, speed: 5.2, radius: 0.8, contact: 6, score: 240, scrap: 2, scale: 0.95, flesh: 0x8a7a63, cloth: 0x453a30 }
};

/** How close a Clinger has to get before it throws itself at you. */
export const GRAB_RANGE = 1.9;
/** The lunge before the hold lands. Rolling through this is the free answer. */
export const GRAB_WINDUP = 0.35;
/** And how long before the same one can try again. */
const GRAB_COOLDOWN = 6.0;

/** How far out a Screamer tries to stand. Inside every weapon's range but one. */
const SCREAM_STANDOFF = 15.0;
/** Seconds of winding up before it lets go. The whole of the counter-play. */
const SCREAM_WINDUP = 1.2;
/** And how long before it can do it again. */
const SCREAM_COOLDOWN = 9.0;

const tempSteer = new THREE.Vector3();
const tempTarget = new THREE.Vector3();
const tempAvoid = new THREE.Vector3();

let nextEnemyId = 1;

/**
 * One of the dead. State only — no meshes.
 *
 * The body used to be a scene graph of its own, and with fifty of them upright
 * that was three quarters of the frame's draw calls and a thousand idle
 * matrices being recomposed for pooled copies that were nowhere. Everything
 * below the AI is now the handful of numbers InstancedEnemies needs to draw
 * one: where it is, which way it is facing, how far through its shuffle it is.
 */
export class Enemy implements IPoolable {
  public active: boolean = false;
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
   * A Screamer's lungs filling. Counts down to the shout; killing it first is
   * the entire point of the type, so nothing else about it may be urgent.
   */
  public isScreaming: boolean = false;
  public screamTimer: number = 0;
  /** Seconds until it is allowed to try again. */
  private screamCooldown: number = 0;

  /**
   * A Clinger's lunge, and then its hold.
   *
   * `grabbing` is read from two other files: the engine glues the body to the
   * player and stops the ordinary contact pass touching it, and the companion
   * scores it far above anything else when it picks a target — an animal that
   * ignores the thing holding you is not a companion, it is scenery.
   */
  public isLunging: boolean = false;
  public lungeTimer: number = 0;
  public grabbing: boolean = false;
  private grabCooldown: number = 0;

  // ---- what the renderer reads --------------------------------------------

  /** Facing, in radians about Y. Held between frames: a stunned or swelling
   *  body stops turning and keeps whichever way it was last pointed. */
  public yaw: number = 0;
  /** Uniform scale, carrying the spawn pop-in and a Burster's swell. */
  public renderScale: number = 0.95;
  /** Phase of the shuffle, driving the body rock and the arm swing. */
  public gait: number = 0;
  /** Pale for a few frames after being hit. */
  public flashing: boolean = false;
  /** A Burster's gas building. */
  public hot: boolean = false;
  public hpVisible: boolean = false;
  public hpRatio: number = 1;

  /**
   * Set by the engine when a sector is nearly clear. Ranged types normally
   * kite, which means the last Bloater alive can park itself outside the
   * player's patience and stall the sector forever. When this is on they stop
   * backing away and come to you.
   */
  public pressAttack: boolean = false;

  /**
   * Whether it is this one's turn to press the attack.
   *
   * A street of forty bodies all running the shortest line at the player is
   * one wall of teeth arriving at once: nothing to read, nothing to step
   * around, and the difference between five of them and thirty is only how
   * fast the health bar goes. The engine hands turns out to a few at a time
   * (`Engine.updateTurns`); everything else closes to its own ring and circles
   * there, waiting for a gap. What the player sees is a crowd that keeps
   * coming in relays rather than in one lump.
   */
  public engaged: boolean = false;
  /** Seconds this turn has been running. Ticked by the engine. */
  public turnTimer: number = 0;
  /** Seconds it has to hang back before it can be given another turn. */
  public restTimer: number = 0;

  /** How far out it holds while it is waiting. Metres. */
  public standoff: number = 9;

  /** Which shoulder it comes round, and how wide the arc is. */
  private flankSign: number = 1;
  private flankBend: number = 0.5;
  /** Which way round it circles while it waits. */
  private orbitSign: number = 1;

  private attackTimer: number = 0;
  private hitFlashTimer: number = 0;
  private spawnTimer: number = 0;
  private baseScale: number = 1.0;
  private lurch: number = 0;

  private particles: ParticleSystem;
  private audio: AudioManager;
  private terrain: TerrainGenerator;

  constructor(particles: ParticleSystem, audio: AudioManager, terrain: TerrainGenerator) {
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;
    this.id = nextEnemyId++;
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
    this.isScreaming = false;
    this.screamTimer = 0;
    // Staggered so two that walk in together do not shout together.
    this.screamCooldown = 1.5 + Math.random() * 2.5;
    this.isLunging = false;
    this.lungeTimer = 0;
    this.grabbing = false;
    this.grabCooldown = 0;
    this.pressAttack = false;
    this.lurch = Math.random() * Math.PI * 2;

    this.engaged = false;
    this.turnTimer = 0;
    this.restTimer = 0;
    this.standoff = 7.5 + Math.random() * 5.5;
    this.flankSign = Math.random() < 0.5 ? -1 : 1;
    this.orbitSign = Math.random() < 0.5 ? -1 : 1;
    // A sprinter's whole read is the straight line it picks; a shambler has
    // all night, so it can afford to come the long way round.
    this.flankBend = (type === EnemyType.SPRINTER ? 0.2 : type === EnemyType.BUTCHER ? 0.34 : 0.62)
      * (0.7 + Math.random() * 0.6);

    this.maxHealth = Math.round(p.health * difficulty.health);
    this.health = this.maxHealth;
    this.moveSpeed = p.speed * difficulty.speed;
    this.radius = p.radius;
    this.contactDamage = p.contact;
    this.scoreValue = p.score;
    this.scrapValue = p.scrap;
    this.baseScale = p.scale;

    this.flashing = false;
    this.hot = false;
    this.hpVisible = false;
    this.hpRatio = 1;
    this.gait = 0;
    this.yaw = 0;

    this.spawnTimer = 0.22;
    this.renderScale = this.baseScale * 0.45;
    this.active = true;
  }

  public takeDamage(damage: number, hitPoint: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;
    this.hitFlashTimer = 0.07;
    this.flashing = true;

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
      this.hpVisible = true;
      this.hpRatio = Math.max(0.02, this.health / this.maxHealth);
    }

    if (this.health <= 0) {
      this.active = false;
      this.hpVisible = false;
      this.flashing = false;
      // Shot mid-breath, or mid-lunge. Nothing comes of either — that is the
      // whole trade both types are offering.
      this.isScreaming = false;
      this.isLunging = false;
      this.grabbing = false;
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
    onBurst?: (enemy: Enemy) => void,
    onScream?: (enemy: Enemy) => void,
    /** Return true if the hold took. Refused if something already has them. */
    onGrab?: (enemy: Enemy) => boolean
  ): void {
    if (!this.active) return;

    if (this.spawnTimer > 0) {
      this.spawnTimer -= delta;
      const t = Math.min(1, 1 - this.spawnTimer / 0.22);
      this.renderScale = this.baseScale * (0.45 + 0.55 * t);
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) this.flashing = false;
    }

    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      this.velocity.multiplyScalar(0.86);
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
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
        this.renderScale = this.baseScale * puff;
        // Pulses hotter as the gas builds — the tell that it is about to go.
        this.hot = Math.floor(frameCount / 4) % 2 === 0;

        if (this.swellTimer <= 0) {
          onBurst?.(this);
          this.deactivate();
          return;
        }
        return;
      }
    }

    // A Clinger closes like anything else and then throws itself at you.
    //
    // Held, it is doing nothing — no damage of its own worth the name. What it
    // is doing is standing you still in the middle of a street that was only
    // survivable because you were moving, which is the whole reason a crowd
    // game needs one of these.
    if (this.type === EnemyType.CLINGER) {
      if (this.grabCooldown > 0) this.grabCooldown -= delta;

      // Latched. The engine owns where the body is now and when it lets go.
      if (this.grabbing) {
        this.velocity.set(0, 0, 0);
        this.gait = 0;
        this.yaw = Math.atan2(this.position.x - playerPos.x, this.position.z - playerPos.z);
        return;
      }

      if (this.isLunging) {
        this.lungeTimer -= delta;
        // Committed: it keeps the line it picked, so stepping out of the way
        // works and standing still does not.
        this.position.x += this.velocity.x * delta;
        this.position.z += this.velocity.z * delta;
        this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z);
        this.yaw = Math.atan2(this.position.x - playerPos.x, this.position.z - playerPos.z);
        this.hot = true;

        if (this.lungeTimer <= 0) {
          this.isLunging = false;
          this.hot = false;
          // Close enough on arrival, and nothing else already has them.
          if (this.position.distanceTo(playerPos) <= GRAB_RANGE && onGrab?.(this)) {
            this.grabbing = true;
          } else {
            this.grabCooldown = GRAB_COOLDOWN * 0.5;
          }
        }
        return;
      }

      if (this.grabCooldown <= 0 && this.engaged &&
          this.position.distanceTo(playerPos) <= GRAB_RANGE * 1.9) {
        this.isLunging = true;
        this.lungeTimer = GRAB_WINDUP;
        this.grabCooldown = GRAB_COOLDOWN;
        // Thrown at where they are, not tracked to where they will be.
        tempSteer.copy(playerPos).sub(this.position).setY(0);
        if (tempSteer.lengthSq() > 0) tempSteer.normalize();
        this.velocity.x = tempSteer.x * 13;
        this.velocity.z = tempSteer.z * 13;
        this.audio.playSwell();
        return;
      }
    }

    // A Screamer's whole job is the second and a bit before the noise.
    //
    // It stands further out than anything else on the street, which is what
    // makes it a decision rather than an event: it is always reachable, but
    // reaching it means turning away from whatever is already on you. Killed
    // during the wind-up, nothing happens at all.
    if (this.type === EnemyType.SCREAMER) {
      if (this.screamCooldown > 0) this.screamCooldown -= delta;

      if (this.isScreaming) {
        this.velocity.multiplyScalar(0.82);
        this.screamTimer -= delta;
        // Draws itself up as the lungs fill, and flashes faster the closer it
        // gets — the same language the Burster's gas already speaks.
        const t = 1 - this.screamTimer / SCREAM_WINDUP;
        this.renderScale = this.baseScale * (1 + t * 0.22);
        this.hot = Math.floor(frameCount / (t > 0.6 ? 3 : 6)) % 2 === 0;

        this.position.x += this.velocity.x * delta;
        this.position.z += this.velocity.z * delta;
        this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z);
        this.yaw = Math.atan2(this.position.x - playerPos.x, this.position.z - playerPos.z);

        if (this.screamTimer <= 0) {
          this.isScreaming = false;
          this.hot = false;
          this.renderScale = this.baseScale;
          this.screamCooldown = SCREAM_COOLDOWN;
          onScream?.(this);
        }
        return;
      }

      // Only shouts once it is standing where it means to stand, so the
      // wind-up never starts in the middle of a walk the player cannot read.
      const gap = this.position.distanceTo(playerPos);
      if (this.screamCooldown <= 0 && gap > SCREAM_STANDOFF * 0.6) {
        this.isScreaming = true;
        this.screamTimer = SCREAM_WINDUP;
        this.audio.playSwell();
        return;
      }
    }

    tempTarget.copy(playerPos);

    const toPlayerX = playerPos.x - this.position.x;
    const toPlayerZ = playerPos.z - this.position.z;
    const distance = Math.hypot(toPlayerX, toPlayerZ) || 0.0001;

    // Screamers back away to their own working distance and stay there. They
    // never take an attack lane — see `closingIn` below.
    if (this.type === EnemyType.SCREAMER && !this.pressAttack) {
      if (distance < SCREAM_STANDOFF) {
        tempTarget.subVectors(this.position, playerPos).add(this.position);
      }
    }

    // Bloaters hold a lane and spit bile from range.
    if (this.type === EnemyType.BLOATER) {
      const d2 = distance * distance;
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

    // Bloaters are the exception to both halves of this: they are a ranged
    // type that already has its own idea of where to stand. The mop-up flag
    // takes the waiting away but not the arc — at the end of a street nothing
    // is allowed to stand off, but nothing has to run at you down a ruler
    // either.
    const closingIn = this.type !== EnemyType.BLOATER && this.type !== EnemyType.SCREAMER;

    if (closingIn && !this.engaged && !this.pressAttack) {
      // Waiting its turn. Closes to its own ring, then walks round it — near
      // enough to be a threat and to be shot at, far enough to leave the
      // player a line out.
      const gap = distance - this.standoff;
      const radial = Math.max(-1, Math.min(1, gap * 0.35));
      const tangentX = -tempSteer.z * this.orbitSign;
      const tangentZ = tempSteer.x * this.orbitSign;

      tempSteer.x = tempSteer.x * radial + tangentX * 0.85;
      tempSteer.z = tempSteer.z * radial + tangentZ * 0.85;
      if (tempSteer.lengthSq() > 0) tempSteer.normalize();
    } else if (closingIn) {
      // Its turn: comes in on an arc rather than down the sightline. The bend
      // is widest out at the edge of the ring and gone by the time it is on
      // top of you, so the last few metres are still a straight charge.
      const bend = this.flankSign * this.flankBend *
        Math.max(0, Math.min(1, (distance - 3) / 12));
      if (bend !== 0) {
        const c = Math.cos(bend);
        const sn = Math.sin(bend);
        const sx = tempSteer.x * c - tempSteer.z * sn;
        const sz = tempSteer.x * sn + tempSteer.z * c;
        tempSteer.x = sx;
        tempSteer.z = sz;
      }
    }

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

    // Turns to face the player, spun about Y only.
    //
    // This is a half turn from what the scene graph used to do, and the half
    // turn is the point: the body was steered with Object3D.lookAt, which
    // swaps its arguments for anything that is not a camera or a light and so
    // lays +Z along the line to the target rather than -Z. Every zombie in the
    // game has been shambling at you backwards -- jaw, eye sockets and the two
    // arms reaching out all sit on the model's -Z, which was pointing away.
    this.yaw = Math.atan2(this.position.x - playerPos.x, this.position.z - playerPos.z);

    this.gait = Math.sin(this.lurch * 1.4);
  }

  public deactivate(): void {
    this.active = false;
    this.hpVisible = false;
    this.flashing = false;
    this.hot = false;
    this.isScreaming = false;
    this.isLunging = false;
    this.grabbing = false;
    this.position.set(0, -9999, 0);
  }
}
