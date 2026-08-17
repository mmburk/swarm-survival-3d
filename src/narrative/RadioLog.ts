import type { Caller } from '../ui/BoonModal';

/**
 * THE RADIO LOG — the story, delivered the way Hades delivers one.
 *
 * There are no cutscenes in this game and there should never be one. Instead
 * every line below is a single radio transmission that sits behind a condition,
 * and exactly one of them plays when the player comes back down the stairs into
 * the shelter. Once it has played it is struck off and never plays again.
 *
 * The consequence, and the whole point: dying is how the story advances. A run
 * that ends in the street is not wasted, because coming home is what makes
 * somebody talk. The player who dies twelve times hears twelve things the
 * player who never dies does not.
 *
 * Three rules the content has to keep:
 *
 *  1. **The player never speaks and is never named.** Every line is one-sided.
 *     Nobody on the band has ever seen this person's face.
 *  2. **Nobody is describing the plot to you.** They are talking about their own
 *     night. The story is what leaks out around the edges of that.
 *  3. **QUIET is never explained.** The other four react to the sixth signal;
 *     none of them ever learns what it is, and neither does the player.
 */

/** What the last run actually did, handed over the moment the player gets home. */
export interface LastRun {
  survived: boolean;
  /** How deep they got. */
  sector: number;
  kills: number;
  /** Whose boons they took, most-taken first. Empty if they took none. */
  callers: Caller[];
  /** The night tier the run was played on. */
  night: number;
}

/** Everything a line is allowed to ask about before deciding to play. */
export interface RadioContext {
  runs: number;
  deaths: number;
  clears: number;
  bestSector: number;
  totalKills: number;
  scrap: number;
  night: number;
  /** Null on the very first descent, before anybody has been outside. */
  last: LastRun | null;
  /** Has this exact line been heard before? */
  seen: (id: string) => boolean;
  /** How many lines this survivor has delivered so far. */
  heard: (caller: Caller) => number;
  /** Did the last run lean on this survivor? */
  leanedOn: (caller: Caller) => boolean;
  /**
   * Has this card been taken off the pin board?
   *
   * The two systems are deliberately joined here. A prophecy that pays scrap
   * and nothing else is a chore; a prophecy that makes somebody say something
   * they would not otherwise have said is the reason to do it.
   */
  claimed: (id: string) => boolean;
}

export interface RadioLine {
  id: string;
  caller: Caller;
  /**
   * Higher wins when several lines qualify at once. Reserve 90+ for the beats
   * that carry the story, 40–70 for reactions, under 20 for ambient filler.
   */
  priority: number;
  /** Filler lines set this false so they can come round again. */
  once?: boolean;
  when: (c: RadioContext) => boolean;
  /** One paragraph per press. Keep each under about forty words — this is radio. */
  text: string[];
}

/** Small helper: the run got at least this deep. */
const reached = (c: RadioContext, n: number) => (c.last?.sector ?? 0) >= n;

export const RADIO_LINES: RadioLine[] = [
  // ---------------------------------------------------------------- openings

  {
    id: 'sarge-first-contact',
    caller: 'SARGE',
    priority: 100,
    when: (c) => c.runs === 0,
    text: [
      'Somebody is keying a handset on the guard frequency. If that is you and you are not infected, listen and do not answer — I do not need your position, I need you moving.',
      'One twenty-one point five. I am on it every night until I am not. Aim small, miss small. Out.'
    ]
  },
  {
    id: 'mae-first-contact',
    caller: 'MAE',
    priority: 95,
    when: (c) => c.runs === 1 && !c.seen('mae-first-contact'),
    text: [
      'Oh, you are real. I have been talking to a wall for six weeks and the wall finally moved.',
      'Channel nineteen. I have got a workshop, a generator and a lot of opinions about that gun you are carrying. Come back and I will fix something.'
    ]
  },
  {
    id: 'eli-first-contact',
    caller: 'ELI',
    priority: 92,
    when: (c) => c.runs >= 2 && !c.seen('eli-first-contact'),
    text: [
      'Eighty-nine point nine. This transmitter was for the Sunday service. It carries about four miles now, which is further than anything else I have.',
      'I am not going to ask you for anything, son. I will just be here at this hour. That is all it is.'
    ]
  },
  {
    id: 'vasquez-first-contact',
    caller: 'VASQUEZ',
    priority: 90,
    when: (c) => c.runs >= 3 && c.totalKills >= 60 && !c.seen('vasquez-first-contact'),
    text: [
      'Whoever is out there dropping bodies in the north sectors — I need you to stop thinking of it as killing. It is a pathogen and you are a delivery route.',
      'This is a CDC relay. There is nobody left at the other end of it. I keep it running because the alternative is sitting in the dark being quiet.'
    ]
  },

  // ------------------------------------------------------------- first death

  {
    id: 'eli-first-death',
    caller: 'ELI',
    priority: 98,
    when: (c) => c.deaths === 1,
    text: [
      'You are back. I heard the door.',
      'I want you to understand that I did not expect it. I sat here after the shooting stopped and I made my peace with the quiet, and then the quiet ended.',
      'You are not finished yet. Sleep.'
    ]
  },
  {
    id: 'sarge-second-death',
    caller: 'SARGE',
    priority: 76,
    when: (c) => c.deaths === 2,
    text: [
      'You went down and you got back up. Do not make a thing of it.',
      'Everybody I ever trained thought the first one was the worst one. It is not. The worst one is the fourth, when you have worked out it is going to keep happening. Out.'
    ]
  },
  {
    id: 'mae-fifth-death',
    caller: 'MAE',
    priority: 74,
    when: (c) => c.deaths >= 5 && !c.seen('mae-fifth-death'),
    text: [
      'Okay so I have been keeping count, which is maybe a weird thing to admit.',
      'Five. That is five times you have gone out and something has come back and put its key in that door. I am not saying it is not you. I am saying I would like to see the key sometime.'
    ]
  },

  // ------------------------------------------------------- coming home alive

  {
    id: 'sarge-first-clear',
    caller: 'SARGE',
    priority: 97,
    when: (c) => c.clears === 1,
    text: [
      'That was a clean withdrawal. Objective met, ground given up on purpose, everybody accounted for.',
      'I have watched better soldiers than you do worse than that. Do not let it go to your head — the street does not learn, but it does get more crowded. Out.'
    ]
  },
  {
    id: 'mae-first-clear',
    caller: 'MAE',
    priority: 70,
    when: (c) => c.clears >= 1 && !c.seen('mae-first-clear'),
    text: [
      'You made it back with the gun still working. Do you know how rare that is? Everyone else who ever talked to me stopped mid-sentence.',
      'Bring it by. Not because it needs it. Because I want to see what you did to it.'
    ]
  },

  // -------------------------------------------------------------- going deep

  {
    id: 'vasquez-sector-five',
    caller: 'VASQUEZ',
    priority: 68,
    when: (c) => reached(c, 5) && !c.seen('vasquez-sector-five'),
    text: [
      'You got as far as the fifth sector. That is past the cordon line, which means you have seen the big one.',
      'It was a person. Six weeks ago that thing filed a tax return. I need you to keep knowing that, because the day it stops mattering to you is the day you become an environmental factor instead of a survivor.'
    ]
  },
  {
    id: 'sarge-sector-ten',
    caller: 'SARGE',
    priority: 72,
    when: (c) => reached(c, 10) && !c.seen('sarge-sector-ten'),
    text: [
      'Ten sectors. I am going to tell you something I have not put on this band before.',
      'There is no relief column. There was one, it was us, and I watched it fold on the interstate on the second day. Everything I have told you about holding ground was for you, not for them. Out.'
    ]
  },
  {
    id: 'eli-sector-fifteen',
    caller: 'ELI',
    priority: 80,
    when: (c) => reached(c, 15) && !c.seen('eli-sector-fifteen'),
    text: [
      'Fifteen. You are further out than the church now. I can hear your gun before I hear you on the band, which is a strange way to know somebody is alive.',
      'Come home while it is still your idea to.'
    ]
  },

  // -------------------------------------------------------------- allegiance

  {
    id: 'sarge-devotion',
    caller: 'SARGE',
    priority: 55,
    when: (c) => c.heard('SARGE') >= 3 && c.leanedOn('SARGE') && !c.seen('sarge-devotion'),
    text: [
      'You have been taking my calls over the others. Noted.',
      'I am not flattered, I am responsible. That is worse for me and better for you. Out.'
    ]
  },
  {
    id: 'mae-devotion',
    caller: 'MAE',
    priority: 55,
    when: (c) => c.heard('MAE') >= 3 && c.leanedOn('MAE') && !c.seen('mae-devotion'),
    text: [
      'You keep picking my frequency. Sarge is going to be so annoyed and I am going to enjoy it enormously.',
      'Look — half of what I give you is stuff I have not tested. The other half is stuff I tested on my own truck. Choose accordingly.'
    ]
  },
  {
    id: 'vasquez-devotion',
    caller: 'VASQUEZ',
    priority: 55,
    when: (c) => c.heard('VASQUEZ') >= 3 && c.leanedOn('VASQUEZ') && !c.seen('vasquez-devotion'),
    text: [
      'You have been using my work. I want to say something and I want it on the record, even if the record is a shelter under a hardware store.',
      'None of it was designed to make you better at this. It was designed to make it stop. You are the first thing that has ever made the numbers move, and I do not entirely like what that says about the numbers.'
    ]
  },
  {
    id: 'eli-devotion',
    caller: 'ELI',
    priority: 55,
    when: (c) => c.heard('ELI') >= 3 && c.leanedOn('ELI') && !c.seen('eli-devotion'),
    text: [
      'You have been listening to an old man on a church transmitter instead of taking the faster gun. I notice these things.',
      'I am not going to pretend that is faith. You are cold and you are tired and mine is the voice that does not want anything. I will take it either way.'
    ]
  },

  // ------------------------------------------------------------------- quiet

  {
    id: 'quiet-first',
    caller: 'QUIET',
    priority: 99,
    when: (c) => c.leanedOn('QUIET') && !c.seen('quiet-first'),
    text: [
      '— — — — — — — carrier open — — — — — — —',
      '[ nothing. forty seconds of nothing. the meter is moving. ]',
      '— — — — — — — carrier closed — — — — — —'
    ]
  },
  {
    id: 'mae-hears-quiet',
    caller: 'MAE',
    priority: 88,
    when: (c) => c.seen('quiet-first') && !c.seen('mae-hears-quiet'),
    text: [
      'Hey. Weird one. There is a carrier on the low band with no modulation on it. No voice, no tone, nothing. Just a hole in the noise floor.',
      'I tried to fix on it with two antennas and it gave me two different bearings. That is not how bearings work. Do not answer it. I am probably being dramatic. Do not answer it.'
    ]
  },
  {
    id: 'sarge-denies-quiet',
    caller: 'SARGE',
    priority: 62,
    when: (c) => c.seen('mae-hears-quiet') && !c.seen('sarge-denies-quiet'),
    text: [
      'The mechanic has been talking about an empty carrier. I have swept the band twice and there is nothing on it.',
      'People hear things out here. It is the fourth week, the sleep goes, and the ear starts making company. Ignore it and keep your muzzle down. Out.'
    ]
  },
  {
    id: 'vasquez-measures-quiet',
    caller: 'VASQUEZ',
    priority: 64,
    when: (c) => c.seen('mae-hears-quiet') && c.heard('QUIET') >= 1 && !c.seen('vasquez-measures-quiet'),
    text: [
      'I logged the empty carrier for eleven nights. It transmits for between thirty and ninety seconds and it only ever does it while somebody is out on the street.',
      'I am a scientist, so I will say the honest version: I have one variable and one observation and that is not a finding. It is just something I cannot stop looking at.'
    ]
  },
  {
    id: 'eli-prays-quiet',
    caller: 'ELI',
    priority: 60,
    when: (c) => c.seen('mae-hears-quiet') && !c.seen('eli-prays-quiet'),
    text: [
      'The young one asked me what I thought the silent signal was. I told her the truth, which is that I have been talking into a microphone for six weeks with no way of knowing if anyone hears it.',
      'Whatever is on that frequency is doing what I am doing. That does not make it good. It makes it lonely, and I have stopped being sure those are different things.'
    ]
  },
  {
    id: 'quiet-second',
    caller: 'QUIET',
    priority: 86,
    when: (c) => c.heard('QUIET') >= 1 && c.deaths >= 4 && !c.seen('quiet-second'),
    text: [
      '— — — — carrier open — — — —',
      '[ the meter climbs, holds, and for a little under two seconds it is shaped like a word. ]',
      '[ it is not a word you know. ]'
    ]
  },

  // ------------------------------------------------------------- the long night

  {
    id: 'sarge-night-raised',
    caller: 'SARGE',
    priority: 58,
    when: (c) => c.night >= 2 && !c.seen('sarge-night-raised'),
    text: [
      'You have moved your own start time back into the dead hours. That was a choice, and it was not a stupid one — there is more out there and it is worth more.',
      'But understand what you did. You did not get braver. You made the street worse and then agreed to it. Out.'
    ]
  },
  {
    id: 'eli-night-four',
    caller: 'ELI',
    priority: 84,
    when: (c) => c.night >= 4 && !c.seen('eli-night-four'),
    text: [
      'You are going out on the last hour of the night now. I know what that is. I have buried men who chose their hour.',
      'I am not going to talk you down from it. I am going to leave the transmitter on until morning, and if there is no morning I will have left it on anyway.'
    ]
  },

  // -------------------------------------------------- answers from the board

  {
    id: 'sarge-tally-answer',
    caller: 'SARGE',
    priority: 78,
    when: (c) => c.claimed('sarge-tally'),
    text: [
      'Five hundred. You brought me the number and you did not editorialise about it, which is the part I was actually testing.',
      'Now forget it. A count is a tool for knowing whether you are getting better. It is not a score and I do not want to hear it again. Out.'
    ]
  },
  {
    id: 'mae-vic-answer',
    caller: 'MAE',
    priority: 66,
    when: (c) => c.claimed('mae-vic'),
    text: [
      'So I asked Vic what he does with all the scrap and he said, and I want you to hear this in his voice, "I keep it."',
      'Four hundred of yours in a hole under a bridge. I have decided that is funny. It is that or the other thing.'
    ]
  },
  {
    id: 'eli-band-answer',
    caller: 'ELI',
    priority: 82,
    when: (c) => c.claimed('eli-band'),
    text: [
      'All five in one night. I sat here and listened to four people I have never met hand things to somebody none of us has ever seen, and then I listened to the fifth one not say anything at all.',
      'I have been calling this a congregation for six weeks as a joke. I would like to stop making the joke now.'
    ]
  },
  {
    id: 'vasquez-clean-answer',
    caller: 'VASQUEZ',
    priority: 94,
    when: (c) => c.claimed('vasquez-clean'),
    text: [
      'I have the clean run. Eight sectors, no contact with the silent carrier, and I finally have something to subtract.',
      'Here is what came out. On the nights it gives you something, you go further. That is expected — it gives you better equipment than any of us. But the street is also quieter. Fewer of them, not more.',
      'It is not helping you fight through. It is clearing a path. I do not have a next sentence for that and I have been trying to write one for three days.'
    ]
  },
  {
    id: 'quiet-listen-answer',
    caller: 'QUIET',
    priority: 96,
    when: (c) => c.claimed('quiet-listen'),
    text: [
      '— — — carrier open — — —',
      '[ the meter does not move. for eleven seconds there is nothing at all, which is not what an empty carrier sounds like. an empty carrier hisses. this is the other thing. this is a room with somebody in it. ]',
      '[ the card is gone off the board. nobody in the shelter took it down. ]'
    ]
  },

  // ------------------------------------------------------------------ filler

  {
    id: 'mae-idle-a',
    caller: 'MAE',
    priority: 8,
    once: false,
    when: (c) => c.runs >= 4,
    text: ['Still here. Still bored. Generator is holding, the dog next door has stopped barking, which I have decided to read as good news.']
  },
  {
    id: 'sarge-idle-a',
    caller: 'SARGE',
    priority: 8,
    once: false,
    when: (c) => c.runs >= 4,
    text: ['Nothing to report. Weapon clean, water boiled, hatch secured. Do the same and do not improvise. Out.']
  },
  {
    id: 'eli-idle-a',
    caller: 'ELI',
    priority: 8,
    once: false,
    when: (c) => c.runs >= 4,
    text: ['No sermon tonight. I have run out of the ones I believed and I will not read you the others. Just the carrier, and me, and you getting your boots off.']
  },
  {
    id: 'vasquez-idle-a',
    caller: 'VASQUEZ',
    priority: 8,
    once: false,
    when: (c) => c.runs >= 6,
    text: ['Sample sixty-one is doing what sixty behaved like and what fifty-nine did not. I am telling you because you are the only person who has heard any of the previous sixty.']
  }
];

/**
 * Picks the one line the player is owed on this trip down the stairs.
 *
 * Highest priority wins; ties are broken at random so two lines sitting at the
 * same tier do not always land in declaration order. Returns null when nothing
 * qualifies, which is a perfectly normal night — silence has to stay possible
 * or the band stops feeling like people and starts feeling like a dispenser.
 */
export function pickLine(ctx: RadioContext): RadioLine | null {
  const eligible = RADIO_LINES.filter((l) => {
    if (l.once !== false && ctx.seen(l.id)) return false;
    return l.when(ctx);
  });
  if (eligible.length === 0) return null;

  const best = Math.max(...eligible.map((l) => l.priority));
  const top = eligible.filter((l) => l.priority === best);
  return top[Math.floor(Math.random() * top.length)];
}

/** Every line already heard, in declaration order — the transcript on the radio set. */
export function heardLines(seen: (id: string) => boolean): RadioLine[] {
  return RADIO_LINES.filter((l) => seen(l.id));
}

/** How much of the band's writing the player has actually uncovered. */
export function logProgress(seen: (id: string) => boolean): { heard: number; total: number } {
  const tracked = RADIO_LINES.filter((l) => l.once !== false);
  return { heard: tracked.filter((l) => seen(l.id)).length, total: tracked.length };
}
