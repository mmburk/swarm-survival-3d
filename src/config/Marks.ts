/**
 * THE MARKED.
 *
 * A rule that rides on a body instead of a new body. Seven types is already
 * more than most of the genre carries — Days Gone runs five hundred on screen
 * with five — so the cheap way to keep a street from reading the same twice is
 * not an eighth type, it is a layer over the seven that are there. Left 4 Dead
 * calls them uncommon commons, Seven Days to Die calls them feral and radiated,
 * Hades calls them elite attributes. All three landed on the same shape:
 *
 *   1. The rule rides the crowd, not a tier above it.
 *   2. Which body may carry which rule is restricted, and the restrictions are
 *      about what would be miserable rather than what would be strong.
 *   3. It is visible, or it is not a rule, it is a bug report.
 *
 * The marked all share one colour rather than getting one each. Four of these
 * can be on the street at once and there are thirty-four bodies out there — a
 * palette nobody can read is worse than no palette. Cold and wrong is the whole
 * message: *there is something the matter with that one*, and what exactly is
 * something the street shows you.
 */

import type { EnemyType } from '../entities/Enemy';

export type MarkId = 'VEST' | 'FRENZY' | 'SWOLLEN' | 'UNBURNT';

export interface MarkDef {
  id: MarkId;
  /** What survivors call it. */
  name: string;
  /** The codex line. Says the counter-play, because that is the content. */
  desc: string;
  /** Bodies this is never put on. The reason is in the comment beside it. */
  never: EnemyType[];
}

/**
 * Flat damage a vest eats from a shot that lands on the front of it.
 *
 * Deliberately flat and not a fraction: a percentage punishes the weak, fast
 * guns twice — once on the shot and again on the cadence — and the Stutter is
 * already the gun with the least to say about armour.
 */
export const VEST_SOAK = 9;

/** What a frenzy is worth, and for how long after the last hit landed. */
export const FRENZY_SPEED = 1.55;
export const FRENZY_DURATION = 2.0;

/** Extra scrap and score for taking one of these down. */
export const MARK_SCRAP_BONUS = 2;
export const MARK_SCORE_MULTIPLIER = 1.6;

export const MARKS: Record<MarkId, MarkDef> = {
  VEST: {
    id: 'VEST',
    name: 'Vested',
    desc: 'Somebody wrapped it, or it was wearing the vest when it turned. Rounds that hit it head-on lose most of their bite. Anything that punches through bodies ignores the plate outright, and so does a blast — and so does whatever it has turned its back on.',
    // A wall with a plate on it is not a harder wall, it is a longer wait.
    // And a Screamer has to stay killable inside its wind-up or the whole
    // type stops offering a decision.
    never: ['BUTCHER', 'SCREAMER']
  },

  FRENZY: {
    id: 'FRENZY',
    name: 'Wound Up',
    desc: 'Hurting it makes it faster for a few seconds. Chipping away at this one is the wrong answer — either commit and put it down, or leave it alone entirely.',
    // The Sprinter is already 7.4 against the player's 8.2; half again on top
    // of that is not a threat, it is a cutscene. Same for the Clinger, which
    // does not need to be quick, it needs to arrive.
    never: ['SPRINTER', 'CLINGER']
  },

  SWOLLEN: {
    id: 'SWOLLEN',
    name: 'Swollen',
    desc: 'Full of the same gas a Burster carries, without the sense to walk it over to you. It goes off where it dies — so mind where that is, and mind what is standing next to it.',
    // A Burster already does this, and doing it twice does it no better.
    never: ['BURSTER']
  },

  UNBURNT: {
    id: 'UNBURNT',
    name: 'Unburnt',
    desc: 'The flare means nothing to it. No light to walk towards, and nothing left on it that burns. Everything else on the street will be standing in the fire; this one will be standing on you.',
    never: []
  }
};

export const MARK_ORDER: MarkId[] = ['VEST', 'FRENZY', 'SWOLLEN', 'UNBURNT'];

/**
 * A legal mark for this body, or null if every one of them is barred.
 *
 * Drawn flat rather than weighted. The weighting that matters is the cap on
 * how many can be alive at once (`Engine.markBudget`) — with two or three on
 * the street, a rarity table underneath that would only ever be felt as one of
 * the four quietly never turning up.
 */
export function pickMark(type: EnemyType): MarkId | null {
  const legal = MARK_ORDER.filter((id) => !MARKS[id].never.includes(type));
  if (legal.length === 0) return null;
  return legal[Math.floor(Math.random() * legal.length)];
}
