/**
 * Permanent progression, bought at the workbench in the shelter.
 *
 * These are the run-to-run upgrades (the Mirror of Night in Hades). They are
 * deliberately small per rank: the point is that a bad run still moves the
 * needle, not that rank 5 trivialises the game.
 */

export type MetaKey =
  | 'plating'
  | 'boots'
  | 'scavenger'
  | 'steadyHands'
  | 'sharpEye'
  | 'magnet'
  | 'secondWind'
  | 'fieldMedic';

export interface MetaDef {
  key: MetaKey;
  name: string;
  desc: (rank: number) => string;
  maxRank: number;
  /** Scrap cost of buying the rank after `rank`. */
  cost: (rank: number) => number;
}

export const META_DEFS: MetaDef[] = [
  {
    key: 'plating',
    name: 'Scrap Plating',
    desc: (r) => `+${r * 12} maximum health`,
    maxRank: 5,
    cost: (r) => 30 + r * 20
  },
  {
    key: 'boots',
    name: 'Broken-In Boots',
    desc: (r) => `+${(r * 0.55).toFixed(2)} movement speed`,
    maxRank: 4,
    cost: (r) => 35 + r * 25
  },
  {
    key: 'scavenger',
    name: 'Scavenger\'s Eye',
    desc: (r) => `+${r * 15}% scrap recovered from the dead`,
    maxRank: 4,
    cost: (r) => 40 + r * 30
  },
  {
    key: 'steadyHands',
    name: 'Steady Hands',
    desc: (r) => `+${r * 7}% rate of fire`,
    maxRank: 4,
    cost: (r) => 45 + r * 30
  },
  {
    key: 'sharpEye',
    name: 'Sharp Eye',
    desc: (r) => `+${r * 5}% chance of a clean headshot`,
    maxRank: 4,
    cost: (r) => 45 + r * 30
  },
  {
    key: 'magnet',
    name: 'Deep Pockets',
    desc: (r) => `+${(r * 1.6).toFixed(1)}m salvage pickup range`,
    maxRank: 3,
    cost: (r) => 30 + r * 20
  },
  {
    key: 'fieldMedic',
    name: 'Field Medic',
    desc: (r) => `Bandages heal +${r * 40}% and drop more often`,
    maxRank: 3,
    cost: (r) => 50 + r * 35
  },
  {
    key: 'secondWind',
    name: 'Second Wind',
    desc: (r) => `Get back up ${r} extra time${r === 1 ? '' : 's'} per run`,
    maxRank: 2,
    cost: (r) => 180 + r * 220
  }
];

/**
 * The Long Night — voluntary difficulty, the Pact of Punishment analogue.
 * Higher nights are harder but pay considerably better, which is the only
 * sane reason to pick one.
 */
export interface NightTier {
  level: number;
  name: string;
  desc: string;
  enemyHealth: number;
  enemySpeed: number;
  enemyCount: number;
  scrapMult: number;
}

export const NIGHT_TIERS: NightTier[] = [
  { level: 0, name: 'Dusk', desc: 'The city as it is. Bad enough.', enemyHealth: 1.0, enemySpeed: 1.0, enemyCount: 1.0, scrapMult: 1.0 },
  { level: 1, name: 'Nightfall', desc: 'They are hungrier after dark.', enemyHealth: 1.2, enemySpeed: 1.06, enemyCount: 1.15, scrapMult: 1.3 },
  { level: 2, name: 'Dead Hours', desc: 'The herd has found the street.', enemyHealth: 1.45, enemySpeed: 1.12, enemyCount: 1.35, scrapMult: 1.7 },
  { level: 3, name: 'Long Night', desc: 'Something is driving them toward you.', enemyHealth: 1.8, enemySpeed: 1.2, enemyCount: 1.6, scrapMult: 2.2 },
  { level: 4, name: 'Last Light', desc: 'There is no morning at the end of this one.', enemyHealth: 2.3, enemySpeed: 1.3, enemyCount: 1.9, scrapMult: 3.0 }
];

/**
 * What a bad night costs.
 *
 * Scrap is *carried*, not banked. Everything picked up on the street stays in
 * the player's pockets for the whole run — the workbench never sees a single
 * piece of it until the run is over. Walking back through the door after the
 * Behemoth hands over all of it; dying (or turning back from the pause menu)
 * leaves everything but this share on the ground.
 *
 * The door after the Behemoth only means something because this number is
 * less than one. It is the only thing standing between "go deeper" and a
 * decision the player never has to think about.
 */
export const SCRAP_KEPT_ON_DEATH = 0.4;

/** Splits a run's carry at the door. Rounded so the two halves always sum. */
export function settleRun(carried: number, survived: boolean): { banked: number; lost: number } {
  const safe = Math.max(0, Math.round(carried));
  if (survived) return { banked: safe, lost: 0 };
  const banked = Math.floor(safe * SCRAP_KEPT_ON_DEATH);
  return { banked, lost: safe - banked };
}
