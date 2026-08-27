import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { SpatialHashGrid } from '../utils/SpatialHashGrid';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import { InstancedProps } from '../graphics/InstancedProps';
import { HEX } from '../theme/Palette';
import { VEST_SOAK, FRENZY_SPEED, FRENZY_DURATION, MARK_SCRAP_BONUS, MARK_SCORE_MULTIPLIER, type MarkId } from '../config/Marks';

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

/**
 * A band a number is drawn from, once, when a body walks in.
 *
 * Hades has almost no timing that is a single figure: `PreAttackDurationMin`
 * and `Max`, `PostAttackCooldownMin` and `Max`, `AIMoveWithinRangeTimeoutMin`
 * and `Max`. Ours were all single figures, and the whole job of keeping a
 * crowd from moving as one block was being done by one sine phase offset. A
 * band per body does it in every dimension at once and costs a `Math.random`
 * at spawn.
 */
export type Range = readonly [number, number];

function roll(r: Range): number {
  return r[0] + Math.random() * (r[1] - r[0]);
}

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

  /** Personal pace, as a multiplier on `speed`. Nothing walks at the average. */
  pace: Range;
  /** How far out this one holds while it waits its turn. */
  standoff: Range;
  /** How long it presses once it has a lane, and how long it hangs back after. */
  turn: Range;
  rest: Range;
  /**
   * The pause before it does its thing, and the wait afterwards.
   *
   * Live today for the four types that have a timed action of their own — the
   * Screamer's breath, the Clinger's lunge, the Burster's swell, the Bloater's
   * spit. The rest carry them for the melee wind-up in phase 1 of the AI plan,
   * which is what turns contact damage into something you can see coming.
   */
  windup: Range;
  recover: Range;
}

export const PROFILES: Record<EnemyType, Profile> = {
  SHAMBLER: {
    health: 34, speed: 2.6, radius: 0.85, contact: 12, score: 100, scrap: 1, scale: 0.95,
    flesh: HEX.flesh, cloth: 0x4c4b41,
    // The widest pace band on the street. It is the type there are thirty of,
    // so it is the type where everything walking in step is most obvious.
    pace: [0.84, 1.16], standoff: [7.5, 13.0], turn: [5.5, 7.5], rest: [3.0, 4.2],
    windup: [0.34, 0.5], recover: [1.0, 1.7]
  },
  SPRINTER: {
    health: 22, speed: 7.4, radius: 0.78, contact: 15, score: 150, scrap: 1, scale: 0.85,
    flesh: 0x9c8a72, cloth: 0x5e3730,
    // Waits further out and takes a short lane: in fast, out fast, round again.
    pace: [0.93, 1.07], standoff: [9.0, 14.0], turn: [3.5, 5.5], rest: [2.2, 3.4],
    windup: [0.22, 0.32], recover: [0.7, 1.1]
  },
  BLOATER: {
    health: 60, speed: 3.0, radius: 1.0, contact: 10, score: 190, scrap: 2, scale: 1.05,
    flesh: 0x7d8a5c, cloth: 0x3f4a34,
    // `recover` is its spit cadence. It never takes a lane, so turn and rest
    // are along for the ride.
    pace: [0.9, 1.1], standoff: [12.0, 14.0], turn: [5.5, 7.5], rest: [3.0, 4.2],
    windup: [0.4, 0.6], recover: [2.2, 3.2]
  },
  BUTCHER: {
    health: 210, speed: 2.9, radius: 1.55, contact: 26, score: 360, scrap: 4, scale: 1.65,
    flesh: 0x6f7259, cloth: 0x53372b,
    // Holds its lane far longer than anything else and stands closer while it
    // waits. A wall that rotates out every six seconds is not a wall.
    pace: [0.95, 1.05], standoff: [6.5, 9.0], turn: [7.5, 10.0], rest: [4.0, 6.0],
    windup: [0.5, 0.7], recover: [1.6, 2.4]
  },
  BURSTER: {
    health: 40, speed: 4.6, radius: 0.95, contact: 22, score: 230, scrap: 2, scale: 1.0,
    flesh: 0x8f9152, cloth: 0x4a4a2c,
    // `windup` is the swell. Varying it is the difference between learning the
    // tell and learning a stopwatch.
    pace: [0.9, 1.12], standoff: [8.0, 12.0], turn: [5.0, 7.0], rest: [3.0, 4.2],
    windup: [0.72, 0.98], recover: [1.0, 1.6]
  },
  // Thin, and worth more than it can do to you by itself. Everything a
  // Screamer costs the player arrives afterwards.
  SCREAMER: {
    health: 25, speed: 3.4, radius: 0.78, contact: 8, score: 260, scrap: 3, scale: 0.92,
    flesh: 0xb0a894, cloth: 0x6a5f52,
    // Stands further out than anything else, and never takes a lane.
    pace: [0.9, 1.1], standoff: [14.0, 16.5], turn: [5.5, 7.5], rest: [3.0, 4.2],
    windup: [1.0, 1.45], recover: [7.5, 11.0]
  },
  // Low contact damage on purpose: what a Clinger costs you is the seconds,
  // not the bite. Everything else on the street is what actually hurts.
  CLINGER: {
    health: 55, speed: 5.2, radius: 0.8, contact: 6, score: 240, scrap: 2, scale: 0.95,
    flesh: 0x8a7a63, cloth: 0x453a30,
    // Lurks closer in than the rest of the ring, because what it is waiting
    // for is a gap rather than a turn.
    pace: [0.92, 1.1], standoff: [5.5, 8.0], turn: [4.5, 6.5], rest: [4.0, 6.0],
    windup: [0.3, 0.42], recover: [5.0, 7.5]
  }
};

/** How close a Clinger has to get before it throws itself at you. */
export const GRAB_RANGE = 1.9;

/**
 * A swing, in three parts.
 *
 * Contact damage used to be a sphere test: if a body was touching you it was
 * hurting you, with no warning, no way to miss, and nothing on screen to say
 * where it came from — the health bar just went down. Everything Hades gets
 * out of `PreAttackDuration` comes from the opposite arrangement, so the dead
 * now wind up, commit to a line, and stand there having missed.
 *
 * The wind-up and the recovery are per body, drawn from the profile's bands,
 * so eight of them arriving together do not swing in chorus.
 */
export const SwingState = {
  NONE: 'NONE',
  /** Planted, drawing back. The window in which the player can leave. */
  WINDUP: 'WINDUP',
  /** Thrown forward down the line it picked. Two tenths of a second. */
  STRIKE: 'STRIKE',
  /** Spent, and unable to do anything about you. */
  RECOVER: 'RECOVER'
} as const;

export type SwingState = typeof SwingState[keyof typeof SwingState];

/**
 * The types that swing. The rest already have a way of hurting you that is
 * theirs — bile, a swell, a hold, a shout — and giving them a fist as well
 * would only blur what each one is for.
 */
const SWINGS: ReadonlySet<string> = new Set([
  EnemyType.SHAMBLER, EnemyType.SPRINTER, EnemyType.BUTCHER
]);

/** Added to a body's own radius to get the distance it will swing from. */
const SWING_REACH = 1.45;
/** How long the arm is actually travelling. Short: this is the committed part. */
const STRIKE_TIME = 0.18;
/** Forward speed during it, so a swing closes a little ground of its own. */
const STRIKE_LUNGE = 6.0;
/**
 * What a landed swing costs, against the old contact figure.
 *
 * Above one because a swing can miss and contact never could. The plan called
 * for 1.4; measured against a player who does not move it wanted more, because
 * the recovery is long enough that even a stationary target is hit less often
 * than it used to be touched.
 */
const STRIKE_MULTIPLIER = 1.75;

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
  /**
   * The rule riding this body, if any. See `config/Marks`. Read by the
   * renderer for the tint, by the flare for whether it burns, and by the
   * engine when it pays out.
   */
  public mark: MarkId | null = null;
  /** Counts down after each hit while a wound-up one is still angry. */
  private frenzyTimer: number = 0;

  /**
   * Where this body is in its swing, and how far through. `swingPose` runs
   * from -1 (fully drawn back) through 0 to +1 (thrown forward) and is the
   * only thing the renderer needs to animate the whole business.
   */
  public swing: SwingState = SwingState.NONE;
  public swingTimer: number = 0;
  public swingPose: number = 0;
  /** One swing is one hit, however many frames it overlaps for. */
  public swingLanded: boolean = false;
  /** What a landed swing costs. Contact, above, is now only friction. */
  public strikeDamage: number = 12;
  private strikeDir: THREE.Vector3 = new THREE.Vector3();

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
  /** How long this one holds a lane, and how long it hangs back after. */
  public turnLength: number = 6.5;
  public restLength: number = 3.5;

  /** Drawn at spawn from the profile's bands. See `Profile.windup`. */
  private windup: number = 0.4;
  private recover: number = 1.2;

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
  public reset(
    spawnPos: THREE.Vector3,
    type: EnemyType = EnemyType.SHAMBLER,
    difficulty = { health: 1, speed: 1 },
    mark: MarkId | null = null
  ): void {
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

    this.swing = SwingState.NONE;
    this.swingTimer = 0;
    this.swingPose = 0;
    this.swingLanded = false;
    this.pressAttack = false;
    this.lurch = Math.random() * Math.PI * 2;

    this.engaged = false;
    this.turnTimer = 0;
    this.restTimer = 0;
    this.flankSign = Math.random() < 0.5 ? -1 : 1;
    this.orbitSign = Math.random() < 0.5 ? -1 : 1;
    // A sprinter's whole read is the straight line it picks; a shambler has
    // all night, so it can afford to come the long way round.
    this.flankBend = (type === EnemyType.SPRINTER ? 0.2 : type === EnemyType.BUTCHER ? 0.34 : 0.62)
      * (0.7 + Math.random() * 0.6);

    this.maxHealth = Math.round(p.health * difficulty.health);
    this.health = this.maxHealth;
    // Every timing this body owns is drawn here, once. Nothing on the street
    // shares a number with anything else on the street.
    this.moveSpeed = p.speed * difficulty.speed * roll(p.pace);
    this.standoff = roll(p.standoff);
    this.turnLength = roll(p.turn);
    this.restLength = roll(p.rest);
    this.windup = roll(p.windup);
    this.recover = roll(p.recover);
    this.strikeDamage = Math.round(p.contact * STRIKE_MULTIPLIER);

    // What Hades takes off an elite is not thickness, it is time: its
    // `PreAttackDuration` drops from half a second to a quarter. Same body,
    // same swing, less of it to read.
    if (mark) this.windup *= 0.6;
    this.radius = p.radius;
    this.contactDamage = p.contact;
    this.scoreValue = p.score;
    this.scrapValue = p.scrap;
    this.baseScale = p.scale;

    // Marked bodies are worth going after rather than worth avoiding — the
    // whole layer is meant to be a decision, and a decision needs a payout.
    // No health bonus: the mark is the difference. Hades' elites are quicker
    // as well as thicker, and quicker is a thing we cannot do until the dead
    // have wind-ups of their own.
    this.mark = mark;
    this.frenzyTimer = 0;
    if (mark) {
      this.scrapValue += MARK_SCRAP_BONUS;
      this.scoreValue = Math.round(this.scoreValue * MARK_SCORE_MULTIPLIER);
    }

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

  /**
   * @param armourPiercing Set by rounds that go through bodies and by blasts.
   *   A plate stops a bullet; it does not stop a nail that has already been
   *   through two people, and it does nothing at all about a grenade.
   */
  public takeDamage(damage: number, hitPoint: THREE.Vector3, armourPiercing: boolean = false): boolean {
    if (!this.active) return false;

    let dealt = damage;

    // The plate is on the front of it, and a body on this street faces
    // whatever it is walking at. So it is armoured against the player right up
    // until it is not looking at them — shoved and reeling, or off after the
    // goat — which is the second answer to it after heavy rounds.
    if (this.mark === 'VEST' && !armourPiercing && hitPoint) {
      const facingX = -Math.sin(this.yaw);
      const facingZ = -Math.cos(this.yaw);
      const dx = hitPoint.x - this.position.x;
      const dz = hitPoint.z - this.position.z;
      const len = Math.hypot(dx, dz);
      // The plate covers the front and stops a little short of the shoulders,
      // so getting past it means genuinely being off to one side of whatever
      // it is looking at — not merely not being dead in front of it.
      if (len < 0.0001 || (dx / len) * facingX + (dz / len) * facingZ > 0.2) {
        dealt = Math.max(1, dealt - VEST_SOAK);
      }
    }

    if (this.mark === 'FRENZY') this.frenzyTimer = FRENZY_DURATION;

    this.health -= dealt;
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
      // Whatever it was about to do, it is not doing it now.
      this.swing = SwingState.NONE;
      this.swingPose = 0;
      this.velocity.multiplyScalar(0.86);
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      return;
    }

    // Bursters swell up once they are on top of you, then go off.
    if (this.type === EnemyType.BURSTER) {
      if (!this.isSwelling && this.position.distanceToSquared(playerPos) <= 5.0) {
        this.isSwelling = true;
        this.swellTimer = this.windup;
        this.audio.playSwell();
      }
      if (this.isSwelling) {
        this.velocity.multiplyScalar(0.8);
        this.swellTimer -= delta;
        const puff = 1 + (this.windup - this.swellTimer) * 0.55;
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
            // Missed. Comes round for another go sooner than it would after a
            // hold that landed.
            this.grabCooldown = this.recover * 0.5;
          }
        }
        return;
      }

      if (this.grabCooldown <= 0 && this.engaged &&
          this.position.distanceTo(playerPos) <= GRAB_RANGE * 1.9) {
        this.isLunging = true;
        this.lungeTimer = this.windup;
        this.grabCooldown = this.recover;
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
        const t = 1 - this.screamTimer / this.windup;
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
          this.screamCooldown = this.recover;
          onScream?.(this);
        }
        return;
      }

      // Only shouts once it is standing where it means to stand, so the
      // wind-up never starts in the middle of a walk the player cannot read.
      const gap = this.position.distanceTo(playerPos);
      if (this.screamCooldown <= 0 && gap > this.standoff * 0.6) {
        this.isScreaming = true;
        this.screamTimer = this.windup;
        this.audio.playSwell();
        return;
      }
    }

    // Mid-swing, and nothing else about the world matters until it is over.
    if (this.swing !== SwingState.NONE) {
      this.swingTimer -= delta;

      if (this.swing === SwingState.WINDUP) {
        // Plants itself and draws back. This is the whole window.
        this.velocity.multiplyScalar(0.72);
        this.swingPose = -Math.min(1, 1 - this.swingTimer / Math.max(0.01, this.windup));

        if (this.swingTimer <= 0) {
          this.swing = SwingState.STRIKE;
          this.swingTimer = STRIKE_TIME;
          this.swingLanded = false;
          // Committed to where they were when it let go, not to where they
          // are. Everything the player can do about this happens before here.
          this.strikeDir.copy(playerPos).sub(this.position).setY(0);
          if (this.strikeDir.lengthSq() > 0) this.strikeDir.normalize();
        }
      } else if (this.swing === SwingState.STRIKE) {
        this.swingPose = 1 - Math.max(0, this.swingTimer / STRIKE_TIME) * 2;
        this.velocity.x = this.strikeDir.x * STRIKE_LUNGE;
        this.velocity.z = this.strikeDir.z * STRIKE_LUNGE;

        if (this.swingTimer <= 0) {
          this.swing = SwingState.RECOVER;
          this.swingTimer = this.recover;
        }
      } else {
        this.velocity.multiplyScalar(0.86);
        this.swingPose = Math.max(0, this.swingTimer / Math.max(0.01, this.recover));
        if (this.swingTimer <= 0) {
          this.swing = SwingState.NONE;
          this.swingPose = 0;
        }
      }

      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      for (const o of InstancedProps.obstacles) {
        ArcadePhysics.resolveSolidObstacle(this.position, this.radius, o);
      }
      this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z);
      this.yaw = Math.atan2(this.position.x - playerPos.x, this.position.z - playerPos.z);
      this.gait = 0;
      return;
    }

    // In reach, and it is this one's turn. Anything still waiting its turn out
    // in the ring never swings — that is what waiting means.
    if (SWINGS.has(this.type) && this.engaged &&
        this.position.distanceTo(playerPos) <= this.radius + SWING_REACH) {
      this.swing = SwingState.WINDUP;
      this.swingTimer = this.windup;
      this.swingPose = 0;
      return;
    }

    tempTarget.copy(playerPos);

    const toPlayerX = playerPos.x - this.position.x;
    const toPlayerZ = playerPos.z - this.position.z;
    const distance = Math.hypot(toPlayerX, toPlayerZ) || 0.0001;

    // Screamers back away to their own working distance and stay there. They
    // never take an attack lane — see `closingIn` below.
    if (this.type === EnemyType.SCREAMER && !this.pressAttack) {
      if (distance < this.standoff) {
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
      if (this.attackTimer >= this.recover && d2 < 900) {
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

    if (this.frenzyTimer > 0) this.frenzyTimer -= delta;
    const topSpeed = this.moveSpeed * (this.frenzyTimer > 0 ? FRENZY_SPEED : 1);

    const speedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
    if (speedSq > topSpeed * topSpeed) {
      const s = topSpeed / Math.sqrt(speedSq);
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
    this.swing = SwingState.NONE;
    this.swingPose = 0;
    this.mark = null;
    this.position.set(0, -9999, 0);
  }
}
