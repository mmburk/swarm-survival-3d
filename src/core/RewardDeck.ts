import type { RewardType } from '../entities/ExitDoor';
import type { Caller } from '../ui/BoonModal';

/**
 * WHAT IS BEHIND THE NEXT TWO DOORS.
 *
 * Not a coin toss, and not a fixed rota. Hades runs its doors off a weighted
 * bag with a pity timer bolted to it, and this is the same machine wearing the
 * clothes of a dead city:
 *
 *  - The run starts with a bag of tickets. Walking through a door spends that
 *    door's ticket, so taking salvage twice running all but empties salvage out
 *    of the bag and the street starts offering you something else.
 *  - Anything the bag has not shown you for a while gets heavier every gate,
 *    and a run that has gone two whole streets without a voice on it gets one
 *    forced onto a door. Boons are the spine of a build; the bag is not allowed
 *    to starve you of them.
 *  - The workbench is not in the bag at all. It is scheduled — twice a run, in
 *    windows, and if you turn one down the street remembers and puts it in
 *    front of you again rather than shrugging and forgetting.
 *  - Once four different survivors have handed you something, the band closes:
 *    the gates stop offering a fifth voice and start deepening the four you
 *    have. That is what turns a pile of upgrades into a build.
 *
 * All of it runs off one seeded stream, so a run is reproducible from its seed
 * — but only if you make the same choices. The bag's state at gate seven is
 * downstream of every door you took to get there, which is exactly the property
 * that makes a seed interesting instead of a spoiler.
 */

/** Everything a gate can advertise except the way home, which is never drawn. */
export type DrawnReward = Exclude<RewardType, 'HOME'>;

export const ALL_CALLERS: Caller[] = ['SARGE', 'VASQUEZ', 'MAE', 'ELI', 'QUIET'];

/**
 * The bag as it is filled at the top of every region.
 *
 * Radio contacts outnumber everything else three to one because they are the
 * only reward that compounds; the workbench sits at zero because it is dealt by
 * the scheduler below rather than drawn.
 */
const BAG: Record<DrawnReward, number> = {
  SIGNAL: 3,
  SUPPLIES: 2,
  SCRAP: 2,
  ARSENAL: 1,
  TRADE: 1,
  WORKBENCH: 0
};

/** Sectors between bosses — one "region", and one refill of the bag. */
const REGION = 5;

/** Streets without a voice on either door before one is forced. */
const SIGNAL_PITY = 2;

/** How much heavier an unseen ticket gets per street it stays unseen. */
const PITY_STEP = 0.75;

/**
 * A spent ticket is not removed, it is crushed. Keeping a sliver of weight
 * means a bag that has been drained of everything else can still deal rather
 * than dividing by zero, and it lets a rare repeat happen instead of the
 * sequence becoming legible.
 */
const SPENT_WEIGHT = 0.06;

/** Four survivors and the band closes. The Olympian cap, in a stairwell. */
export const POOL_MAX = 4;

/**
 * When the workbench is dealt: the first inside the opening region, the second
 * once the run has settled. Both are windows, not fixed rooms — the offer lands
 * somewhere inside one, and is guaranteed by its last street.
 */
const WORKS_WINDOWS: Array<[number, number]> = [[2, 4], [11, 14]];

/** Missed both windows? The street stops being subtle about it from here. */
const WORKS_SAFETY = 16;

/** The most a single run can rework the gun. */
const WORKS_MAX = 2;

/**
 * The most a run will ever *offer* it. A player who keeps walking past the
 * bench has said something, and a street that keeps shoving it back in their
 * face stops reading as a rare find and starts reading as a nag.
 */
const WORKS_OFFER_CAP = 4;

export interface GateDraw {
  rewards: [DrawnReward, DrawnReward];
  /** True when the pity timer, not the bag, put a voice on one of the doors. */
  forcedSignal: boolean;
}

export interface DrawContext {
  sector: number;
  /** Vic is already here; the shortcut to him should not be on the doors. */
  isTraderSector: boolean;
}

/** mulberry32 — small, fast, and good enough that a seed means something. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyCount(): Record<DrawnReward, number> {
  return { SIGNAL: 0, SUPPLIES: 0, SCRAP: 0, ARSENAL: 0, TRADE: 0, WORKBENCH: 0 };
}

export class RewardDeck {
  /** The number the whole run is dealt from. Shown at the debrief. */
  public seed: number = 0;

  private rng: () => number = makeRng(1);

  private tickets: Record<DrawnReward, number> = emptyCount();
  /** Streets since each reward was last painted on a door. Drives the pity. */
  private sinceOffered: Record<DrawnReward, number> = emptyCount();

  /** Which region's bag is currently on the table, so refills happen once. */
  private region: number = -1;

  /** Survivors who have actually handed the player something this run. */
  private pool: Caller[] = [];
  /** The last two voices dealt, so the band is worked through, not repeated. */
  private recent: Caller[] = [];

  /** The frequency the handset was left on downstairs. Overrides one draw. */
  private tuned: Caller | null = null;
  private tunedSpent: boolean = true;

  private worksTaken: number = 0;
  private worksOffered: number = 0;
  /** Set when a workbench door was turned down. The street does not forget. */
  private worksOwed: boolean = false;
  /** The first street the debt may be collected on — never the same region. */
  private worksOwedFrom: number = 0;
  /** A debt is chased once, not until the player gives in. */
  private worksChased: boolean = false;
  private lastWorksSector: number = -99;

  /**
   * @param tuned  Whoever the handset was tuned to before the run — the first
   *               voice on a door is guaranteed to be theirs.
   * @param seed   Fixed seed, for anyone who wants to replay a run exactly.
   */
  public beginRun(tuned: Caller | null = null, seed?: number): void {
    this.seed = (seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.rng = makeRng(this.seed);

    this.tickets = emptyCount();
    this.sinceOffered = emptyCount();
    this.region = -1;

    this.pool = [];
    this.recent = [];

    this.tuned = tuned;
    this.tunedSpent = !tuned;

    this.worksTaken = 0;
    this.worksOffered = 0;
    this.worksOwed = false;
    this.worksOwedFrom = 0;
    this.worksChased = false;
    this.lastWorksSector = -99;
  }

  /** Base-36, upper case: short enough to read out over a radio. */
  public get seedLabel(): string {
    return this.seed.toString(36).toUpperCase().padStart(7, '0');
  }

  public get callerPool(): Caller[] {
    return this.pool.slice();
  }

  public get bandIsClosed(): boolean {
    return this.pool.length >= POOL_MAX;
  }

  public get worksFitted(): number {
    return this.worksTaken;
  }

  /**
   * The run's own stream, for anything downstream that should be part of the
   * same seeded sequence — which offers the workbench deals, for instance.
   */
  public random(): number {
    return this.rng();
  }

  // ------------------------------------------------------------------ the bag

  private refillFor(sector: number): void {
    const region = Math.floor((sector - 1) / REGION);
    if (region === this.region) return;
    this.region = region;
    for (const key of Object.keys(BAG) as DrawnReward[]) {
      // Tickets left over are kept rather than discarded: a player who has been
      // ignoring salvage all region should find the street thick with it.
      this.tickets[key] = Math.max(this.tickets[key], BAG[key]);
    }
  }

  private weight(reward: DrawnReward): number {
    const held = this.tickets[reward];
    const base = held > 0 ? held : SPENT_WEIGHT;
    return base * (1 + Math.min(4, this.sinceOffered[reward]) * PITY_STEP);
  }

  private eligible(ctx: DrawContext): DrawnReward[] {
    const out: DrawnReward[] = ['SIGNAL', 'SUPPLIES', 'SCRAP', 'ARSENAL'];
    // Vic is a detour, not an early-run reward, and never a door out of his own
    // underpass.
    if (ctx.sector >= 4 && !ctx.isTraderSector) out.push('TRADE');
    return out;
  }

  private weightedPick(from: DrawnReward[]): DrawnReward {
    const total = from.reduce((sum, r) => sum + this.weight(r), 0);
    let roll = this.rng() * total;
    for (const r of from) {
      roll -= this.weight(r);
      if (roll <= 0) return r;
    }
    return from[from.length - 1];
  }

  // -------------------------------------------------------------- the hammer

  /**
   * Whether a workbench belongs on one of tonight's doors.
   *
   * Inside a window the chance ramps to certainty by the window's last street,
   * so the offer always lands somewhere in it rather than being a coin flip
   * that can miss entirely. A declined workbench outranks all of that.
   */
  private worksDue(sector: number): boolean {
    if (this.worksTaken >= WORKS_MAX) return false;
    if (this.worksOffered >= WORKS_OFFER_CAP) return false;
    // Never two streets running: a gun that gets reworked twice in ninety
    // seconds has not been played with in between.
    if (sector - this.lastWorksSector < 2) return false;

    // A bench that was walked past. It comes back once, a region later, at a
    // certainty — and while that debt is on the books nothing else deals a
    // bench, so the chase cannot turn into a drumbeat.
    if (this.worksOwed) return sector >= this.worksOwedFrom;

    const window = WORKS_WINDOWS[this.worksTaken];
    if (window) {
      const [lo, hi] = window;
      if (sector >= lo && sector <= hi) {
        return this.rng() < 1 / (hi - sector + 1);
      }
    }

    // Past every window with tools still owed to you — the last-region net.
    if (sector >= WORKS_SAFETY) return this.rng() < 0.5;

    return false;
  }

  // ------------------------------------------------------------------- dealing

  /** The two things tonight's doors advertise. */
  public draw(ctx: DrawContext): GateDraw {
    this.refillFor(ctx.sector);

    const picked: DrawnReward[] = [];

    if (this.worksDue(ctx.sector)) {
      picked.push('WORKBENCH');
      this.worksOffered++;
      this.lastWorksSector = ctx.sector;
      // Putting it back in front of them settles the debt whichever way they
      // go, and marks the chase as spent.
      if (this.worksOwed) this.worksChased = true;
      this.worksOwed = false;
    }

    const forcedSignal = this.sinceOffered.SIGNAL >= SIGNAL_PITY;
    if (forcedSignal && !picked.includes('SIGNAL')) picked.push('SIGNAL');

    const pool = this.eligible(ctx).filter((r) => !picked.includes(r));
    while (picked.length < 2 && pool.length > 0) {
      const next = this.weightedPick(pool);
      picked.push(next);
      pool.splice(pool.indexOf(next), 1);
    }

    // Both doors saying the same word is the one outcome the bag must never
    // produce; two identical plaques are not a choice.
    if (picked.length < 2) picked.push(picked[0] === 'SCRAP' ? 'SUPPLIES' : 'SCRAP');

    for (const key of Object.keys(this.sinceOffered) as DrawnReward[]) {
      this.sinceOffered[key] = picked.includes(key) ? 0 : this.sinceOffered[key] + 1;
    }

    const pair: [DrawnReward, DrawnReward] = this.rng() < 0.5
      ? [picked[0], picked[1]]
      : [picked[1], picked[0]];

    return { rewards: pair, forcedSignal };
  }

  /**
   * What the player actually walked through, and what they walked past.
   *
   * Both halves matter: the taken door spends its ticket, and a workbench left
   * standing in the street is what puts the debt on the books.
   */
  public noteChoice(taken: RewardType, shown: RewardType[]): void {
    if (shown.includes('WORKBENCH') && taken !== 'WORKBENCH' && !this.worksChased) {
      this.worksOwed = true;
      // Collected in the next region, not the next street: the promise is that
      // the run has not thrown the tools away, not that they are following you.
      this.worksOwedFrom = (Math.floor((this.region + 1) * REGION)) + 1;
    }

    if (taken === 'WORKBENCH') {
      this.worksTaken++;
      this.worksOwed = false;
      // Each fitting earns the next window its own chase.
      this.worksChased = false;
      return;
    }

    if (taken === 'HOME') return;
    const key = taken as DrawnReward;
    this.tickets[key] = Math.max(0, this.tickets[key] - 1);
  }

  // -------------------------------------------------------------- whose voice

  /**
   * Who is on the other end of the next radio gate.
   *
   * The handset's tuning takes the first one outright. After that the band is
   * worked through rather than repeated — until four survivors have helped,
   * at which point the run has a shape and the gates stop diluting it.
   */
  public pickCaller(favoured?: Caller, ignorePool: boolean = false): Caller {
    if (this.tuned && !this.tunedSpent) {
      this.tunedSpent = true;
      this.remember(this.tuned);
      return this.tuned;
    }

    const base = this.bandIsClosed && !ignorePool ? this.pool : ALL_CALLERS;
    const fresh = base.filter((c) => !this.recent.includes(c));
    const options = fresh.length ? fresh : base;

    // Whoever the player has been leaning on gets a thumb on the scale, never a
    // monopoly.
    const pick = favoured && options.includes(favoured) && this.rng() < 0.4
      ? favoured
      : options[Math.floor(this.rng() * options.length)];

    this.remember(pick);
    return pick;
  }

  private remember(caller: Caller): void {
    this.recent.push(caller);
    if (this.recent.length > 2) this.recent.shift();
  }

  /**
   * A favour actually taken. This, and only this, is what closes the band.
   *
   * Deliberately not capped: the pool cannot pass four on its own, because
   * ordinary gates stop offering outsiders the moment it reaches four. A fifth
   * name in here means the player got past that the only way there is — the
   * gate that opens after the Behemoth, which does not answer to the band.
   */
  public noteBoon(caller: Caller): void {
    if (this.pool.includes(caller)) return;
    this.pool.push(caller);
  }
}
