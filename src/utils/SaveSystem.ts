import { META_DEFS, type MetaKey } from '../config/Progression';
import { WEAPONS, type WeaponId } from '../config/Weapons';
import { ANIMALS, type AnimalId } from '../config/Animals';
import { ALL_CALLERS } from '../core/RewardDeck';
import type { Caller } from '../ui/BoonModal';
import { emptyTally, type Tally } from '../narrative/Prophecies';

export type MetaRanks = Record<MetaKey, number>;

/**
 * What the player has been told so far.
 *
 * `seen` is the struck-off list — a line in here never plays again. `heard`
 * counts lines per survivor, which is how the band knows who the player has
 * actually been listening to.
 */
export interface NarrativeState {
  seen: string[];
  heard: Partial<Record<Caller, number>>;
}

/**
 * The frame ceilings offered on the settings card. `0` means "whatever the
 * display does" — the loop hands every animation frame straight through, which
 * is what the game did before there was a setting at all.
 */
export const FPS_CAPS = [30, 45, 60, 75, 90, 120, 144, 0] as const;

export interface DisplaySettings {
  /** Frames per second the loop refuses to exceed. 0 leaves it to the display. */
  fpsCap: number;
  /** The little counter in the corner. */
  showFps: boolean;
  /**
   * Master output, 0 to 1. The game starts with sound on, so the one control
   * that has to exist before anything else about sound is worth arguing over
   * is the one that turns it down.
   */
  volume: number;
}

export interface SaveData {
  /**
   * The single persistent currency — the pile on the workbench, not what is in
   * the player's pockets. A run's carry only lands here when the run ends, and
   * dying leaves most of it in the street. See `settleRun`.
   */
  scrap: number;
  meta: MetaRanks;
  unlockedWeapons: WeaponId[];
  unlockedMods: string[];
  /** Which weapons currently have their field mod fitted. */
  activeMods: Partial<Record<WeaponId, boolean>>;
  lastWeapon: WeaponId;
  nightLevel: number;
  /**
   * The frequency the handset was left on. Whoever it is, the first radio gate
   * of the next run is guaranteed to be theirs — the keepsake, in a shelter
   * with one working radio set instead of a display case.
   */
  tuned: Caller | null;
  /**
   * What is in the pens. Rook is in here from the first night — he was already
   * downstairs — and everything else is bought out of the yard for good.
   */
  penned: AnimalId[];
  /** Who is coming with you. Null is nobody, which is a real choice. */
  atHeel: AnimalId | null;
  narrative: NarrativeState;
  /** How the machine is asked to run. Not progression — it survives a wipe. */
  settings: DisplaySettings;
  /** Prophecies taken off the pin board and paid out. */
  claimed: string[];
  tally: Tally;
  stats: {
    runs: number;
    deaths: number;
    bestSector: number;
    totalKills: number;
    bestScore: number;
    clears: number;
  };
}

const KEY = 'lastlight_save_v1';
const LEGACY_CORES = 'cyber_swarm_cores';
const LEGACY_SCORE = 'cyber_swarm_high_score';
const LEGACY_META = 'cyber_swarm_meta_v2';

function emptyMeta(): MetaRanks {
  const m = {} as MetaRanks;
  for (const d of META_DEFS) m[d.key] = 0;
  return m;
}

function defaultSave(): SaveData {
  return {
    scrap: 0,
    meta: emptyMeta(),
    unlockedWeapons: ['RANGER'],
    unlockedMods: [],
    activeMods: {},
    lastWeapon: 'RANGER',
    nightLevel: 0,
    tuned: null,
    penned: ['ROOK'],
    atHeel: null,
    narrative: { seen: [], heard: {} },
    settings: { fpsCap: 0, showFps: false, volume: 0.3 },
    claimed: [],
    tally: emptyTally(),
    stats: { runs: 0, deaths: 0, bestSector: 0, totalKills: 0, bestScore: 0, clears: 0 }
  };
}

export class SaveSystem {
  private static cache: SaveData | null = null;

  public static load(): SaveData {
    if (this.cache) return this.cache;

    const base = defaultSave();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        base.scrap = Math.max(0, Math.floor(parsed.scrap ?? 0));
        base.lastWeapon = (parsed.lastWeapon && WEAPONS[parsed.lastWeapon]) ? parsed.lastWeapon : 'RANGER';
        base.nightLevel = Math.max(0, Math.min(4, parsed.nightLevel ?? 0));
        base.tuned = parsed.tuned && ALL_CALLERS.includes(parsed.tuned) ? parsed.tuned : null;
        base.unlockedMods = Array.isArray(parsed.unlockedMods) ? parsed.unlockedMods.slice() : [];
        base.activeMods = parsed.activeMods ? { ...parsed.activeMods } : {};

        if (Array.isArray(parsed.unlockedWeapons)) {
          const valid = parsed.unlockedWeapons.filter((w) => !!WEAPONS[w]);
          base.unlockedWeapons = Array.from(new Set<WeaponId>(['RANGER', ...valid]));
        }
        if (Array.isArray(parsed.penned)) {
          const kept = parsed.penned.filter((a) => !!ANIMALS[a]);
          base.penned = Array.from(new Set<AnimalId>(['ROOK', ...kept]));
        }
        // An animal that is no longer in the save cannot be at your heel — a
        // wiped pen would otherwise send a ghost out with you.
        if (parsed.atHeel && ANIMALS[parsed.atHeel] && base.penned.includes(parsed.atHeel)) {
          base.atHeel = parsed.atHeel;
        }
        if (parsed.meta) {
          for (const d of META_DEFS) {
            const v = (parsed.meta as Partial<MetaRanks>)[d.key];
            base.meta[d.key] = Math.max(0, Math.min(d.maxRank, Math.floor(v ?? 0)));
          }
        }
        if (parsed.stats) {
          base.stats = { ...base.stats, ...parsed.stats };
        }
        if (parsed.narrative) {
          base.narrative.seen = Array.isArray(parsed.narrative.seen) ? parsed.narrative.seen.slice() : [];
          base.narrative.heard = parsed.narrative.heard ? { ...parsed.narrative.heard } : {};
        }
        if (parsed.settings) {
          const cap = Math.floor(parsed.settings.fpsCap ?? 0);
          base.settings.fpsCap = (FPS_CAPS as readonly number[]).includes(cap) ? cap : 0;
          base.settings.showFps = !!parsed.settings.showFps;
          const vol = Number(parsed.settings.volume);
          base.settings.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.3;
        }
        if (Array.isArray(parsed.claimed)) base.claimed = parsed.claimed.slice();
        if (parsed.tally) base.tally = { ...base.tally, ...parsed.tally };
      } else {
        this.migrateLegacy(base);
      }
    } catch {
      // Corrupt save — start clean rather than trapping the player on a crash loop.
    }

    this.cache = base;
    return base;
  }

  /** Carries over currency and a couple of ranks from the pre-outbreak build. */
  private static migrateLegacy(save: SaveData): void {
    try {
      const cores = parseInt(localStorage.getItem(LEGACY_CORES) ?? '0', 10);
      if (cores > 0) save.scrap = cores;

      const score = parseInt(localStorage.getItem(LEGACY_SCORE) ?? '0', 10);
      if (score > 0) save.stats.bestScore = score;

      const meta = localStorage.getItem(LEGACY_META);
      if (meta) {
        const parsed = JSON.parse(meta);
        save.meta.plating = Math.min(5, Math.max(0, parsed.vitality ?? 0));
        save.meta.boots = Math.min(4, Math.max(0, parsed.nimbleLegs ?? 0));
        save.meta.scavenger = Math.min(4, Math.max(0, parsed.scavenger ?? 0));
      }
    } catch {
      // Nothing to carry over.
    }
  }

  public static save(): void {
    if (!this.cache) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.cache));
    } catch {
      // Storage full or blocked (private browsing). The run still plays fine.
    }
  }

  // ---- currency -----------------------------------------------------------

  public static getScrap(): number {
    return this.load().scrap;
  }

  public static addScrap(amount: number): number {
    const s = this.load();
    s.scrap = Math.max(0, s.scrap + Math.round(amount));
    this.save();
    return s.scrap;
  }

  public static spendScrap(amount: number): boolean {
    const s = this.load();
    if (s.scrap < amount) return false;
    s.scrap -= amount;
    this.save();
    return true;
  }

  // ---- workbench ----------------------------------------------------------

  public static getMeta(): MetaRanks {
    return this.load().meta;
  }

  public static getRank(key: MetaKey): number {
    return this.load().meta[key] ?? 0;
  }

  public static buyMetaRank(key: MetaKey): boolean {
    const s = this.load();
    const def = META_DEFS.find((d) => d.key === key);
    if (!def) return false;

    const rank = s.meta[key] ?? 0;
    if (rank >= def.maxRank) return false;
    if (!this.spendScrap(def.cost(rank))) return false;

    s.meta[key] = rank + 1;
    this.save();
    return true;
  }

  // ---- weapon rack --------------------------------------------------------

  public static isWeaponUnlocked(id: WeaponId): boolean {
    return this.load().unlockedWeapons.includes(id);
  }

  public static unlockWeapon(id: WeaponId): boolean {
    const s = this.load();
    if (s.unlockedWeapons.includes(id)) return false;
    if (!this.spendScrap(WEAPONS[id].unlockCost)) return false;
    s.unlockedWeapons.push(id);
    this.save();
    return true;
  }

  public static isModUnlocked(modId: string): boolean {
    return this.load().unlockedMods.includes(modId);
  }

  public static unlockMod(id: WeaponId): boolean {
    const s = this.load();
    const mod = WEAPONS[id].mod;
    if (s.unlockedMods.includes(mod.id)) return false;
    if (!this.spendScrap(mod.cost)) return false;
    s.unlockedMods.push(mod.id);
    s.activeMods[id] = true;
    this.save();
    return true;
  }

  public static isModActive(id: WeaponId): boolean {
    return !!this.load().activeMods[id] && this.isModUnlocked(WEAPONS[id].mod.id);
  }

  public static toggleMod(id: WeaponId): void {
    const s = this.load();
    if (!this.isModUnlocked(WEAPONS[id].mod.id)) return;
    s.activeMods[id] = !s.activeMods[id];
    this.save();
  }

  public static getLastWeapon(): WeaponId {
    const s = this.load();
    return s.unlockedWeapons.includes(s.lastWeapon) ? s.lastWeapon : 'RANGER';
  }

  public static setLastWeapon(id: WeaponId): void {
    this.load().lastWeapon = id;
    this.save();
  }

  // ---- the long night -----------------------------------------------------

  public static getNightLevel(): number {
    return this.load().nightLevel;
  }

  public static setNightLevel(level: number): void {
    this.load().nightLevel = Math.max(0, Math.min(4, Math.floor(level)));
    this.save();
  }

  /** Who the set is left tuned to, or null for a handset left scanning. */
  public static getTuned(): Caller | null {
    return this.load().tuned;
  }

  public static setTuned(caller: Caller | null): void {
    this.load().tuned = caller;
    this.save();
  }

  // ---- the pens -----------------------------------------------------------

  public static isPenned(id: AnimalId): boolean {
    return this.load().penned.includes(id);
  }

  public static pennedCount(): number {
    return this.load().penned.length;
  }

  /** Buys an animal out of the yard. Permanent, like a weapon off the wall. */
  public static takeIn(id: AnimalId): boolean {
    const s = this.load();
    if (s.penned.includes(id)) return false;
    if (!this.spendScrap(ANIMALS[id].cost)) return false;
    s.penned.push(id);
    this.save();
    return true;
  }

  /** Who walks out with you tonight. Null is a perfectly good answer. */
  public static getAtHeel(): AnimalId | null {
    const s = this.load();
    return s.atHeel && s.penned.includes(s.atHeel) ? s.atHeel : null;
  }

  public static setAtHeel(id: AnimalId | null): void {
    const s = this.load();
    s.atHeel = id && s.penned.includes(id) ? id : null;
    this.save();
  }

  // ---- display ------------------------------------------------------------

  public static getSettings(): DisplaySettings {
    return this.load().settings;
  }

  /** Anything not on the dial falls back to letting the display decide. */
  public static setFpsCap(cap: number): void {
    const s = this.load();
    s.settings.fpsCap = (FPS_CAPS as readonly number[]).includes(cap) ? cap : 0;
    this.save();
  }

  public static setShowFps(show: boolean): void {
    this.load().settings.showFps = show;
    this.save();
  }

  /** Anything off the 0–1 rail is clamped rather than refused. */
  public static setVolume(vol: number): void {
    const v = Number(vol);
    this.load().settings.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.3;
    this.save();
  }

  // ---- the radio log ------------------------------------------------------

  public static hasHeardLine(id: string): boolean {
    return this.load().narrative.seen.includes(id);
  }

  /** How many lines this survivor has delivered across every run so far. */
  public static heardFrom(caller: Caller): number {
    return this.load().narrative.heard[caller] ?? 0;
  }

  /** Strikes a line off for good and credits it to whoever said it. */
  public static markLineHeard(id: string, caller: Caller): void {
    const n = this.load().narrative;
    if (!n.seen.includes(id)) n.seen.push(id);
    n.heard[caller] = (n.heard[caller] ?? 0) + 1;
    this.save();
  }

  // ---- the pin board ------------------------------------------------------

  public static getTally(): Tally {
    return this.load().tally;
  }

  /**
   * Bumps a counter the ordinary run records do not cover.
   *
   * `deepestClean` is a high-water mark rather than a total, so it is set
   * rather than added — passing the deeper of the two values is the caller's
   * job and `bumpTally` would quietly corrupt it.
   */
  public static bumpTally(key: Exclude<keyof Tally, 'deepestClean'>, by: number = 1): void {
    const t = this.load().tally;
    t[key] += by;
    this.save();
  }

  public static recordCleanDepth(sector: number): void {
    const t = this.load().tally;
    if (sector > t.deepestClean) {
      t.deepestClean = sector;
      this.save();
    }
  }

  public static hasClaimed(id: string): boolean {
    return this.load().claimed.includes(id);
  }

  /** Takes the card off the board and pays for it. */
  public static claimProphecy(id: string, reward: number): void {
    const s = this.load();
    if (s.claimed.includes(id)) return;
    s.claimed.push(id);
    s.scrap += reward;
    this.save();
  }

  /** Ranks bought at the workbench, summed — what the bench prophecy counts. */
  public static totalMetaRanks(): number {
    const m = this.load().meta;
    return META_DEFS.reduce((sum, d) => sum + (m[d.key] ?? 0), 0);
  }

  /** Mods actually fitted to a weapon, not merely bought. */
  public static fittedModCount(): number {
    const s = this.load();
    return s.unlockedWeapons.filter((w) => this.isModActive(w)).length;
  }

  public static unlockedWeaponCount(): number {
    return this.load().unlockedWeapons.length;
  }

  // ---- run records --------------------------------------------------------

  public static getStats() {
    return this.load().stats;
  }

  public static recordRunStart(): void {
    this.load().stats.runs++;
    this.save();
  }

  public static recordRunEnd(sector: number, kills: number, score: number, survived: boolean): void {
    const st = this.load().stats;
    if (!survived) st.deaths++;
    else st.clears++;
    st.bestSector = Math.max(st.bestSector, sector);
    st.totalKills += kills;
    st.bestScore = Math.max(st.bestScore, score);
    this.save();
  }

  /**
   * Wipes everything. Only reachable from an explicit confirm in the records
   * screen — and it spares the display settings, because burning the records is
   * about the run history, not about handing the player back a frame ceiling
   * their machine cannot hold.
   */
  public static wipe(): void {
    const settings = { ...this.load().settings };
    this.cache = defaultSave();
    this.cache.settings = settings;
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_CORES);
      localStorage.removeItem(LEGACY_SCORE);
      localStorage.removeItem(LEGACY_META);
    } catch {
      // Nothing else to do.
    }
  }
}
