import type { Caller } from '../ui/BoonModal';
import type { SpokenLine } from '../ui/RadioDialogue';

/**
 * WHAT THEY SAY OVER THE DROP.
 *
 * One transmission, keyed the moment the player puts a hand on the case, before
 * the favours are on the table. It exists for the same reason Hades has a god
 * appear before the cards do: a boon handed over by a menu is a stat, and a
 * boon handed over by somebody who is still alive on the other end of a radio
 * is a relationship.
 *
 * The rules of the RadioLog apply here too — the player never speaks, nobody
 * narrates the plot, and QUIET is never explained. These are shorter than the
 * shelter lines on purpose: the player is standing in an open street that was
 * full of the dead ninety seconds ago, and they know it.
 */
const OFFERS: Record<Caller, string[]> = {
  SARGE: [
    'That case was staged for a squad that never came back for it. Consider it reassigned. Take one thing out of it and keep your head moving while you decide.',
    'I walked that block in March and left drops on every second junction, in case anybody was still working their way out. Six months. You are the first one to trip over one.',
    'Do not stand over it like it is a shop window. Pick the thing that kills more of them, not the thing that sounds good, and get off that street.'
  ],
  VASQUEZ: [
    'Field kit. Not a miracle — everything in it works because the infection is stupid, not because I am clever. Choose one, apply it, and do not touch your face.',
    'I left those along the corridor while the relay still had people in it. If the seal is intact, so is what is inside. If it is not, you are committed either way.',
    'Two of those options are the ones I would take. The third is the one you will take, because you are out there and I am in here, and that has always been the difference.'
  ],
  MAE: [
    'You found one! I have been running those out along the route for weeks, taping my mark on the lid, hoping something with a pulse would trip over one. Take whatever your gun can use.',
    'Whatever is in there I built out of two dead ones and a lot of swearing, so it will hold. Mostly. Tell me which you want and I will talk you through the fitting.',
    'Do not thank me, it makes the channel weird. Just take it, and let me hear you keying that handset again in ten minutes so I know it worked.'
  ],
  ELI: [
    'You found the box. I set that down myself, six streets from where I am sitting, and I have been asking every night for somebody to come and take the weight of it.',
    'It is not charity, it is inventory. None of it was ever mine. Take one, leave the rest for whoever is behind you, and do not stand in that light too long.',
    'I would have wrapped it better if I had known it would be you. Choose whichever one you can carry the furthest, son.'
  ],
  QUIET: [
    '[ the carrier opens. the meter does not move. the case at your feet was not there when the fight started, and it is already wearing this street\'s dust. ]',
    '[ carrier open. under the hiss there is something keeping time, and it is keeping time with you. the case is already unlatched. ]',
    '[ no voice. the mark on the lid is the one nobody on the band drew. take something out and the carrier closes. ]'
  ]
};

/** So the same survivor does not open with the same sentence twice running. */
const lastPicked: Partial<Record<Caller, number>> = {};

export function pickSignalOffer(caller: Caller): SpokenLine {
  const pool = OFFERS[caller];
  const previous = lastPicked[caller];
  let index = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && index === previous) index = (index + 1) % pool.length;
  lastPicked[caller] = index;
  return { caller, text: [pool[index]] };
}
