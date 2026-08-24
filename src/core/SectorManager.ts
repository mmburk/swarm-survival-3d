import * as THREE from 'three';
import { ExitDoor, type RewardType } from '../entities/ExitDoor';
import { CAMERA_RIG } from '../graphics/CameraRig';
import { EnemyType } from '../entities/Enemy';
import { NIGHT_TIERS, type NightTier } from '../config/Progression';
import { RewardDeck } from './RewardDeck';
import type { CallerArtId } from '../ui/art/Portraits';

export type SectorState = 'COMBAT' | 'CLEARED' | 'CHOOSING_GATE' | 'TRANSITIONING';

/**
 * What a single gate is advertising. The plaque is painted from this, and the
 * same object is handed back when the player walks through it, so what the
 * door promised and what the player gets can never drift apart.
 */
export interface GateOffer {
  reward: RewardType;
  /** Whose voice is on the other side. SIGNAL gates only. */
  caller: CallerArtId | null;
  /** Short line painted under the header, e.g. "+128 SCRAP". */
  value: string;
  /** The scrap a SCRAP gate actually pays, resolved when the gate opened. */
  amount: number;
}

export interface SectorPlan {
  shamblers: number;
  sprinters: number;
  bloaters: number;
  butchers: number;
  bursters: number;
  screamers: number;
  clingers: number;
  isBoss: boolean;
  isTrader: boolean;
}

/**
 * Where the two gates stand up when a street clears, stated in screen units on
 * the same scale as the rig's view height rather than in world coordinates.
 *
 * Screen space is the right space for this. Pinned to fixed corners of the map,
 * the gates were wherever the fight had not left the player — usually most of
 * the arena away — and the dimetric rig pushed one of them off the top of the
 * frame and the other off the right edge. Composed instead, they open a short
 * walk from where the player is actually standing, one to each shoulder, both
 * whole in the frame: the choice is on screen the moment it exists.
 */
const GATE_SPREAD = 11.5;
/**
 * Kept low deliberately: a gate is eight metres tall with the plaque on top,
 * and every metre the pair is pushed up the frame is another metre of board
 * climbing towards the top edge.
 */
const GATE_LIFT = 3.4;

/**
 * Keeps a gate inside the player's own leash (52) so it can always be walked
 * into, and well inside the perimeter fence (60) so it never floats outside it.
 */
const GATE_MAX_RADIUS = 54;

const tempGate = new THREE.Vector2();

/**
 * Owns the shape of a single run: what spawns in each sector, when the sector
 * counts as clear, which two gates open at the end, and the fade between them.
 */
export class SectorManager {
  public state: SectorState = 'COMBAT';
  public current: number = 1;
  public bossEvery: number = 5;
  public gatesOpen: boolean = false;

  public toSpawn: Record<EnemyType, number> = {
    SHAMBLER: 0, SPRINTER: 0, BLOATER: 0, BUTCHER: 0, BURSTER: 0, SCREAMER: 0, CLINGER: 0
  };
  public isBossSector: boolean = false;
  public isTraderSector: boolean = false;
  public spawnTimer: number = 0;

  public night: NightTier = NIGHT_TIERS[0];

  private transitionTimer: number = 0;
  private readonly transitionDuration: number = 0.62;
  private pendingOffer: GateOffer | null = null;
  private fadeOverlay: HTMLElement;

  /**
   * Set when the player takes a TRADE gate. The next sector becomes Vic's
   * underpass regardless of where the ordinary cadence had put it.
   */
  private traderNext: boolean = false;

  /**
   * What the doors are allowed to say tonight, and why.
   *
   * Everything about which rewards turn up, how often, whose voice is on a
   * radio gate and when the workbench is dealt lives in here rather than in a
   * scatter of `Math.random()` calls — see RewardDeck for the whole machine.
   */
  public readonly deck: RewardDeck = new RewardDeck();

  /**
   * Tracks the fade independently of `state`.
   *
   * The midpoint callback rebuilds the next sector, and doing that calls
   * `setup()` (and, for the trader, `openGates()`) — both of which reassign
   * `state`. When the fade relied on `state === 'TRANSITIONING'` to keep
   * running, that reassignment silently ended it early and the completion
   * callback never fired.
   */
  private fading: boolean = false;

  private gateA: ExitDoor;
  private gateB: ExitDoor;

  /** Recomputed every time the gates open, from where the player is standing. */
  private readonly gatePosA = new THREE.Vector3();
  private readonly gatePosB = new THREE.Vector3();

  /** What each open gate promised. Handed straight back on entry. */
  private offerA: GateOffer | null = null;
  private offerB: GateOffer | null = null;

  public onGateChosen: ((offer: GateOffer) => void) | null = null;
  public onTransitionDone: (() => void) | null = null;
  public onCleared: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.gateA = new ExitDoor(scene);
    this.gateB = new ExitDoor(scene);

    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.id = 'sector-fade';
    this.fadeOverlay.style.cssText = `
      position: fixed; inset: 0;
      background: #070805;
      opacity: 0;
      pointer-events: none;
      z-index: 500;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(this.fadeOverlay);
  }

  public get gates(): ExitDoor[] {
    if (!this.gatesOpen) return [];
    return [this.gateA, this.gateB].filter((g) => g.active);
  }

  public setNight(level: number): void {
    this.night = NIGHT_TIERS[Math.max(0, Math.min(NIGHT_TIERS.length - 1, level))];
  }

  public get difficulty() {
    return { health: this.night.enemyHealth, speed: this.night.enemySpeed };
  }

  public plan(sector: number): SectorPlan {
    if (sector % this.bossEvery === 0) {
      return { shamblers: 14, sprinters: 8, bloaters: 4, butchers: 2, bursters: 4, screamers: 2, clingers: 5, isBoss: true, isTrader: false };
    }
    // A trade gate overrides the ordinary cadence — the player asked for it.
    if (this.traderNext || sector % this.bossEvery === 3) {
      return { shamblers: 0, sprinters: 0, bloaters: 0, butchers: 0, bursters: 0, screamers: 0, clingers: 0, isBoss: false, isTrader: true };
    }

    const n = this.night.enemyCount;
    // Curve is intentionally gentle early: the first two sectors are meant to
    // be survivable with the starting carbine and no boons at all.
    return {
      shamblers: Math.round((10 + sector * 3.4) * n),
      sprinters: Math.round(Math.max(0, (sector - 1) * 2.6) * n),
      bloaters: Math.round(Math.max(0, (sector - 1) * 1.3) * n),
      butchers: Math.round(Math.max(0, (sector - 2) * 0.9) * n),
      bursters: Math.round(Math.max(0, (sector - 2) * 1.5) * n),
      // Rare on purpose. One of these on a street changes the shape of the
      // whole fight; two of them is a different game.
      screamers: Math.round(Math.max(0, (sector - 1) * 0.8) * n),
      clingers: Math.round(Math.max(0, (sector - 1) * 1.6) * n),
      isBoss: false,
      isTrader: false
    };
  }

  public setup(sector: number): SectorPlan {
    this.current = sector;
    this.state = 'COMBAT';
    this.gatesOpen = false;
    this.spawnTimer = 0;

    const p = this.plan(sector);
    this.toSpawn.SHAMBLER = p.shamblers;
    this.toSpawn.SPRINTER = p.sprinters;
    this.toSpawn.BLOATER = p.bloaters;
    this.toSpawn.BUTCHER = p.butchers;
    this.toSpawn.BURSTER = p.bursters;
    this.toSpawn.SCREAMER = p.screamers;
    this.toSpawn.CLINGER = p.clingers;
    this.isBossSector = p.isBoss;
    this.isTraderSector = p.isTrader;
    this.traderNext = false;

    this.gateA.deactivate();
    this.gateB.deactivate();

    return p;
  }

  public remainingSpawns(): number {
    return this.toSpawn.SHAMBLER + this.toSpawn.SPRINTER + this.toSpawn.BLOATER +
           this.toSpawn.BUTCHER + this.toSpawn.BURSTER + this.toSpawn.SCREAMER +
           this.toSpawn.CLINGER;
  }

  /** Weighted draw so the dangerous types trickle in rather than arriving as a block. */
  public nextSpawnType(): EnemyType {
    // Rarer types are down-weighted so they arrive spread through the wave
    // rather than as one lump at the end of the queue.
    const bias: Record<EnemyType, number> = {
      SHAMBLER: 1.0, SPRINTER: 0.9, BLOATER: 0.7, BURSTER: 0.6, BUTCHER: 0.45,
      // Deliberately near the top: a Screamer held back to the end of the
      // queue arrives when there is nothing left for it to call.
      SCREAMER: 0.85, CLINGER: 0.8
    };

    const weights: Array<[EnemyType, number]> = [];
    for (const key of Object.keys(bias) as EnemyType[]) {
      const w = this.toSpawn[key] * bias[key];
      if (w > 0) weights.push([key, w]);
    }

    if (weights.length === 0) return EnemyType.SHAMBLER;

    const total = weights.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [type, w] of weights) {
      roll -= w;
      if (roll <= 0) {
        this.toSpawn[type]--;
        return type;
      }
    }

    const [fallback] = weights[weights.length - 1];
    this.toSpawn[fallback]--;
    return fallback;
  }

  public checkCleared(activeEnemies: number, bossActive: boolean): void {
    if (this.state !== 'COMBAT') return;
    if (this.remainingSpawns() > 0) return;
    if (activeEnemies > 0) return;
    if (this.isBossSector && bossActive) return;

    this.state = 'CLEARED';
    this.onCleared?.();
  }

  /**
   * Plants the pair around wherever the player finished the fight: one gate off
   * each shoulder, both lifted up the frame so the street reads as leading
   * somewhere rather than the gates being pasted over the player.
   */
  private placeGates(anchor: THREE.Vector3): void {
    // On a narrow window the frame runs out before the spread does, so the pair
    // closes up rather than walking off the sides.
    const spread = Math.min(GATE_SPREAD, CAMERA_RIG.halfFrameWidth() * 0.46);

    // The pair wants to stand up the frame from the player, but the street ends
    // at the fence. When the fight finished out by the wire, what gives is how
    // far up the frame the gates sit — walked down towards the player, and past
    // them if that is what it takes. Both gates keep their screen x through all
    // of it, so the choice never slides out of shot sideways.
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const lift = GATE_LIFT * (1 - (2 * i) / steps);
      this.frameGate(anchor, -spread, lift, this.gatePosA);
      this.frameGate(anchor, spread, lift, this.gatePosB);
      const worst = Math.max(
        Math.hypot(this.gatePosA.x, this.gatePosA.z),
        Math.hypot(this.gatePosB.x, this.gatePosB.z)
      );
      if (worst <= GATE_MAX_RADIUS) break;
    }

    // Last resort, for a player pinned against the wire: reel a gate back in
    // along its own bearing. Costs a little symmetry, buys reachability.
    this.reelIn(this.gatePosA);
    this.reelIn(this.gatePosB);
  }

  /** One gate, placed at a spot in the frame relative to the player. */
  private frameGate(anchor: THREE.Vector3, right: number, up: number, out: THREE.Vector3): void {
    CAMERA_RIG.framePoint(right, up, tempGate);
    out.set(anchor.x + tempGate.x, 0, anchor.z + tempGate.y);
  }

  private reelIn(gate: THREE.Vector3): void {
    const r = Math.hypot(gate.x, gate.z);
    if (r <= GATE_MAX_RADIUS || r < 1e-4) return;
    const s = GATE_MAX_RADIUS / r;
    gate.x *= s;
    gate.z *= s;
  }

  public openGates(anchor: THREE.Vector3, favoured?: CallerArtId): void {
    if (this.gatesOpen) return;
    this.gatesOpen = true;
    this.state = 'CHOOSING_GATE';

    this.placeGates(anchor);
    const [a, b] = this.rollOffers(favoured);
    this.offerA = a;
    this.offerB = b;
    this.gateA.activate(this.gatePosA, a.reward, true, a.caller, a.value);
    this.gateB.activate(this.gatePosB, b.reward, true, b.caller, b.value);
  }

  /**
   * After the Behemoth: one gate home, one gate deeper with a voice on it.
   *
   * `carried` is what the player has in their pockets right now, and it goes
   * on the board in full. Every other plaque in the game pays exactly what it
   * says; this one has to as well, or the choice it is asking for is being
   * made blind.
   */
  public openBossGates(anchor: THREE.Vector3, carried: number): void {
    if (this.gatesOpen) return;
    this.gatesOpen = true;
    this.state = 'CHOOSING_GATE';

    this.placeGates(anchor);
    const carry = Math.max(0, Math.round(carried));
    this.offerA = {
      reward: 'HOME',
      caller: null,
      value: carry > 0 ? `BANK ${carry} SCRAP` : 'BANK THE RUN',
      amount: carry
    };
    // The one door in the game that ignores the four-voice cap. Whatever picks
    // up after the Behemoth is not answering because it is on your band, and a
    // player who arrives here with four survivors behind them is the only one
    // who will ever hear a fifth in a single night.
    this.offerB = {
      reward: 'SIGNAL',
      caller: this.deck.pickCaller(undefined, true),
      value: 'ONE OF THREE FAVOURS',
      amount: 0
    };
    this.gateA.activate(this.gatePosA, 'HOME', true, null, this.offerA.value);
    this.gateB.activate(this.gatePosB, 'SIGNAL', true, this.offerB.caller, this.offerB.value);
  }

  /** What a salvage gate is worth right now, before the player commits to it. */
  private scrapPayout(): number {
    return Math.round((45 + this.current * 12) * this.night.scrapMult);
  }

  private signalOffer(favoured?: CallerArtId): GateOffer {
    return {
      reward: 'SIGNAL',
      caller: this.deck.pickCaller(favoured),
      value: 'ONE OF THREE FAVOURS',
      amount: 0
    };
  }

  private makeOffer(reward: RewardType, favoured?: CallerArtId): GateOffer {
    switch (reward) {
      case 'SIGNAL':
        return this.signalOffer(favoured);
      case 'SCRAP': {
        const amount = this.scrapPayout();
        return { reward, caller: null, value: `+${amount} SCRAP`, amount };
      }
      case 'SUPPLIES':
        return { reward, caller: null, value: '+15 MAX · PATCH UP', amount: 0 };
      case 'ARSENAL':
        return { reward, caller: null, value: '+12% DAMAGE', amount: 0 };
      case 'TRADE':
        return { reward, caller: null, value: 'GOODS FOR SCRAP', amount: 0 };
      case 'WORKBENCH':
        return { reward, caller: null, value: 'REWORK THE GUN', amount: 0 };
      default:
        return { reward, caller: null, value: '', amount: 0 };
    }
  }

  /**
   * Two plaques, dealt off the run's bag rather than rolled fresh each time.
   *
   * Nothing about the odds lives here any more: which rewards are in the bag,
   * which one is overdue, whether tonight is a workbench night and whose voice
   * is on the radio gate are all the deck's business, and the deck remembers
   * what the player has been doing with its offers.
   */
  private rollOffers(favoured?: CallerArtId): [GateOffer, GateOffer] {
    const draw = this.deck.draw({
      sector: this.current,
      isTraderSector: this.isTraderSector
    });

    return [
      this.makeOffer(draw.rewards[0], favoured),
      this.makeOffer(draw.rewards[1], favoured)
    ];
  }

  public updateGates(delta: number): void {
    if (!this.gatesOpen) return;
    this.gateA.update(delta);
    this.gateB.update(delta);
  }

  public checkGateEntry(playerPos: THREE.Vector3): void {
    if (this.state !== 'CHOOSING_GATE') return;

    if (this.gateA.checkPlayerCollision(playerPos)) {
      this.beginTransition(this.offerA ?? this.makeOffer(this.gateA.rewardType));
    } else if (this.gateB.checkPlayerCollision(playerPos)) {
      this.beginTransition(this.offerB ?? this.makeOffer(this.gateB.rewardType));
    }
  }

  public get isFading(): boolean {
    return this.fading;
  }

  public beginTransition(offer: GateOffer): void {
    // The bag is told about both doors, not just the one that was walked
    // through: a workbench left standing in the street is the whole reason the
    // deck knows to chase the player with it later.
    const shown = [this.offerA?.reward, this.offerB?.reward].filter(Boolean) as RewardType[];
    if (shown.length) this.deck.noteChoice(offer.reward, shown);

    this.state = 'TRANSITIONING';
    this.fading = true;
    this.transitionTimer = 0;
    this.pendingOffer = offer;
    if (offer.reward === 'TRADE') this.traderNext = true;
    this.fadeOverlay.style.opacity = '1';
  }

  public updateTransition(delta: number): void {
    if (!this.fading) return;

    this.transitionTimer += delta;

    // Swap the world at the darkest point of the fade.
    if (this.transitionTimer >= 0.31 && this.pendingOffer) {
      const offer = this.pendingOffer;
      this.pendingOffer = null;
      this.onGateChosen?.(offer);
    }

    if (this.transitionTimer >= this.transitionDuration) {
      this.fading = false;
      // The midpoint may already have chosen a state for the new sector
      // (the trader opens its gates straight away); only the placeholder
      // TRANSITIONING value should be replaced here.
      if (this.state === 'TRANSITIONING') this.state = 'COMBAT';
      this.fadeOverlay.style.opacity = '0';
      this.onTransitionDone?.();
    }
  }

  /** Force the overlay clear — used when bailing back to the shelter. */
  public clearFade(): void {
    this.fading = false;
    this.pendingOffer = null;
    this.transitionTimer = 0;
    this.fadeOverlay.style.opacity = '0';
  }

  public reset(): void {
    this.gateA.deactivate();
    this.gateB.deactivate();
    this.offerA = null;
    this.offerB = null;
    this.gatesOpen = false;
    this.traderNext = false;
    this.state = 'COMBAT';
    this.clearFade();
  }
}
