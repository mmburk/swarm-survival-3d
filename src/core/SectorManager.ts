import * as THREE from 'three';
import { ExitDoor, type RewardType } from '../entities/ExitDoor';
import { EnemyType } from '../entities/Enemy';
import { NIGHT_TIERS, type NightTier } from '../config/Progression';

export type SectorState = 'COMBAT' | 'CLEARED' | 'CHOOSING_GATE' | 'TRANSITIONING';

export interface SectorPlan {
  shamblers: number;
  sprinters: number;
  bloaters: number;
  butchers: number;
  bursters: number;
  isBoss: boolean;
  isTrader: boolean;
}

const GATE_A = new THREE.Vector3(-17, 0, -19);
const GATE_B = new THREE.Vector3(17, 0, -19);

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
    SHAMBLER: 0, SPRINTER: 0, BLOATER: 0, BUTCHER: 0, BURSTER: 0
  };
  public isBossSector: boolean = false;
  public isTraderSector: boolean = false;
  public spawnTimer: number = 0;

  public night: NightTier = NIGHT_TIERS[0];

  private transitionTimer: number = 0;
  private readonly transitionDuration: number = 0.62;
  private pendingReward: RewardType | null = null;
  private fadeOverlay: HTMLElement;

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

  public onGateChosen: ((reward: RewardType) => void) | null = null;
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
      return { shamblers: 14, sprinters: 8, bloaters: 4, butchers: 2, bursters: 4, isBoss: true, isTrader: false };
    }
    if (sector % this.bossEvery === 3) {
      return { shamblers: 0, sprinters: 0, bloaters: 0, butchers: 0, bursters: 0, isBoss: false, isTrader: true };
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
    this.isBossSector = p.isBoss;
    this.isTraderSector = p.isTrader;

    this.gateA.deactivate();
    this.gateB.deactivate();

    return p;
  }

  public remainingSpawns(): number {
    return this.toSpawn.SHAMBLER + this.toSpawn.SPRINTER + this.toSpawn.BLOATER +
           this.toSpawn.BUTCHER + this.toSpawn.BURSTER;
  }

  /** Weighted draw so the dangerous types trickle in rather than arriving as a block. */
  public nextSpawnType(): EnemyType {
    // Rarer types are down-weighted so they arrive spread through the wave
    // rather than as one lump at the end of the queue.
    const bias: Record<EnemyType, number> = {
      SHAMBLER: 1.0, SPRINTER: 0.9, BLOATER: 0.7, BURSTER: 0.6, BUTCHER: 0.45
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

  public openGates(): void {
    if (this.gatesOpen) return;
    this.gatesOpen = true;
    this.state = 'CHOOSING_GATE';

    const [a, b] = this.rollRewards();
    this.gateA.activate(GATE_A, a);
    this.gateB.activate(GATE_B, b);
  }

  /**
   * Always offers two different things, and usually one of them is a radio
   * contact — boons are the spine of the build, so they should not be rare.
   */
  private rollRewards(): [RewardType, RewardType] {
    const others: RewardType[] = ['SUPPLIES', 'SCRAP', 'ARSENAL'];
    const pickOther = () => others[Math.floor(Math.random() * others.length)];

    if (Math.random() < 0.72) {
      const other = pickOther();
      return Math.random() < 0.5 ? ['SIGNAL', other] : [other, 'SIGNAL'];
    }

    const a = pickOther();
    let b = pickOther();
    if (a === b) b = others[(others.indexOf(a) + 1) % others.length];
    return [a, b];
  }

  public updateGates(delta: number): void {
    if (!this.gatesOpen) return;
    this.gateA.update(delta);
    this.gateB.update(delta);
  }

  public checkGateEntry(playerPos: THREE.Vector3): void {
    if (this.state !== 'CHOOSING_GATE') return;

    if (this.gateA.checkPlayerCollision(playerPos)) {
      this.beginTransition(this.gateA.rewardType);
    } else if (this.gateB.checkPlayerCollision(playerPos)) {
      this.beginTransition(this.gateB.rewardType);
    }
  }

  public get isFading(): boolean {
    return this.fading;
  }

  public beginTransition(reward: RewardType): void {
    this.state = 'TRANSITIONING';
    this.fading = true;
    this.transitionTimer = 0;
    this.pendingReward = reward;
    this.fadeOverlay.style.opacity = '1';
  }

  public updateTransition(delta: number): void {
    if (!this.fading) return;

    this.transitionTimer += delta;

    // Swap the world at the darkest point of the fade.
    if (this.transitionTimer >= 0.31 && this.pendingReward) {
      const reward = this.pendingReward;
      this.pendingReward = null;
      this.onGateChosen?.(reward);
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
    this.pendingReward = null;
    this.transitionTimer = 0;
    this.fadeOverlay.style.opacity = '0';
  }

  public reset(): void {
    this.gateA.deactivate();
    this.gateB.deactivate();
    this.gatesOpen = false;
    this.state = 'COMBAT';
    this.clearFade();
  }
}
