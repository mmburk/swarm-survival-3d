/**
 * The armoury.
 *
 * Hades gives you one Infernal Arm per run, picked in the House. Same idea:
 * you commit to a single firearm at the weapon rack before you go out, and
 * each one plays differently enough that the run feels different too.
 *
 * Every weapon also has one "field mod" — the Aspect analogue — bought once
 * with scrap and then toggled for free on later runs.
 */

export type WeaponId = 'RANGER' | 'BOOMSTICK' | 'WIDOWMAKER' | 'STUTTER' | 'HARVESTER';

export type AltFireKind = 'GRENADE' | 'SLUG' | 'PIERCE' | 'NAILBOMB' | 'FANBLADE';

export interface WeaponStats {
  /** Seconds between shots. */
  cooldown: number;
  /** Projectiles per trigger pull. */
  pellets: number;
  /** Total cone width in radians (0 = perfectly accurate). */
  spread: number;
  /** Damage per projectile, before multipliers. */
  damage: number;
  bulletSpeed: number;
  range: number;
  /** Enemies a single round passes through before dying. */
  pierce: number;
  /** Camera shake per shot. */
  trauma: number;
  /** Visual kick on the character rig. */
  recoil: number;
}

export interface AltFire {
  name: string;
  desc: string;
  kind: AltFireKind;
  cooldown: number;
  damage: number;
  /** Blast radius for the kinds that explode. */
  radius: number;
}

export interface WeaponMod {
  id: string;
  name: string;
  desc: string;
  cost: number;
  apply: (s: WeaponStats) => void;
}

export interface WeaponDef {
  id: WeaponId;
  /** What survivors call it. */
  name: string;
  /** What it actually is. */
  model: string;
  desc: string;
  /** Short flavour line shown on the rack. */
  flavor: string;
  unlockCost: number;
  auto: boolean;
  stats: WeaponStats;
  alt: AltFire;
  mod: WeaponMod;
  /** Bar-graph readout for the rack UI, 0..1. */
  readout: { power: number; speed: number; reach: number; control: number };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  RANGER: {
    id: 'RANGER',
    name: 'The Ranger',
    model: 'Scoped Service Carbine',
    desc: 'Steady automatic fire and a launcher cup welded under the barrel. Nothing special, which is exactly why it still works.',
    flavor: '"It was the sheriff\'s. He is not using it."',
    unlockCost: 0,
    auto: true,
    stats: {
      cooldown: 0.115,
      pellets: 1,
      spread: 0.035,
      damage: 24,
      bulletSpeed: 46,
      range: 34,
      pierce: 0,
      trauma: 0.07,
      recoil: 0.12
    },
    alt: {
      name: 'Rifle Grenade',
      desc: 'Lobs a fragmentation shell that detonates on the first body it clips.',
      kind: 'GRENADE',
      cooldown: 4.5,
      damage: 150,
      radius: 8.5
    },
    mod: {
      id: 'ranger_long',
      name: 'Mod: Long Barrel',
      desc: 'Slower cadence, far more reach and punch per round.',
      cost: 220,
      apply: (s) => {
        s.cooldown *= 1.35;
        s.damage = Math.round(s.damage * 1.85);
        s.range += 14;
        s.bulletSpeed += 12;
        s.pierce += 1;
      }
    },
    readout: { power: 0.5, speed: 0.62, reach: 0.6, control: 0.85 }
  },

  BOOMSTICK: {
    id: 'BOOMSTICK',
    name: 'The Boomstick',
    model: 'Sawn-Off Coach Gun',
    desc: 'Seven pellets of scrap lead per shell. Useless past a car length, decisive inside one.',
    flavor: '"Let them get close. Then do not miss."',
    unlockCost: 150,
    auto: false,
    stats: {
      cooldown: 0.68,
      pellets: 7,
      spread: 0.44,
      damage: 15,
      bulletSpeed: 38,
      range: 16,
      pierce: 1,
      trauma: 0.32,
      recoil: 0.45
    },
    alt: {
      name: 'Breaching Slug',
      desc: 'One solid slug that tears through the entire crowd in a line.',
      kind: 'SLUG',
      cooldown: 3.6,
      damage: 200,
      radius: 0
    },
    mod: {
      id: 'boom_choke',
      name: 'Mod: Welded Choke',
      desc: 'Tightens the pattern and doubles effective range. Fewer pellets.',
      cost: 260,
      apply: (s) => {
        s.pellets = 5;
        s.spread *= 0.42;
        s.range += 12;
        s.damage = Math.round(s.damage * 1.5);
      }
    },
    readout: { power: 0.92, speed: 0.25, reach: 0.2, control: 0.35 }
  },

  WIDOWMAKER: {
    id: 'WIDOWMAKER',
    name: 'The Widowmaker',
    model: 'Bolt-Action Deer Rifle',
    desc: 'One round, one spine. Slow to cycle and it punishes panic, but it drops a Bloater before it hears you.',
    flavor: '"Breathe out. Then squeeze."',
    unlockCost: 260,
    auto: false,
    stats: {
      cooldown: 0.85,
      pellets: 1,
      spread: 0,
      damage: 105,
      bulletSpeed: 74,
      range: 62,
      pierce: 2,
      trauma: 0.4,
      recoil: 0.34
    },
    alt: {
      name: 'Armour-Piercing Round',
      desc: 'A tungsten core that ignores every body between you and the horizon.',
      kind: 'PIERCE',
      cooldown: 5.0,
      damage: 320,
      radius: 0
    },
    mod: {
      id: 'widow_double',
      name: 'Mod: Double Feed',
      desc: 'Two rounds per cycle at the cost of raw stopping power.',
      cost: 300,
      apply: (s) => {
        s.pellets = 2;
        s.spread = 0.045;
        s.damage = Math.round(s.damage * 0.62);
        s.cooldown *= 0.92;
      }
    },
    readout: { power: 1.0, speed: 0.18, reach: 1.0, control: 0.7 }
  },

  STUTTER: {
    id: 'STUTTER',
    name: 'The Stutter',
    model: 'Improvised Machine Pistol',
    desc: 'Empties a magazine faster than you can regret it. Accuracy is a rumour.',
    flavor: '"Volume is its own kind of accuracy."',
    unlockCost: 340,
    auto: true,
    stats: {
      cooldown: 0.058,
      pellets: 1,
      spread: 0.13,
      damage: 10,
      bulletSpeed: 42,
      range: 24,
      pierce: 0,
      trauma: 0.04,
      recoil: 0.07
    },
    alt: {
      name: 'Nail Bomb',
      desc: 'A tin of roofing nails and black powder. Wide, filthy, effective.',
      kind: 'NAILBOMB',
      cooldown: 4.0,
      damage: 90,
      radius: 11.0
    },
    mod: {
      id: 'stutter_brace',
      name: 'Mod: Wire Brace',
      desc: 'Halves the spread and adds bite, at a slightly slower cadence.',
      cost: 280,
      apply: (s) => {
        s.spread *= 0.45;
        s.damage = Math.round(s.damage * 1.5);
        s.cooldown *= 1.22;
        s.range += 6;
      }
    },
    readout: { power: 0.34, speed: 1.0, reach: 0.34, control: 0.28 }
  },

  HARVESTER: {
    id: 'HARVESTER',
    name: 'The Harvester',
    model: 'Compressed-Air Nail Rifle',
    desc: 'Silent. Nails punch clean through a queue of the dead and pin the last one to the wall.',
    flavor: '"The quiet ones do not call the herd."',
    unlockCost: 480,
    auto: true,
    stats: {
      cooldown: 0.34,
      pellets: 1,
      spread: 0.02,
      damage: 58,
      bulletSpeed: 58,
      range: 40,
      pierce: 4,
      trauma: 0.12,
      recoil: 0.18
    },
    alt: {
      name: 'Fan Volley',
      desc: 'Five nails in a flat arc that shred everything in the near cone.',
      kind: 'FANBLADE',
      cooldown: 3.2,
      damage: 95,
      radius: 0
    },
    mod: {
      id: 'harvest_overpressure',
      name: 'Mod: Overpressure Tank',
      desc: 'Every nail passes through the whole line, but the tank cycles slower.',
      cost: 360,
      apply: (s) => {
        s.pierce += 5;
        s.cooldown *= 1.3;
        s.damage = Math.round(s.damage * 1.2);
        s.bulletSpeed += 10;
      }
    },
    readout: { power: 0.72, speed: 0.5, reach: 0.66, control: 0.9 }
  }
};

export const WEAPON_ORDER: WeaponId[] = ['RANGER', 'BOOMSTICK', 'WIDOWMAKER', 'STUTTER', 'HARVESTER'];

/** Returns a fresh, mutable copy of a weapon's stats with its mod optionally folded in. */
export function resolveWeaponStats(id: WeaponId, modActive: boolean): WeaponStats {
  const def = WEAPONS[id];
  const stats: WeaponStats = { ...def.stats };
  if (modActive) def.mod.apply(stats);
  return stats;
}
