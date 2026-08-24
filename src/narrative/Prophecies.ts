import type { Caller } from '../ui/BoonModal';

/**
 * THE LIST — what the band has asked for, nailed to the pin board.
 *
 * This is the Fated List from Hades wearing a coat. It does three jobs at once
 * and that is the only reason it earns its place: it tells the player what is
 * worth doing next, it pays them for doing it, and it is a delivery channel for
 * the story, because finishing one of these unlocks a line on the radio.
 *
 * Every entry is written by a specific survivor and asks for the thing that
 * survivor actually cares about. Sarge counts bodies. Mae wants the gun fed.
 * Vasquez wants depth and clean data. Eli wants you to come home and take the
 * dog. Nobody on this board is asking for a fetch quest; they are asking for
 * the thing they would ask for.
 *
 * A note on the shape: progress is always a plain number against a target, and
 * it is always derived from state that already exists rather than tracked as a
 * separate quest flag. There is no way for the list to disagree with the save.
 */

/** Lifetime counters the ordinary run records do not already cover. */
export interface Tally {
  bossKills: number;
  /** Scrap handed to Vic, all time. */
  traderSpend: number;
  flaresLit: number;
  /** Runs where all five voices gave you something. */
  fullBandRuns: number;
  /** Runs begun with Rook at your heel. */
  dogRuns: number;
  /** Bodies put down by whatever came out of the pens, all time. */
  pennedKills: number;
  /** Times an animal pulled something off you, all time. */
  penRescues: number;
  /** Deepest single run that never took the sixth signal. */
  deepestClean: number;
}

export function emptyTally(): Tally {
  return {
    bossKills: 0,
    traderSpend: 0,
    flaresLit: 0,
    fullBandRuns: 0,
    dogRuns: 0,
    pennedKills: 0,
    penRescues: 0,
    deepestClean: 0
  };
}

export interface ProphecyContext {
  runs: number;
  deaths: number;
  clears: number;
  bestSector: number;
  totalKills: number;
  tally: Tally;
  /** Ranks bought at the workbench, summed across every upgrade. */
  metaRanks: number;
  weaponsUnlocked: number;
  modsFitted: number;
  /** How many animals are in the pens, Rook included. */
  pennedOwned: number;
  /** Lines heard from one survivor, and across the whole band. */
  heard: (caller: Caller) => number;
  logHeard: number;
  claimed: (id: string) => boolean;
}

export interface Prophecy {
  id: string;
  /** Who nailed it up. Sets the colour and the voice. */
  caller: Caller;
  title: string;
  /** The ask, in their words. */
  text: string;
  target: number;
  progress: (c: ProphecyContext) => number;
  /** Scrap paid when the player takes it off the board. */
  reward: number;
  /** Stays off the board until this one has been claimed. */
  requires?: string;
  /** Extra gate for the entries that should not exist until something happens. */
  visible?: (c: ProphecyContext) => boolean;
}

export const PROPHECIES: Prophecy[] = [
  // ----------------------------------------------------------------- sarge

  {
    id: 'sarge-tally',
    caller: 'SARGE',
    title: 'Keep A Count',
    text: 'Five hundred. I am not asking you to enjoy it, I am asking you to know the number. A man who does not count loses track of what he is doing out there.',
    target: 500,
    progress: (c) => c.totalKills,
    reward: 120
  },
  {
    id: 'sarge-behemoth',
    caller: 'SARGE',
    title: 'Three Of The Big One',
    text: 'The heavy one in the fifth sector is not a monster, it is a fire support problem. Solve it three times and I will stop calling it a problem.',
    target: 3,
    progress: (c) => c.tally.bossKills,
    reward: 200,
    requires: 'sarge-tally'
  },
  {
    id: 'sarge-armoury',
    caller: 'SARGE',
    title: 'A Second Weapon',
    text: 'One rifle is a habit, not a plan. Get three off that rack and carry whichever one the street calls for.',
    target: 3,
    progress: (c) => c.weaponsUnlocked,
    reward: 150
  },

  // ------------------------------------------------------------------- mae

  {
    id: 'mae-mods',
    caller: 'MAE',
    title: 'Let Me Touch It',
    text: 'Two field mods. Fitted, not just bought and left in a box. I want to hear something on this band that I have had my hands inside.',
    target: 2,
    progress: (c) => c.modsFitted,
    reward: 140
  },
  {
    id: 'mae-flares',
    caller: 'MAE',
    title: 'Twenty-Five Flares',
    text: 'Burn twenty-five of them. Not for me — because the day you need one and have not practised is the day you find out you throw like a librarian.',
    target: 25,
    progress: (c) => c.tally.flaresLit,
    reward: 100
  },
  {
    id: 'mae-bench',
    caller: 'MAE',
    title: 'Ten At The Bench',
    text: 'Ten ranks of work on yourself. Any ten. I do not care which — I care that you stop hoarding scrap like it is going to be worth something later.',
    target: 10,
    progress: (c) => c.metaRanks,
    reward: 180
  },
  {
    id: 'mae-vic',
    caller: 'MAE',
    title: 'Give Vic The Business',
    text: 'Four hundred scrap through the underpass. He is a bandit and his prices are insulting and he is also the only supply line any of us has. Feed him.',
    target: 400,
    progress: (c) => c.tally.traderSpend,
    reward: 170
  },

  // --------------------------------------------------------------- vasquez

  {
    id: 'vasquez-depth',
    caller: 'VASQUEZ',
    title: 'Past The Twelfth',
    text: 'I need a reading from sector twelve. Nobody has given me anything past nine and my model is guessing, which is a polite word for lying.',
    target: 12,
    progress: (c) => c.bestSector,
    reward: 160
  },
  {
    id: 'vasquez-clean',
    caller: 'VASQUEZ',
    title: 'An Uncontaminated Run',
    text: 'Get to the eighth sector without taking anything off the silent carrier. One clean sample. I cannot separate its effect from mine if you keep mixing them.',
    target: 8,
    progress: (c) => c.tally.deepestClean,
    reward: 220,
    requires: 'vasquez-depth'
  },
  {
    id: 'vasquez-clears',
    caller: 'VASQUEZ',
    title: 'Five Returns',
    text: 'Walk back through that door five times. Deaths are not data, they are one observation each. Returns are a series.',
    target: 5,
    progress: (c) => c.clears,
    reward: 200
  },

  // ------------------------------------------------------------------- eli

  {
    id: 'eli-listen',
    caller: 'ELI',
    title: 'Stay On The Band',
    text: 'Twelve transmissions logged. I am not asking you to believe any of us. I am asking you to keep the set on, which is a different thing and an easier one.',
    target: 12,
    progress: (c) => c.logHeard,
    reward: 150
  },
  {
    id: 'eli-band',
    caller: 'ELI',
    title: 'All Five In One Night',
    text: 'Take something from every voice on the band in a single night. Even the one that does not speak. Especially that one — I would like to know it can be counted with the rest of us.',
    target: 1,
    progress: (c) => c.tally.fullBandRuns,
    reward: 260
  },
  {
    id: 'eli-dog',
    caller: 'ELI',
    title: 'Take The Dog',
    text: 'Five times out with Rook at your heel. He is no use to you and you are no use to him, and that has never once been the point of a dog.',
    target: 5,
    progress: (c) => c.tally.dogRuns,
    reward: 130
  },
  {
    id: 'eli-pens',
    caller: 'ELI',
    title: 'Four In The Yard',
    text: 'Four of them fed and standing. I know what the scrap is meant to be for. I also know what a yard with nothing living in it sounds like, and I would rather not hear it again.',
    target: 4,
    progress: (c) => c.pennedOwned,
    reward: 220,
    requires: 'eli-dog'
  },
  {
    id: 'eli-hands',
    caller: 'ELI',
    title: 'Somebody Pulled You Out',
    text: 'Ten times now something with no idea what a promise is has come and taken a dead man off you. I do not have a sermon for that. I am only saying it happened ten times and you are still here.',
    target: 10,
    progress: (c) => c.tally.penRescues,
    reward: 240,
    visible: (c) => c.tally.penRescues >= 1
  },
  {
    id: 'eli-teeth',
    caller: 'ELI',
    title: 'Somebody Else\'s Teeth',
    text: 'A hundred and fifty of them put down by something out of the pens. Not by you. I want it on the record that they earned their keep, because somebody is going to ask one day.',
    target: 150,
    progress: (c) => c.tally.pennedKills,
    reward: 280,
    visible: (c) => c.tally.pennedKills >= 1
  },

  // ----------------------------------------------------------------- quiet

  {
    id: 'quiet-listen',
    caller: 'QUIET',
    title: '— — — — — — —',
    text: 'This card was not nailed up. It was already on the board. The handwriting matches nobody in the shelter and the ask is four words long: keep the frequency open.',
    target: 4,
    progress: (c) => c.heard('QUIET'),
    reward: 300,
    visible: (c) => c.heard('QUIET') >= 1
  }
];

export type ProphecyState = 'HIDDEN' | 'OPEN' | 'READY' | 'CLAIMED';

export interface ProphecyView {
  prophecy: Prophecy;
  state: ProphecyState;
  progress: number;
}

/** Every prophecy the player is allowed to see, in board order, with its state. */
export function readBoard(ctx: ProphecyContext): ProphecyView[] {
  const out: ProphecyView[] = [];

  for (const p of PROPHECIES) {
    const gated = (p.requires && !ctx.claimed(p.requires)) || (p.visible && !p.visible(ctx));
    if (gated && !ctx.claimed(p.id)) continue;

    const progress = Math.max(0, Math.min(p.target, Math.floor(p.progress(ctx))));
    const state: ProphecyState = ctx.claimed(p.id)
      ? 'CLAIMED'
      : progress >= p.target ? 'READY' : 'OPEN';

    out.push({ prophecy: p, state, progress });
  }

  return out;
}

/** How many are sitting finished and unpaid — what the board badge counts. */
export function readyCount(ctx: ProphecyContext): number {
  return readBoard(ctx).filter((v) => v.state === 'READY').length;
}
