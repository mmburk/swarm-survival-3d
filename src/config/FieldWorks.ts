import type { WeaponId, WeaponStats } from './Weapons';
import type { Player } from '../entities/Player';

/**
 * THE WORKBENCH.
 *
 * Somebody's tools, still clamped to a bench in a garage with the roller door
 * half up. This is the Daedalus Hammer: not another percentage on the pile, but
 * a rework of the specific gun you walked in with, and the only reward in the
 * game that can change how the weapon is played rather than how hard it hits.
 *
 * Because it changes a run's shape so violently, it is the one reward the bag
 * does not deal — see RewardDeck for the schedule. Twice a run, at most, in
 * windows, with the offer chased down if you walk past it.
 *
 * Every entry here rewrites the live stat block on the player, so a run that
 * fits two of them is carrying a gun that is genuinely not on the rack
 * downstairs. Nothing is a pure gain: each one takes something back.
 */
export interface FieldWork {
  id: string;
  weapon: WeaponId;
  name: string;
  /** Written as a trade, because every one of them is. */
  desc: string;
  apply: (s: WeaponStats, p: Player) => void;
}

const WORKS: FieldWork[] = [
  // ---- THE RANGER: a service carbine with a grenade cup ---------------------
  {
    id: 'ranger_paired',
    weapon: 'RANGER',
    name: 'Paired Barrels',
    desc: 'Two rounds every pull instead of one, each hitting for a little over half as hard.',
    apply: (s) => {
      s.pellets = 2;
      s.damage = Math.round(s.damage * 0.64);
      s.spread += 0.055;
      s.recoil += 0.05;
    }
  },
  {
    id: 'ranger_cup',
    weapon: 'RANGER',
    name: 'Reamed Cup',
    desc: 'The rifle grenade comes back nearly twice as fast. The rifle itself loses its bite.',
    apply: (s, p) => {
      p.altCooldownMultiplier *= 0.54;
      s.damage = Math.round(s.damage * 0.84);
    }
  },
  {
    id: 'ranger_watch',
    weapon: 'RANGER',
    name: 'Long Watch',
    desc: 'Far more reach and a real chance of a clean hit, at a slower cadence.',
    apply: (s, p) => {
      s.range += 18;
      s.bulletSpeed += 16;
      s.cooldown *= 1.22;
      p.critChance += 0.14;
    }
  },
  {
    id: 'ranger_ripping',
    weapon: 'RANGER',
    name: 'Ripping Rounds',
    desc: 'Rounds tear through two more bodies and burst what they kill. Accuracy suffers for it.',
    apply: (s, p) => {
      p.bonusPierce += 2;
      p.burstChance += 0.14;
      s.spread += 0.045;
    }
  },

  // ---- THE BOOMSTICK: a sawn-off coach gun ---------------------------------
  {
    id: 'boom_ninebore',
    weapon: 'BOOMSTICK',
    name: 'Nine-Bore Load',
    desc: 'Thirteen pellets a shell. Each one is scrap, and the pattern is a wall.',
    apply: (s) => {
      s.pellets = 13;
      s.damage = Math.round(s.damage * 0.66);
      s.spread *= 1.18;
      s.range -= 2;
    }
  },
  {
    id: 'boom_slugged',
    weapon: 'BOOMSTICK',
    name: 'Slugged Shells',
    desc: 'One solid slug instead of a cloud: it carries down the street and through the queue.',
    apply: (s) => {
      s.pellets = 1;
      s.damage = Math.round(s.damage * 5.4);
      s.spread = 0.015;
      s.range += 16;
      s.pierce += 2;
    }
  },
  {
    id: 'boom_cut',
    weapon: 'BOOMSTICK',
    name: 'Cut Barrels',
    desc: 'Nothing left to aim with, but it breaks open and closes half again as fast.',
    apply: (s) => {
      s.cooldown *= 0.6;
      s.spread *= 1.4;
      s.range -= 3;
    }
  },
  {
    id: 'boom_breach',
    weapon: 'BOOMSTICK',
    name: 'Breach Loop',
    desc: 'The breaching slug is ready twice as often. The shell load gets lighter to pay for it.',
    apply: (s, p) => {
      p.altCooldownMultiplier *= 0.5;
      s.damage = Math.round(s.damage * 0.86);
    }
  },

  // ---- THE WIDOWMAKER: a bolt-action deer rifle -----------------------------
  {
    id: 'widow_sympathetic',
    weapon: 'WIDOWMAKER',
    name: 'Sympathetic Rupture',
    desc: 'A third of what you drop comes apart and takes the crowd around it with it.',
    apply: (s, p) => {
      p.burstChance += 0.32;
      s.cooldown *= 1.1;
    }
  },
  {
    id: 'widow_through',
    weapon: 'WIDOWMAKER',
    name: 'Through And Through',
    desc: 'The round does not stop at six bodies. It stops at the wall behind them.',
    apply: (s, p) => {
      p.bonusPierce += 6;
      s.damage = Math.round(s.damage * 0.88);
    }
  },
  {
    id: 'widow_fastbolt',
    weapon: 'WIDOWMAKER',
    name: 'Slick Bolt',
    desc: 'Cycles almost twice as fast. Every round lands considerably softer.',
    apply: (s) => {
      s.cooldown *= 0.56;
      s.damage = Math.round(s.damage * 0.66);
    }
  },
  {
    id: 'widow_executioner',
    weapon: 'WIDOWMAKER',
    name: 'Executioner',
    desc: 'A clean hit lands far more often and hits far harder. Only the first shot is ever clean.',
    apply: (s, p) => {
      p.critChance += 0.24;
      p.critMultiplier += 1.1;
      s.cooldown *= 1.12;
    }
  },

  // ---- THE STUTTER: an improvised machine pistol ---------------------------
  {
    id: 'stutter_wire',
    weapon: 'STUTTER',
    name: 'Wired Stock',
    desc: 'A coat hanger and half a roll of tape. The spray becomes something like a line.',
    apply: (s) => {
      s.spread *= 0.32;
      s.range += 8;
      s.cooldown *= 1.12;
    }
  },
  {
    id: 'stutter_runaway',
    weapon: 'STUTTER',
    name: 'Runaway Sear',
    desc: 'It no longer entirely stops when you do. Accuracy was never the point.',
    apply: (s) => {
      s.cooldown *= 0.7;
      s.spread *= 1.35;
      s.damage = Math.round(s.damage * 0.92);
    }
  },
  {
    id: 'stutter_hollow',
    weapon: 'STUTTER',
    name: 'Hollow Feed',
    desc: 'Filed rounds that open up inside. Half of what dies comes apart.',
    apply: (s, p) => {
      p.burstChance += 0.18;
      p.lifestealChance += 0.12;
      p.lifestealAmount += 2;
      s.range -= 4;
    }
  },
  {
    id: 'stutter_tin',
    weapon: 'STUTTER',
    name: 'Second Tin',
    desc: 'You are carrying two nail bombs now, and the second one is always nearly ready.',
    apply: (s, p) => {
      p.altCooldownMultiplier *= 0.48;
      s.damage = Math.round(s.damage * 0.9);
    }
  },

  // ---- THE HARVESTER: a compressed-air nail rifle ---------------------------
  {
    id: 'harvest_railspike',
    weapon: 'HARVESTER',
    name: 'Rail Spikes',
    desc: 'Six-inch spikes. They go through the whole street, and the tank hates it.',
    apply: (s, p) => {
      p.bonusPierce += 6;
      s.damage = Math.round(s.damage * 1.28);
      s.cooldown *= 1.28;
    }
  },
  {
    id: 'harvest_twin',
    weapon: 'HARVESTER',
    name: 'Twin Head',
    desc: 'Two nails a cycle, each a good deal lighter, and a wider mouth.',
    apply: (s) => {
      s.pellets = 2;
      s.damage = Math.round(s.damage * 0.62);
      s.spread += 0.05;
    }
  },
  {
    id: 'harvest_barbed',
    weapon: 'HARVESTER',
    name: 'Barbed Nails',
    desc: 'They come back out with something on them. A quarter of your kills give it to you.',
    apply: (s, p) => {
      p.lifestealChance += 0.26;
      p.lifestealAmount += 4;
      s.damage = Math.round(s.damage * 0.9);
    }
  },
  {
    id: 'harvest_vent',
    weapon: 'HARVESTER',
    name: 'Vented Tank',
    desc: 'Cycles a third faster and dumps its pressure early, so the nails do not carry.',
    apply: (s) => {
      s.cooldown *= 0.64;
      s.range -= 10;
      s.bulletSpeed -= 6;
    }
  }
];

/**
 * What is laid out on the bench.
 *
 * Drawn off the run's own seeded stream, and never something already fitted —
 * a bench that offers you the work you are standing there holding is a bench
 * that wasted a whole street of the player's night.
 */
export function pickFieldWorks(
  weapon: WeaponId,
  fitted: string[],
  rng: () => number,
  count: number = 3
): FieldWork[] {
  const pool = WORKS.filter((w) => w.weapon === weapon && !fitted.includes(w.id));

  // Fisher-Yates off the seeded stream — sort(() => rng() - 0.5) is a biased
  // shuffle and the bench is too rare to deal it a crooked hand.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}
