import * as THREE from 'three';

import { ANIMALS, type AnimalDef, type AnimalId } from '../config/Animals';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import type { Enemy } from './Enemy';
import type { Pickup } from './Pickup';

/**
 * WHATEVER CAME WITH YOU.
 *
 * One entity, seven animals. The roster in `config/Animals` says what each one
 * is worth and what it does; this file is the body it does it in and the twenty
 * lines of head it does it with.
 *
 * Two places use the same object. Out in the street it is a `FIELD` companion —
 * it follows, it fights, and the dead can put it down. Downstairs it is a `PEN`
 * companion, which is the same walk cycle with nothing to walk towards, milling
 * about a corner of the shelter so the player can look at what they bought.
 *
 * The one rule that shapes everything below: **nothing in the pens dies.** They
 * get knocked down, they lie in the road until the street is finished, and they
 * are on their feet again at the next one. A permadeath pet in a game about
 * losing everything else would be the only cruelty here nobody asked for — and
 * mechanically it would turn every companion into a thing you leave at home.
 */

export type CompanionMode = 'OFF' | 'FIELD' | 'PEN';

/** How far Nan's noise carries. The only reason an enemy ever ignores you. */
export const LURE_RADIUS = 11.0;

/**
 * Everything the field needs from the engine. Deliberately small and all of it
 * a function: the companion never reaches into the engine, the pools, or the
 * save, so the same object drops into the shelter with three of these unused.
 */
export interface CompanionWorld {
  groundAt(x: number, z: number): number;
  /** Broad-phase enemies near a point. The list is borrowed — never kept. */
  enemiesNear(pos: THREE.Vector3, radius: number): Enemy[];
  /** Deals the damage and does the engine's kill bookkeeping if it lands. */
  hurt(enemy: Enemy, damage: number, from: THREE.Vector3, stun: number): void;
  /** Nearest loose scrap, for the bird. */
  scrapNear(pos: THREE.Vector3, radius: number): Pickup | null;
  healPlayer(amount: number): void;
  /** Seconds since the player last took a hit. */
  calmSeconds(): number;
  spark(pos: THREE.Vector3, count: number, colour: number, power: number, life: number): void;
  say(text: string): void;
}

interface Parts {
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  wings: THREE.Object3D[];
  tail: THREE.Object3D | null;
  head: THREE.Object3D | null;
}

const tmpTarget = new THREE.Vector3();
const tmpAway = new THREE.Vector3();

/** XZ distance. Everything in this game is decided on the flat. */
function flat(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export class Companion {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public def: AnimalDef | null = null;
  public mode: CompanionMode = 'OFF';

  /** Condition. Never reaches a state that removes the animal from the run. */
  public condition: number = 0;
  public downed: boolean = false;

  private scene: THREE.Scene;
  private body: THREE.Group | null = null;
  private parts: Parts = { legs: [], arms: [], wings: [], tail: null, head: null };
  private materials: THREE.Material[] = [];

  private time: number = 0;
  private gait: number = 0;
  private yaw: number = 0;
  private moving: boolean = false;
  private lift: number = 0;

  /** Seconds until the next strike is allowed. */
  private strikeTimer: number = 0;
  /** Wind-up before a slam lands, so the biggest hit in the pens has weight. */
  private windup: number = 0;
  /** Seconds left of a charge, and who it has already clipped. */
  private chargeTimer: number = 0;
  private chargeDir: THREE.Vector3 = new THREE.Vector3();
  private clipped: Set<number> = new Set();
  /** Recovery after being touched, so a crowd cannot delete a companion. */
  private hurtLock: number = 0;
  /** A lunge, purely visual: the body pitches into whatever it just hit. */
  private lunge: number = 0;

  /** What the bird is holding. Released into the player's pickup radius. */
  private carrying: Pickup | null = null;
  /** What the hawk is falling towards, held across the seconds it takes. */
  private diveTarget: Enemy | null = null;

  private anchor: THREE.Vector3 = new THREE.Vector3();
  private idleTimer: number = 0;
  private wander: THREE.Vector3 = new THREE.Vector3();
  /** Slowly turning offset, so a follower orbits rather than treading on you. */
  private orbit: number = Math.random() * Math.PI * 2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
  }

  // ------------------------------------------------------------------ set-up

  /**
   * Swaps in a different animal, building its body from scratch. Cheap enough
   * to do on a menu click — these are twenty boxes each — and the old one is
   * disposed rather than left in the graph, because the pens are switched
   * between far more often than anything else in the game is rebuilt.
   */
  public setAnimal(id: AnimalId | null): void {
    if (this.def?.id === id) return;

    this.clearBody();
    this.def = id ? ANIMALS[id] : null;
    if (!this.def) {
      this.mode = 'OFF';
      this.group.visible = false;
      return;
    }

    this.body = this.buildBody(this.def);
    this.group.add(this.body);
    this.condition = this.def.grit;
    this.downed = false;
  }

  private clearBody(): void {
    if (this.body) this.group.remove(this.body);
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    this.body?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.body = null;
    this.parts = { legs: [], arms: [], wings: [], tail: null, head: null };
    this.carrying = null;
  }

  public dispose(): void {
    this.clearBody();
    this.scene.remove(this.group);
  }

  /** Out with you. Set down just off the player's shoulder. */
  public enterField(at: THREE.Vector3, groundAt: (x: number, z: number) => number): void {
    if (!this.def) return;
    this.mode = 'FIELD';
    this.group.visible = true;

    const x = at.x + 1.6;
    const z = at.z + 1.2;
    this.position.set(x, groundAt(x, z), z);
    this.condition = this.def.grit;
    this.downed = false;
    this.strikeTimer = 0.8;
    this.windup = 0;
    this.chargeTimer = 0;
    this.hurtLock = 0;
    this.carrying = null;
    this.lift = this.def.flies ? 3.0 : 0;
    if (this.body) this.body.rotation.z = 0;
  }

  /** Downstairs, in the corner by the pens, doing nothing in particular. */
  public enterPen(at: THREE.Vector3): void {
    if (!this.def) {
      this.mode = 'OFF';
      this.group.visible = false;
      return;
    }
    this.mode = 'PEN';
    this.group.visible = true;
    this.anchor.copy(at);
    this.position.copy(at);
    this.wander.copy(at);
    this.downed = false;
    this.condition = this.def.grit;
    this.idleTimer = 0;
    // A bird in the shelter is on the perch rail, not hovering over the table.
    this.lift = this.def.flies ? 1.35 : 0;
    if (this.body) this.body.rotation.z = 0;
  }

  public stand(): void {
    this.mode = 'OFF';
    this.group.visible = false;
    this.releaseCarry();
  }

  /**
   * A cleared street. Whatever was knocked down gets back up, and everything
   * else gets its wind back — the same deal the player gets from a medical
   * gate, and the reason a companion is never a resource you have to nurse.
   */
  public patchUp(): void {
    if (!this.def) return;
    this.downed = false;
    this.condition = this.def.grit;
    this.strikeTimer = 0.5;
    if (this.body) this.body.rotation.z = 0;
  }

  /** True the frame it went down, so the caller can say so once. */
  private knockDown(world: CompanionWorld): void {
    this.downed = true;
    this.condition = 0;
    this.chargeTimer = 0;
    this.windup = 0;
    this.releaseCarry(world);
    if (this.body) this.body.rotation.z = Math.PI * 0.42;
    world.spark(this.position, 10, this.def!.coatDark, 4, 0.5);
    world.say(`${this.def!.name} is down. Finish the street and ${this.def!.name} gets up again.`);
  }

  /** Nan's noise, or nothing. The only thing that pulls the dead off you. */
  public get lurePoint(): THREE.Vector3 | null {
    if (this.mode !== 'FIELD' || !this.def || this.downed) return null;
    return this.def.role === 'BAIT' ? this.position : null;
  }

  public get name(): string {
    return this.def?.name ?? '';
  }

  public get conditionRatio(): number {
    if (!this.def) return 0;
    return Math.max(0, Math.min(1, this.condition / this.def.grit));
  }

  // -------------------------------------------------------------------- loop

  public update(delta: number, playerPos: THREE.Vector3, world?: CompanionWorld): void {
    if (this.mode === 'OFF' || !this.def) return;

    this.time += delta;
    if (this.hurtLock > 0) this.hurtLock -= delta;
    if (this.lunge > 0) this.lunge -= delta;

    if (this.mode === 'PEN') {
      this.updatePen(delta, playerPos);
    } else if (world) {
      this.updateField(delta, playerPos, world);
    }

    this.animate();
  }

  /** Milling about the corner it lives in, watching you cross the room. */
  private updatePen(delta: number, playerPos: THREE.Vector3): void {
    const def = this.def!;
    const near = flat(playerPos, this.position);

    this.idleTimer -= delta;
    if (this.idleTimer <= 0) {
      this.idleTimer = 3.0 + Math.random() * 4.0;
      this.wander.set(
        this.anchor.x + (Math.random() - 0.5) * 2.6,
        0,
        this.anchor.z + (Math.random() - 0.5) * 2.2
      );
    }

    // Close enough to be talked to and it comes to the rail instead.
    if (near < 4.0) {
      tmpTarget.copy(playerPos).sub(this.anchor);
      const len = Math.hypot(tmpTarget.x, tmpTarget.z) || 1;
      tmpTarget.set(
        this.anchor.x + (tmpTarget.x / len) * 1.2,
        0,
        this.anchor.z + (tmpTarget.z / len) * 1.2
      );
      this.steer(tmpTarget, def.speed * 0.4, delta, 0.45);
      if (!this.moving) this.faceTowards(playerPos, delta);
    } else {
      this.steer(this.wander, def.speed * 0.3, delta, 0.4);
    }

    this.position.y = 0;
  }

  private updateField(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;

    if (this.downed) {
      this.moving = false;
      this.position.y = world.groundAt(this.position.x, this.position.z);
      return;
    }

    if (this.strikeTimer > 0) this.strikeTimer -= delta;

    switch (def.role) {
      case 'HARRY': this.roleHarry(delta, playerPos, world); break;
      case 'STOOP': this.roleStoop(delta, playerPos, world); break;
      case 'SLAM': this.roleSlam(delta, playerPos, world); break;
      case 'FETCH': this.roleFetch(delta, playerPos, world); break;
      case 'BAIT': this.roleBait(delta, playerPos, world); break;
      case 'CHARGE': this.roleCharge(delta, playerPos, world); break;
      case 'WATCH': this.roleWatch(delta, playerPos, world); break;
    }

    // The ground, the street furniture, and the leash. A flyer skips all three
    // — that is what it is paying for.
    if (!def.flies) {
      this.position.y = world.groundAt(this.position.x, this.position.z);
      this.takeContact(world);
    } else {
      this.position.y = world.groundAt(this.position.x, this.position.z);
    }

    // Never let one strand itself: past twice its leash it is teleported back
    // in beside you rather than left running at a wall on the far side of the
    // arena, which is what a stuck follower looks like from the camera.
    if (flat(this.position, playerPos) > def.leash * 2.2) {
      this.position.set(playerPos.x + 1.4, this.position.y, playerPos.z + 1.2);
    }
  }

  // ------------------------------------------------------------------- roles

  /** Rook. Nearest thing on its feet, and off he goes. */
  private roleHarry(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;
    const target = this.nearestTo(playerPos, def.leash, world);

    if (!target) {
      this.followHeel(delta, playerPos, def.speed);
      return;
    }

    const reach = def.strike.reach + target.radius;
    const gap = flat(this.position, target.position);

    if (gap > reach) {
      this.steer(target.position, def.speed, delta, reach * 0.8);
      return;
    }

    this.faceTowards(target.position, delta * 3);
    if (this.strikeTimer <= 0) this.bite(target, world);
  }

  /** Kite. Height, patience, and then the whole weight of her at once. */
  private roleStoop(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;

    // Mid-dive: straight at it, and the hit lands on arrival.
    if (this.windup > 0) {
      this.windup -= delta;
      const target = this.diveTarget;
      if (!target || !target.active) {
        this.windup = 0;
        this.diveTarget = null;
        return;
      }
      this.lift = THREE.MathUtils.lerp(this.lift, 0.9, 1 - Math.pow(0.001, delta));
      this.steer(target.position, def.speed, delta, 0.2);
      if (flat(this.position, target.position) < def.strike.reach + target.radius) {
        world.hurt(target, def.strike.damage, this.position, def.strike.stun);
        world.spark(target.position, 9, def.mark, 6, 0.35);
        this.strikeTimer = def.strike.cooldown;
        this.windup = 0;
        this.diveTarget = null;
        this.lunge = 0.25;
      }
      return;
    }

    // Circling: a fixed height off your shoulder, turning slowly.
    this.lift = THREE.MathUtils.lerp(this.lift, 4.2, 1 - Math.pow(0.02, delta));
    this.orbit += delta * 1.5;
    tmpTarget.set(
      playerPos.x + Math.cos(this.orbit) * def.heel,
      0,
      playerPos.z + Math.sin(this.orbit) * def.heel
    );
    this.steer(tmpTarget, def.speed, delta, 0.3);

    if (this.strikeTimer > 0) return;

    // She takes the one you are least able to reach — which in practice is
    // whichever spitter has backed off to the edge of the street.
    const candidates = world.enemiesNear(playerPos, def.leash);
    let pick: Enemy | null = null;
    let bestScore = -1;
    for (const e of candidates) {
      if (!e.active) continue;
      const d = flat(e.position, playerPos);
      if (d > def.leash) continue;
      const score = d + (e.type === 'BLOATER' ? 8 : 0);
      if (score > bestScore) {
        bestScore = score;
        pick = e;
      }
    }
    if (pick) {
      this.diveTarget = pick;
      this.windup = 1.0;
    }
  }

  /** Honey. Walks with you, and then the street stops. */
  private roleSlam(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;

    if (this.windup > 0) {
      this.windup -= delta;
      this.moving = false;
      if (this.windup <= 0) this.slam(world);
      return;
    }

    const target = this.nearestTo(playerPos, def.leash, world);
    if (!target) {
      this.followHeel(delta, playerPos, def.speed);
      return;
    }

    const gap = flat(this.position, target.position);
    if (gap > def.strike.reach * 0.55) {
      this.steer(target.position, def.speed, delta, def.strike.reach * 0.5);
      return;
    }

    this.faceTowards(target.position, delta * 2.4);
    if (this.strikeTimer <= 0) {
      this.windup = 0.45;
      world.spark(this.position, 6, def.mark, 3, 0.3);
    }
  }

  private slam(world: CompanionWorld): void {
    const def = this.def!;
    this.strikeTimer = def.strike.cooldown;
    this.lunge = 0.3;

    world.spark(this.position, 22, 0x413526, 8, 0.55);

    let hit = 0;
    for (const e of world.enemiesNear(this.position, def.strike.reach)) {
      if (!e.active) continue;
      if (flat(e.position, this.position) > def.strike.reach + e.radius) continue;
      world.hurt(e, def.strike.damage, this.position, def.strike.stun);
      hit++;
    }
    if (hit >= 4) world.say(`${def.name} put ${hit} of them in the road at once.`);
  }

  /** Sixpence. Works the street behind you and hands it over. */
  private roleFetch(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;
    this.lift = THREE.MathUtils.lerp(this.lift, this.carrying ? 1.9 : 2.6, 1 - Math.pow(0.02, delta));

    if (this.carrying && !this.carrying.active) this.carrying = null;

    if (this.carrying) {
      this.steer(playerPos, def.speed, delta, 0.2);
      // Carried under her, so the scrap reads as being flown home rather than
      // dragged. Released inside the player's own magnet, which is what
      // actually pays it out — the bird never touches the economy.
      this.carrying.position.set(this.position.x, this.position.y + this.lift - 0.5, this.position.z);
      if (flat(this.position, playerPos) < 1.8) this.releaseCarry(world);
      return;
    }

    const loose = world.scrapNear(this.position, def.leash);
    if (loose) {
      this.steer(loose.position, def.speed, delta, 0.15);
      if (flat(this.position, loose.position) < 1.0) {
        this.carrying = loose;
        world.spark(loose.position, 5, def.mark, 3, 0.25);
      }
      return;
    }

    this.orbit += delta * 1.9;
    tmpTarget.set(
      playerPos.x + Math.cos(this.orbit) * def.heel,
      0,
      playerPos.z + Math.sin(this.orbit) * def.heel
    );
    this.steer(tmpTarget, def.speed * 0.7, delta, 0.3);
  }

  /**
   * Nan. She walks towards the noise, stops short of it, and shouts.
   *
   * The pull itself is not here — it is one line in the engine's enemy pass,
   * which hands the dead her position instead of yours. All she has to do is
   * stand somewhere useful, which means somewhere off to the side of you and
   * not actually inside the crowd she is collecting.
   */
  private roleBait(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;
    const target = this.nearestTo(playerPos, def.leash, world);

    if (target) {
      const gap = flat(this.position, target.position);
      if (gap > 4.5) {
        // Stand between you and them, out at her working distance.
        tmpTarget.copy(target.position).sub(playerPos).setY(0);
        const len = Math.hypot(tmpTarget.x, tmpTarget.z) || 1;
        tmpTarget.set(
          playerPos.x + (tmpTarget.x / len) * def.heel,
          0,
          playerPos.z + (tmpTarget.z / len) * def.heel
        );
        this.steer(tmpTarget, def.speed, delta, 0.5);
      } else {
        // They have arrived. She holds her ground and kicks.
        this.faceTowards(target.position, delta * 3);
        this.moving = false;
        if (this.strikeTimer <= 0 && gap < def.strike.reach + target.radius) {
          this.bite(target, world);
        }
      }
      return;
    }

    this.followHeel(delta, playerPos, def.speed);
  }

  /** Bristle. One line, run flat out, and whatever was on it is on its back. */
  private roleCharge(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;

    if (this.chargeTimer > 0) {
      this.chargeTimer -= delta;
      const step = def.speed * 2.6 * delta;
      this.position.x += this.chargeDir.x * step;
      this.position.z += this.chargeDir.z * step;
      this.yaw = Math.atan2(this.chargeDir.x, this.chargeDir.z);
      this.moving = true;
      this.gait += delta * 26;

      for (const e of world.enemiesNear(this.position, def.strike.reach + 1)) {
        if (!e.active || this.clipped.has(e.id)) continue;
        if (flat(e.position, this.position) > def.strike.reach + e.radius) continue;
        this.clipped.add(e.id);
        world.hurt(e, def.strike.damage, this.position, def.strike.stun);
        world.spark(e.position, 8, def.mark, 6, 0.3);
      }

      // Three bodies stop him. Without this a single charge through a packed
      // street clipped ten of them and the boar cleared sectors on his own —
      // twenty-nine kills in twenty seconds against the bear's eight.
      if (this.clipped.size >= 3) this.chargeTimer = 0;
      return;
    }

    // A charge needs a run-up, so the one he picks is the furthest body he can
    // still reach rather than the nearest. Choosing the nearest meant that a
    // shambler leaning on him blocked the charge outright: it was always too
    // close to run at, and he stood there being eaten. See bug.md.
    //
    // The leash is measured rather than trusted, and here it matters more than
    // anywhere else in this file: the grid is a broad phase, so the list runs
    // past the leash, and picking the *furthest* body in it is picking exactly
    // the one that overran. He charged bodies four metres outside his own
    // leash — away from the fight, with his back to it. See bug.md.
    let mark: Enemy | null = null;
    let markDist = 0;
    for (const e of world.enemiesNear(playerPos, def.leash)) {
      if (!e.active) continue;
      if (flat(e.position, playerPos) > def.leash) continue;
      const d = flat(e.position, this.position);
      if (d > markDist) {
        markDist = d;
        mark = e;
      }
    }

    if (!mark) {
      this.followHeel(delta, playerPos, def.speed);
      return;
    }

    if (this.strikeTimer <= 0 && markDist > 2.5) {
      this.chargeDir.copy(mark.position).sub(this.position).setY(0).normalize();
      this.chargeTimer = 0.72;
      this.strikeTimer = def.strike.cooldown;
      this.clipped.clear();
      world.spark(this.position, 8, 0x413526, 4, 0.3);
      return;
    }

    // Between charges he walks with you rather than standing in the crowd he
    // is about to run at — a boar that waits in the middle of it is a boar
    // that is being eaten between charges.
    this.followHeel(delta, playerPos, def.speed);
  }

  /** Mouser. Stays at your knee, keeps out of it, and you stop bleeding. */
  private roleWatch(delta: number, playerPos: THREE.Vector3, world: CompanionWorld): void {
    const def = this.def!;
    const threat = this.nearestTo(this.position, 4.0, world);

    if (threat) {
      // Puts you between her and it. Cats are not brave and this one knows it.
      tmpAway.copy(playerPos).sub(threat.position).setY(0);
      const len = Math.hypot(tmpAway.x, tmpAway.z) || 1;
      tmpTarget.set(
        playerPos.x + (tmpAway.x / len) * def.heel,
        0,
        playerPos.z + (tmpAway.z / len) * def.heel
      );
      this.steer(tmpTarget, def.speed, delta, 0.35);
    } else {
      this.followHeel(delta, playerPos, def.speed);
    }

    if (world.calmSeconds() >= 4.0) world.healPlayer(2.0 * delta);
  }

  // -------------------------------------------------------------- behaviours

  private bite(target: Enemy, world: CompanionWorld): void {
    const def = this.def!;
    world.hurt(target, def.strike.damage, this.position, def.strike.stun);
    world.spark(target.position, 7, def.mark, 5, 0.3);
    this.strikeTimer = def.strike.cooldown;
    this.lunge = 0.2;
  }

  /**
   * Puts down whatever the bird is holding, on the floor.
   *
   * The height matters and is not decoration: the engine collects a pickup on
   * a 3D distance test, and scrap left at flight height sits 1.6 metres over
   * the player's head, close enough to look collected and too far to be. It
   * hung there until it timed out. See bug.md.
   */
  private releaseCarry(world?: CompanionWorld): void {
    const held = this.carrying;
    this.carrying = null;
    if (!held) return;
    const ground = world ? world.groundAt(held.position.x, held.position.z) : 0;
    held.position.y = ground + 0.3;
  }

  /**
   * Nearest live body to the animal, out of everything inside `radius` of
   * `origin` — which is nearly always the player, because the radius is the
   * leash and the leash is about how far the animal is willing to leave you.
   *
   * The radius has to be measured here. `enemiesNear` is the grid, and the
   * grid is a broad phase: it hands back whole cells, six metres to a side, so
   * a body well outside the leash comes back in the list. Unmeasured, the cat
   * flinched from things she could not see and the dog left the player's side
   * for a body outside his. See bug.md.
   */
  private nearestTo(origin: THREE.Vector3, radius: number, world: CompanionWorld): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of world.enemiesNear(origin, radius)) {
      if (!e.active) continue;
      if (flat(e.position, origin) > radius) continue;
      const d = flat(e.position, this.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Contact with the dead. Rate limited rather than per-frame: a companion
   * standing in a crowd should be losing condition steadily, not vanishing
   * between two frames because six of them are touching it.
   */
  private takeContact(world: CompanionWorld): void {
    if (this.hurtLock > 0) return;
    const def = this.def!;

    for (const e of world.enemiesNear(this.position, def.radius + 1.4)) {
      if (!e.active) continue;
      if (flat(e.position, this.position) > def.radius + e.radius) continue;

      this.condition -= e.contactDamage * 0.5;
      this.hurtLock = 0.9;
      world.spark(this.position, 5, 0x6b1a1a, 4, 0.3);
      if (this.condition <= 0) this.knockDown(world);
      return;
    }
  }

  /** Walks to a spot `heel` metres off the player, on the side it is already on. */
  private followHeel(delta: number, playerPos: THREE.Vector3, speed: number): void {
    const def = this.def!;
    const gap = flat(this.position, playerPos);

    if (gap < def.heel * 1.3) {
      this.moving = false;
      this.faceTowards(playerPos, delta * 2);
      return;
    }

    const ox = this.position.x - playerPos.x;
    const oz = this.position.z - playerPos.z;
    const len = Math.hypot(ox, oz) || 1;
    tmpTarget.set(
      playerPos.x + (ox / len) * def.heel,
      0,
      playerPos.z + (oz / len) * def.heel
    );
    this.steer(tmpTarget, speed, delta, 0.3);
  }

  /** The whole of the movement code: point at it, walk, stop when close. */
  private steer(target: THREE.Vector3, speed: number, delta: number, stopAt: number): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= stopAt) {
      this.moving = false;
      return;
    }

    // Eases off over the last couple of metres so nothing skids to a halt.
    const v = Math.min(speed, 1.2 + dist * 2.4);
    this.position.x += (dx / dist) * v * delta;
    this.position.z += (dz / dist) * v * delta;
    this.yaw = Math.atan2(dx, dz);
    this.gait += delta * (6 + v * 1.6);
    this.moving = true;
  }

  private faceTowards(at: THREE.Vector3, rate: number): void {
    const want = Math.atan2(at.x - this.position.x, at.z - this.position.z);
    this.yaw += THREE.MathUtils.clamp(
      ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
      -rate * 4, rate * 4
    );
  }

  /** Keeps a ground animal out of the wrecks, same as everything else. */
  public avoid(obstacles: readonly { x: number; z: number; radius: number }[]): void {
    if (this.mode !== 'FIELD' || !this.def || this.def.flies || this.downed) return;
    for (const o of obstacles) {
      const dx = this.position.x - o.x;
      const dz = this.position.z - o.z;
      const reach = o.radius + this.def.radius + 2;
      if (dx * dx + dz * dz > reach * reach) continue;
      ArcadePhysics.resolveSolidObstacle(this.position, this.def.radius, o);
    }
  }

  // --------------------------------------------------------------- animation

  private animate(): void {
    if (!this.body || !this.def) return;

    const def = this.def;
    const swing = this.moving ? 0.75 : 0.12;
    const beat = this.moving ? this.gait : this.time * 2;

    for (let i = 0; i < this.parts.legs.length; i++) {
      this.parts.legs[i].rotation.x = Math.sin(beat + (i % 2 === 0 ? 0 : Math.PI) + (i > 1 ? 0.6 : 0)) * swing;
    }

    for (let i = 0; i < this.parts.wings.length; i++) {
      const flap = def.flies
        ? Math.sin(this.time * (this.moving ? 22 : 9)) * (this.moving ? 0.9 : 0.35)
        : 0;
      this.parts.wings[i].rotation.z = (i === 0 ? 1 : -1) * (0.25 + flap);
    }

    if (this.parts.tail) {
      const wag = this.downed ? 0 : this.moving ? Math.sin(this.time * 15) * 0.5 : Math.sin(this.time * 5) * 0.22;
      this.parts.tail.rotation.y = wag;
    }

    if (this.parts.head) {
      this.parts.head.rotation.x = this.lunge > 0 ? -0.5 : Math.sin(this.time * 2.2) * 0.06;
    }

    for (const arm of this.parts.arms) {
      arm.rotation.x = this.windup > 0 ? -1.5 : this.lunge > 0 ? 1.0 : Math.sin(beat + Math.PI) * swing * 0.7;
    }

    // Bob: a walk cycle needs the body to rise, and a hover needs it to drift.
    const bob = def.flies
      ? Math.sin(this.time * 3.1) * 0.16
      : this.moving ? Math.abs(Math.sin(beat)) * 0.06 : 0;

    this.group.position.set(this.position.x, this.position.y + this.lift + bob, this.position.z);
    this.group.rotation.y = this.yaw + Math.PI;
    this.body.rotation.x = this.lunge > 0 ? -0.35 : this.windup > 0 ? 0.3 : 0;
  }

  // ------------------------------------------------------------------ bodies

  private mat(colour: number, rough = 0.95): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color: colour, roughness: rough, flatShading: true });
    this.materials.push(m);
    return m;
  }

  private box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    return mesh;
  }

  /**
   * Seven bodies out of boxes, wedges and the odd cone.
   *
   * Deliberately built the same way the shelter and the props are: flat-shaded
   * primitives, two tones of coat and one lighter mark. At this camera height
   * the silhouette is doing all the work, so the differences that matter are
   * the ones you can read from thirty metres up — the bear is a wall, the goat
   * has horns, the boar runs with its head down, the birds have a wingspan.
   */
  private buildBody(def: AnimalDef): THREE.Group {
    const g = new THREE.Group();
    const coat = this.mat(def.coat);
    const dark = this.mat(def.coatDark);
    const mark = this.mat(def.mark, 0.85);

    const legAt = (x: number, z: number, w: number, h: number, matr: THREE.Material) => {
      // Hung from a pivot at the shoulder so the swing reads as a stride
      // rather than the whole leg sliding through the hip.
      const pivot = new THREE.Group();
      pivot.position.set(x, h, z);
      const leg = this.box(w, h, w, matr, 0, -h / 2, 0);
      pivot.add(leg);
      g.add(pivot);
      this.parts.legs.push(pivot);
    };

    switch (def.id) {
      case 'ROOK': {
        g.add(this.box(0.46, 0.42, 1.05, coat, 0, 0.58, 0));
        g.add(this.box(0.5, 0.44, 0.4, coat, 0, 0.6, -0.42));
        const head = this.box(0.36, 0.34, 0.42, coat, 0, 0.86, -0.72);
        g.add(head);
        g.add(this.box(0.2, 0.18, 0.26, dark, 0, 0.79, -0.98));
        for (const s of [-1, 1]) {
          const ear = this.box(0.1, 0.22, 0.06, dark, s * 0.13, 1.06, -0.7);
          ear.rotation.z = s * 0.2;
          g.add(ear);
        }
        for (const [x, z] of [[-0.17, -0.34], [0.17, -0.34], [-0.17, 0.36], [0.17, 0.36]]) {
          legAt(x, z, 0.14, 0.42, dark);
        }
        const tail = new THREE.Group();
        tail.position.set(0, 0.72, 0.55);
        const brush = this.box(0.1, 0.1, 0.44, coat, 0, 0, 0.22);
        brush.rotation.x = -0.5;
        tail.add(brush);
        g.add(tail);
        this.parts.tail = tail;
        this.parts.head = head;
        break;
      }

      case 'MOUSER': {
        g.add(this.box(0.3, 0.28, 0.7, coat, 0, 0.4, 0));
        const head = this.box(0.26, 0.24, 0.26, coat, 0, 0.52, -0.44);
        g.add(head);
        g.add(this.box(0.12, 0.1, 0.12, mark, 0, 0.47, -0.6));
        for (const s of [-1, 1]) {
          const ear = this.box(0.08, 0.14, 0.05, dark, s * 0.09, 0.68, -0.42);
          ear.rotation.z = s * 0.25;
          g.add(ear);
        }
        for (const [x, z] of [[-0.11, -0.22], [0.11, -0.22], [-0.11, 0.24], [0.11, 0.24]]) {
          legAt(x, z, 0.09, 0.3, dark);
        }
        const tail = new THREE.Group();
        tail.position.set(0, 0.46, 0.34);
        const t = this.box(0.07, 0.07, 0.5, dark, 0, 0.1, 0.25);
        t.rotation.x = -0.9;
        tail.add(t);
        g.add(tail);
        this.parts.tail = tail;
        this.parts.head = head;
        break;
      }

      case 'SIXPENCE':
      case 'KITE': {
        const big = def.id === 'KITE';
        const s = big ? 1.0 : 0.78;
        g.add(this.box(0.34 * s, 0.34 * s, 0.62 * s, coat, 0, 0, 0));
        // The white on a magpie is the whole of its silhouette; on the hawk it
        // is a barred chest. Same panel, different size.
        g.add(this.box(0.26 * s, 0.2 * s, 0.3 * s, mark, 0, -0.06 * s, -0.05 * s));
        const head = this.box(0.24 * s, 0.22 * s, 0.24 * s, big ? dark : coat, 0, 0.16 * s, -0.34 * s);
        g.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s, 0.2 * s, 5), this.mat(0xc9a248, 0.6));
        beak.rotation.x = -Math.PI / 2;
        beak.position.set(0, 0.14 * s, -0.5 * s);
        g.add(beak);

        for (const side of [-1, 1]) {
          const wing = new THREE.Group();
          wing.position.set(side * 0.16 * s, 0.06 * s, 0);
          const plane = this.box(0.9 * s, 0.05 * s, 0.42 * s, side < 0 ? coat : dark, side * 0.45 * s, 0, 0.02 * s);
          wing.add(plane);
          const tip = this.box(0.36 * s, 0.04 * s, 0.24 * s, mark, side * 1.02 * s, 0, 0.06 * s);
          wing.add(tip);
          g.add(wing);
          this.parts.wings.push(wing);
        }

        const tail = new THREE.Group();
        tail.position.set(0, 0, 0.3 * s);
        // The magpie's tail is longer than the rest of her put together.
        tail.add(this.box(0.16 * s, 0.05 * s, (big ? 0.5 : 0.9) * s, dark, 0, 0, (big ? 0.26 : 0.46) * s));
        g.add(tail);
        this.parts.tail = tail;
        this.parts.head = head;

        for (const side of [-1, 1]) {
          const leg = this.box(0.05 * s, 0.18 * s, 0.05 * s, this.mat(0x8a6a30, 0.8), side * 0.1 * s, -0.24 * s, 0.04 * s);
          g.add(leg);
        }
        break;
      }

      case 'NAN': {
        g.add(this.box(0.52, 0.56, 1.0, coat, 0, 0.78, 0));
        const head = this.box(0.3, 0.3, 0.42, coat, 0, 1.02, -0.66);
        g.add(head);
        g.add(this.box(0.18, 0.16, 0.2, dark, 0, 0.94, -0.9));
        // Beard. Non-negotiable.
        g.add(this.box(0.1, 0.22, 0.08, mark, 0, 0.8, -0.86));
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 5), this.mat(0x7d7360, 0.8));
          horn.position.set(side * 0.11, 1.28, -0.6);
          horn.rotation.x = 0.7;
          horn.rotation.z = side * 0.25;
          g.add(horn);
          const ear = this.box(0.16, 0.07, 0.1, dark, side * 0.2, 1.1, -0.62);
          g.add(ear);
        }
        for (const [x, z] of [[-0.2, -0.32], [0.2, -0.32], [-0.2, 0.34], [0.2, 0.34]]) {
          legAt(x, z, 0.13, 0.52, dark);
        }
        const tail = new THREE.Group();
        tail.position.set(0, 0.98, 0.5);
        tail.add(this.box(0.12, 0.16, 0.12, coat, 0, 0, 0.06));
        g.add(tail);
        this.parts.tail = tail;
        this.parts.head = head;
        break;
      }

      case 'BRISTLE': {
        // Front-heavy: everything about a boar is the shoulders.
        g.add(this.box(0.68, 0.62, 0.9, coat, 0, 0.72, -0.1));
        g.add(this.box(0.54, 0.5, 0.6, dark, 0, 0.64, 0.55));
        const head = this.box(0.4, 0.38, 0.62, dark, 0, 0.62, -0.78);
        g.add(head);
        g.add(this.box(0.22, 0.2, 0.18, coat, 0, 0.52, -1.08));
        for (const side of [-1, 1]) {
          const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 5), this.mat(def.mark, 0.6));
          tusk.position.set(side * 0.14, 0.56, -1.06);
          tusk.rotation.x = 0.5;
          tusk.rotation.z = side * 0.4;
          g.add(tusk);
        }
        // The ridge that gives him his name.
        for (let i = 0; i < 5; i++) {
          const spine = this.box(0.05, 0.2, 0.06, this.mat(def.mark, 1.0), 0, 1.06 - i * 0.02, -0.5 + i * 0.28);
          spine.rotation.x = -0.35;
          g.add(spine);
        }
        for (const [x, z] of [[-0.24, -0.42], [0.24, -0.42], [-0.2, 0.5], [0.2, 0.5]]) {
          legAt(x, z, 0.16, 0.42, dark);
        }
        this.parts.head = head;
        break;
      }

      case 'HONEY': {
        g.add(this.box(1.0, 0.95, 1.5, coat, 0, 1.0, 0));
        g.add(this.box(1.06, 0.9, 0.7, coat, 0, 1.05, -0.55));
        const head = this.box(0.6, 0.55, 0.6, coat, 0, 1.42, -1.02);
        g.add(head);
        g.add(this.box(0.34, 0.3, 0.3, dark, 0, 1.32, -1.34));
        g.add(this.box(0.12, 0.1, 0.1, this.mat(def.mark, 0.6), 0, 1.38, -1.46));
        for (const side of [-1, 1]) {
          const ear = this.box(0.2, 0.2, 0.09, dark, side * 0.24, 1.72, -0.98);
          g.add(ear);
        }
        // Arms swing on their own pivots — they are what the slam is made of.
        for (const side of [-1, 1]) {
          const arm = new THREE.Group();
          arm.position.set(side * 0.56, 1.3, -0.5);
          arm.add(this.box(0.28, 0.8, 0.34, dark, 0, -0.4, 0));
          arm.add(this.box(0.3, 0.16, 0.4, this.mat(def.mark, 1.0), 0, -0.76, -0.06));
          g.add(arm);
          this.parts.arms.push(arm);
        }
        for (const [x, z] of [[-0.36, 0.52], [0.36, 0.52]]) {
          legAt(x, z, 0.34, 0.62, dark);
        }
        this.parts.head = head;
        break;
      }
    }

    return g;
  }
}
