/**
 * THE PENS — what walks out with you.
 *
 * Everything on this list was somebody's before it was yours. The lurcher slept
 * under a kitchen table, the hawk was flown off a fist at weekends, the bear
 * was a cub in the roadside wildlife park on the ring road and the goat ate a
 * washing line. The collapse did not make them feral, it made them unfed, and
 * an animal that gets fed comes back.
 *
 * A companion is not a second gun. Every one of them does about a tenth of what
 * the player's weapon does in raw damage — what they actually sell is a verb
 * the player does not have: something that staggers, something that pulls a
 * crowd off you, something that picks scrap up out of the road while you are
 * busy. If a companion ever out-damages the gun, this table is wrong.
 *
 * Shape of the numbers: `strike` is the whole of a companion's combat and the
 * role decides when it lands. Contact with the dead is what wears them down,
 * `grit` is how much of it they can wear, and nothing on this list dies — see
 * `Companion.knockDown`.
 */

export type AnimalId = 'ROOK' | 'KITE' | 'HONEY' | 'SIXPENCE' | 'NAN' | 'BRISTLE' | 'MOUSER';

/**
 * What the animal does when there is something to do. One role each, and the
 * role is the reason to own it — reading the list should feel like reading
 * seven different answers to "what is going wrong out there".
 */
export type AnimalRole =
  /** Runs a body down and bites it. Damage plus a stagger. */
  | 'HARRY'
  /** Circles, then drops on something at range. Ignores everything on the ground. */
  | 'STOOP'
  /** Walks with you until there is a crowd, then puts the crowd on its back. */
  | 'SLAM'
  /** Lifts scrap out of the road and brings it to you. */
  | 'FETCH'
  /** Stands off to one side making noise, and the street goes to her. */
  | 'BAIT'
  /** Picks a line and runs it, through whatever is standing in it. */
  | 'CHARGE'
  /** Fights nothing. Walks at your knee and keeps you steady. */
  | 'WATCH';

export interface AnimalStrike {
  damage: number;
  /** Seconds between one landing and the next being possible. */
  cooldown: number;
  /** How close it has to get. For SLAM and CHARGE this is the sweep. */
  reach: number;
  /** Seconds the target is held still afterwards. */
  stun: number;
}

export interface AnimalDef {
  id: AnimalId;
  name: string;
  /** What it is, in the words somebody would actually use. */
  species: string;
  /** Scrap to take it out of the pen for good. Rook is already yours. */
  cost: number;
  role: AnimalRole;
  /** The role in two or three words, for the chip on the card. */
  roleName: string;
  /** What it does, mechanically, said plainly. */
  desc: string;
  /** One line of who it was. */
  flavor: string;

  speed: number;
  radius: number;
  /** How far off your shoulder it prefers to sit. */
  heel: number;
  /** How far it will leave you to go and do its job. */
  leash: number;
  /** Condition. Contact with the dead takes it; a cleared street gives it back. */
  grit: number;
  /** Off the ground, so nothing in the street can touch it or block it. */
  flies: boolean;

  strike: AnimalStrike;

  /** Colours, so the pen card and the model agree. */
  coat: number;
  coatDark: number;
  mark: number;
}

/** Cheapest first, with the dog you already have at the front. */
export const ANIMAL_ORDER: AnimalId[] = ['ROOK', 'MOUSER', 'SIXPENCE', 'NAN', 'KITE', 'BRISTLE', 'HONEY'];

export const ANIMALS: Record<AnimalId, AnimalDef> = {
  ROOK: {
    id: 'ROOK',
    name: 'Rook',
    species: 'Lurcher cross, eight or nine',
    cost: 0,
    role: 'HARRY',
    roleName: 'Harries',
    desc: 'Runs down whatever is nearest and takes it off its feet. 16 damage and a stagger, about once a second.',
    flavor: 'He was somebody\'s dog before. He has not stopped being one.',
    speed: 8.2,
    radius: 0.42,
    heel: 2.2,
    leash: 11.0,
    grit: 60,
    flies: false,
    strike: { damage: 16, cooldown: 1.05, reach: 1.5, stun: 0.55 },
    coat: 0x6b5a44,
    coatDark: 0x4a3d2c,
    mark: 0x8b7658
  },

  MOUSER: {
    id: 'MOUSER',
    name: 'Mouser',
    species: 'Yard cat, no colour worth naming',
    cost: 120,
    role: 'WATCH',
    roleName: 'Keeps you steady',
    desc: 'Fights nothing and never will — she cannot pull a Clinger off you either, and will not try. While nothing has hit you for four seconds she brings back 2 condition a second.',
    flavor: 'Turned up at the grate one night and has never once been asked to stay.',
    speed: 7.0,
    radius: 0.3,
    heel: 1.7,
    leash: 3.0,
    grit: 34,
    flies: false,
    strike: { damage: 0, cooldown: 1, reach: 0, stun: 0 },
    coat: 0x585549,
    coatDark: 0x3b382f,
    mark: 0x7d7869
  },

  SIXPENCE: {
    id: 'SIXPENCE',
    name: 'Sixpence',
    species: 'Magpie, one wing set badly',
    cost: 190,
    role: 'FETCH',
    roleName: 'Lifts scrap',
    desc: 'Works the road while you fight: finds loose scrap up to 16 metres out and drops it in your hand.',
    flavor: 'Five for silver, six for gold. Named by somebody who could still count on being paid.',
    speed: 11.0,
    radius: 0.26,
    heel: 2.4,
    leash: 16.0,
    grit: 26,
    flies: true,
    strike: { damage: 0, cooldown: 1, reach: 0, stun: 0 },
    coat: 0x24261f,
    coatDark: 0x14150f,
    mark: 0xc9c4b0
  },

  NAN: {
    id: 'NAN',
    name: 'Nan',
    species: 'Nanny goat, ate the washing line',
    cost: 250,
    role: 'BAIT',
    roleName: 'Pulls the street',
    desc: 'Stands off to one side and will not shut up. Anything dead within 11 metres of her goes for her instead of you.',
    flavor: 'She has no idea what she is for, and she is the best thing in the pens.',
    speed: 6.2,
    radius: 0.5,
    heel: 6.5,
    leash: 13.0,
    // The highest number in the table after the bear, and it has to be: she is
    // the only animal here whose whole job is being stood on. At 150 she was
    // face down inside twenty seconds of a busy street, which is a bait that
    // baits nothing.
    grit: 320,
    flies: false,
    strike: { damage: 9, cooldown: 1.6, reach: 1.4, stun: 0.3 },
    coat: 0xa79c82,
    coatDark: 0x6f6754,
    mark: 0x50493a
  },

  KITE: {
    id: 'KITE',
    name: 'Kite',
    species: 'Harris hawk, still wearing her jesses',
    cost: 340,
    role: 'STOOP',
    roleName: 'Stoops',
    desc: 'Circles you, then drops on whatever is furthest out — 40 damage through anything in the way, and it stays down a moment.',
    flavor: 'Flown off a fist at weekends by a man who is not on the band any more.',
    speed: 15.0,
    radius: 0.3,
    heel: 2.8,
    leash: 20.0,
    grit: 30,
    flies: true,
    // Enough to take a shambler off the board outright. At 30 she was
    // spreading damage across bodies at the edge of the street that then
    // walked in anyway, and a stoop that kills nothing is a stoop nobody buys.
    strike: { damage: 40, cooldown: 2.6, reach: 1.6, stun: 0.7 },
    coat: 0x6a5340,
    coatDark: 0x3f3125,
    mark: 0xc2b190
  },

  BRISTLE: {
    id: 'BRISTLE',
    name: 'Bristle',
    species: 'Boar, off the common, half tame',
    cost: 420,
    role: 'CHARGE',
    roleName: 'Runs a line',
    desc: 'Every seven seconds he picks a line and runs it. 45 damage to everything he clips and they go down with it — until the third one stops him.',
    flavor: 'The common went back to wood inside a year. He was waiting in it.',
    speed: 7.4,
    radius: 0.62,
    heel: 3.0,
    leash: 14.0,
    grit: 190,
    flies: false,
    strike: { damage: 45, cooldown: 7.0, reach: 1.9, stun: 1.1 },
    coat: 0x3f3a30,
    coatDark: 0x272319,
    mark: 0xb9b0a0
  },

  HONEY: {
    id: 'HONEY',
    name: 'Honey',
    species: 'Black bear, two years old, hand-reared',
    cost: 560,
    role: 'SLAM',
    roleName: 'Puts them down',
    desc: 'Slow, and she does not need to be quick. Every six seconds both arms come down: 75 damage inside four metres, and none of it gets up straight away.',
    flavor: 'The wildlife park on the ring road named her. Nobody has had the heart to stop.',
    speed: 5.4,
    radius: 0.95,
    heel: 3.2,
    leash: 9.0,
    grit: 300,
    flies: false,
    strike: { damage: 75, cooldown: 6.0, reach: 4.0, stun: 1.4 },
    coat: 0x2e2a25,
    coatDark: 0x1b1815,
    mark: 0x6b5b3e
  }
};
