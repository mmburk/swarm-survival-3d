import { META_DEFS, type MetaKey } from '../config/Progression';
import { WEAPONS, type WeaponId } from '../config/Weapons';

export type MetaRanks = Record<MetaKey, number>;

export interface SaveData {
  /** The single persistent currency. Kept on death — that is the whole point. */
  scrap: number;
  meta: MetaRanks;
  unlockedWeapons: WeaponId[];
  unlockedMods: string[];
  /** Which weapons currently have their field mod fitted. */
  activeMods: Partial<Record<WeaponId, boolean>>;
  lastWeapon: WeaponId;
  nightLevel: number;
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
        base.unlockedMods = Array.isArray(parsed.unlockedMods) ? parsed.unlockedMods.slice() : [];
        base.activeMods = parsed.activeMods ? { ...parsed.activeMods } : {};

        if (Array.isArray(parsed.unlockedWeapons)) {
          const valid = parsed.unlockedWeapons.filter((w) => !!WEAPONS[w]);
          base.unlockedWeapons = Array.from(new Set<WeaponId>(['RANGER', ...valid]));
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

  /** Wipes everything. Only reachable from an explicit confirm in the records screen. */
  public static wipe(): void {
    this.cache = defaultSave();
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
