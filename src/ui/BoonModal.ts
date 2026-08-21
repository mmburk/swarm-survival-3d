import { injectTheme, TIER_COLOR } from '../theme/Palette';
import type { Player } from '../entities/Player';
import { callerPortrait, callerSigil, type CallerArtId } from './art/Portraits';
import { emblemSvg } from './art/Emblems';
import type { FieldWork } from '../config/FieldWorks';

/** Cold steel, so the bench never reads as one of the five voices. */
const WORKS_INK = '#b9c5cc';

/**
 * SIGNALS.
 *
 * Hades hands you boons from gods on Olympus. Out here, five people are still
 * broadcasting, and each of them helps in the only way they know how. Taking
 * from one repeatedly is how a run develops an identity.
 *
 * The gate you walked through decides who is on the handset, so the choice is
 * made outside on the street and the cards only pick which favour you take.
 */
export type Caller = CallerArtId;
export type Tier = 'SALVAGED' | 'SOLID' | 'PRIME' | 'RELIC';

interface CallerInfo {
  name: string;
  band: string;
  color: string;
  /** How this survivor signs off; pure flavour. */
  sting: string;
}

export const CALLERS: Record<Caller, CallerInfo> = {
  SARGE: {
    name: 'SARGE',
    band: '121.5 — GUARD FREQ',
    color: '#a8552b',
    sting: '"Aim small, miss small. Out."'
  },
  VASQUEZ: {
    name: 'DR. VASQUEZ',
    band: '148.2 — CDC RELAY',
    color: '#6f8a3c',
    sting: '"It is a pathogen. Use it back on them."'
  },
  MAE: {
    name: 'MAE',
    band: '27.185 — CB CH.19',
    color: '#c99a3c',
    sting: '"If it jams, hit it. If it still jams, hit it harder."'
  },
  ELI: {
    name: 'PASTOR ELI',
    band: '89.9 — CHURCH FM',
    color: '#c6c2b0',
    sting: '"You are not finished yet, son."'
  },
  QUIET: {
    name: 'UNKNOWN',
    band: '???  — CARRIER ONLY',
    color: '#8e2323',
    sting: '[the signal cuts out]'
  }
};

const TIER_SCALE: Record<Tier, number> = {
  SALVAGED: 1.0,
  SOLID: 1.35,
  PRIME: 1.8,
  RELIC: 2.4
};

export interface Boon {
  id: string;
  caller: Caller;
  title: string;
  /** Takes the tier multiplier so the copy always matches the real numbers. */
  describe: (k: number) => string;
  apply: (player: Player, k: number) => void;
  tier: Tier;
  /**
   * A bonded signal: two people who have already helped you working out, over
   * the air, what they can do together. Fixed strength — it does not scale
   * with tier, because what it changes is a rule rather than a number.
   */
  bonded?: boolean;
}

type BoonTemplate = Omit<Boon, 'tier'>;

/**
 * BONDED SIGNALS.
 *
 * The one thing twenty independent multipliers could never do: make the last
 * favour you took change what the next one is worth. A bonded signal is only
 * ever offered to a run that is already carrying both of its parents, so it is
 * the reward for committing to a direction rather than taking the biggest
 * number on each card.
 *
 * They change a rule, not a coefficient. That is the whole point of them —
 * a run's identity has to be mechanical or it is just arithmetic.
 */
interface PairingTemplate extends BoonTemplate {
  /** Both of these have to be on the run sheet already. */
  requires: [string, string];
  /** Shown on the card so the player can see where it came from. */
  parents: string;
}

const TEMPLATES: BoonTemplate[] = [
  // ---- SARGE: straight lethality -----------------------------------------
  {
    id: 'suppressing_fire',
    caller: 'SARGE',
    title: 'Suppressing Fire',
    // Both halves read the same factor so the card can never lie about the effect.
    describe: (k) => `+${Math.round((1 / (1 - 0.13 * k) - 1) * 100)}% rate of fire.`,
    apply: (p, k) => { p.fireRateMultiplier *= 1 - 0.13 * k; }
  },
  {
    id: 'aim_small',
    caller: 'SARGE',
    title: 'Aim Small',
    describe: (k) => `+${Math.round(20 * k)}% damage on everything you fire.`,
    apply: (p, k) => { p.damageMultiplier *= 1 + 0.20 * k; }
  },
  {
    id: 'fragmentation',
    caller: 'SARGE',
    title: 'Frag Discipline',
    describe: (k) => `Your heavy attack comes back ${Math.round(16 * k)}% sooner.`,
    apply: (p, k) => { p.altCooldownMultiplier *= 1 - 0.16 * k; }
  },
  {
    id: 'rounds_downrange',
    caller: 'SARGE',
    title: 'Rounds Downrange',
    describe: (k) => `+${Math.round(9 * k)}% rate of fire and ${Math.round(18 * k)}% flatter shots.`,
    apply: (p, k) => { p.fireRateMultiplier *= 1 - 0.09 * k; p.bulletSpeedMultiplier *= 1 + 0.18 * k; }
  },

  // ---- VASQUEZ: the infection, turned around ------------------------------
  {
    id: 'viral_load',
    caller: 'VASQUEZ',
    title: 'Viral Load',
    describe: (k) => `${Math.round(14 * k)}% of kills rupture, harming the crowd around them.`,
    apply: (p, k) => { p.burstChance += 0.14 * k; }
  },
  {
    id: 'necrosis',
    caller: 'VASQUEZ',
    title: 'Necrosis',
    describe: (k) => `+${Math.round(16 * k)}% damage and your rounds punch through one more body.`,
    apply: (p, k) => { p.damageMultiplier *= 1 + 0.16 * k; p.bonusPierce += 1; }
  },
  {
    id: 'antigen',
    caller: 'VASQUEZ',
    title: 'Antigen Draw',
    describe: (k) => `${Math.round(22 * k)}% of kills return ${Math.round(3 * k)} health.`,
    apply: (p, k) => { p.lifestealChance += 0.22 * k; p.lifestealAmount += Math.round(3 * k); }
  },
  {
    id: 'cross_infection',
    caller: 'VASQUEZ',
    title: 'Cross-Infection',
    describe: (k) => `${Math.round(9 * k)}% more ruptures, and rounds carry through one more body.`,
    apply: (p, k) => { p.burstChance += 0.09 * k; p.bonusPierce += 1; }
  },

  // ---- MAE: the gun itself ------------------------------------------------
  {
    id: 'reworked_action',
    caller: 'MAE',
    title: 'Reworked Action',
    describe: (k) => `Rounds fly ${Math.round(25 * k)}% faster and reach further.`,
    apply: (p, k) => { p.bulletSpeedMultiplier *= 1 + 0.25 * k; p.weapon.range += 6 * k; }
  },
  {
    id: 'hardened_core',
    caller: 'MAE',
    title: 'Hardened Cores',
    describe: (k) => `Rounds pass through ${Math.round(1 + k)} more bodies.`,
    apply: (p, k) => { p.bonusPierce += Math.round(1 + k); }
  },
  {
    id: 'deep_pockets',
    caller: 'MAE',
    title: 'Bigger Pockets',
    describe: (k) => `+${(2.5 * k).toFixed(1)}m salvage range, and bandages do ${Math.round(25 * k)}% more.`,
    apply: (p, k) => { p.pickupRadius += 2.5 * k; p.healPotency += 0.25 * k; }
  },
  {
    id: 'scavenged_springs',
    caller: 'MAE',
    title: 'Scavenged Springs',
    describe: (k) => `+${Math.round((1 / (1 - 0.08 * k) - 1) * 100)}% rate of fire and +${(1.5 * k).toFixed(1)}m salvage range.`,
    apply: (p, k) => { p.fireRateMultiplier *= 1 - 0.08 * k; p.pickupRadius += 1.5 * k; }
  },

  // ---- ELI: staying alive -------------------------------------------------
  {
    id: 'iron_faith',
    caller: 'ELI',
    title: 'Something To Hold',
    describe: (k) => `+${Math.round(30 * k)} maximum health, filled now.`,
    apply: (p, k) => { const g = Math.round(30 * k); p.maxHealth += g; p.heal(g); }
  },
  {
    id: 'armour_of_it',
    caller: 'ELI',
    title: 'Armour Of It',
    describe: (k) => `Take ${Math.round(9 * k)}% less damage from everything.`,
    apply: (p, k) => { p.toughness = Math.min(0.55, p.toughness + 0.09 * k); }
  },
  {
    id: 'not_finished',
    caller: 'ELI',
    title: 'Not Finished Yet',
    describe: () => 'Get back up one more time before the night takes you.',
    apply: (p) => { p.maxGetUps += 1; p.getUpsRemaining += 1; }
  },
  {
    id: 'lay_on_hands',
    caller: 'ELI',
    title: 'Lay On Hands',
    describe: (k) => `Bandages do ${Math.round(35 * k)}% more, and ${Math.round(12 * k)}% of kills give back ${Math.round(2 * k)}.`,
    apply: (p, k) => { p.healPotency += 0.35 * k; p.lifestealChance += 0.12 * k; p.lifestealAmount += Math.round(2 * k); }
  },

  // ---- THE QUIET ONE: sharp edges both ways -------------------------------
  {
    id: 'steady_breath',
    caller: 'QUIET',
    title: 'Steady Breath',
    describe: (k) => `+${Math.round(12 * k)}% chance of a clean hit.`,
    apply: (p, k) => { p.critChance += 0.12 * k; }
  },
  {
    id: 'exit_wound',
    caller: 'QUIET',
    title: 'Exit Wound',
    describe: (k) => `Clean hits do ${(0.6 * k).toFixed(1)}x more damage than they already did.`,
    apply: (p, k) => { p.critMultiplier += 0.6 * k; }
  },
  {
    id: 'run_light',
    caller: 'QUIET',
    title: 'Run Light',
    describe: (k) => `+${Math.round(13 * k)}% movement speed. Drop 10 maximum health.`,
    apply: (p, k) => {
      p.moveSpeed *= 1 + 0.13 * k;
      p.maxHealth = Math.max(30, p.maxHealth - 10);
      p.health = Math.min(p.health, p.maxHealth);
    }
  },
  {
    id: 'nothing_personal',
    caller: 'QUIET',
    title: 'Nothing Personal',
    describe: (k) => `+${Math.round(14 * k)}% damage. Drop 8 maximum health.`,
    apply: (p, k) => {
      p.damageMultiplier *= 1 + 0.14 * k;
      p.maxHealth = Math.max(30, p.maxHealth - 8);
      p.health = Math.min(p.health, p.maxHealth);
    }
  }
];

const PAIRINGS: PairingTemplate[] = [
  {
    id: 'through_and_through',
    // Mae builds the round; the quiet one tells you where it goes.
    caller: 'MAE',
    title: 'Through And Through',
    requires: ['hardened_core', 'exit_wound'],
    parents: 'Hardened Cores + Exit Wound',
    describe: () => 'Every body a round passes through makes it hit 35% harder than the last.',
    apply: (p) => { p.pierceGrowth = 0.35; }
  }
];

function rollTier(sectorNumber: number): Tier {
  // Better gear turns up deeper into the run.
  const bias = Math.min(0.3, sectorNumber * 0.03);
  const r = Math.random() + bias;
  if (r < 0.46) return 'SALVAGED';
  if (r < 0.78) return 'SOLID';
  if (r < 0.95) return 'PRIME';
  return 'RELIC';
}

/**
 * Three offers.
 *
 * When the gate named a caller — which is the normal case now — every offer
 * comes from that one person, exactly like walking through a door marked with
 * a god's symbol. The mixed draw below is the fallback for anything that hands
 * out a signal without a door in front of it.
 */
export function generateBoons(
  sectorNumber: number,
  favouredCaller?: Caller,
  lockedCaller?: Caller,
  held?: ReadonlySet<string>
): Boon[] {
  const taken = held ?? new Set<string>();

  // A favour already on the sheet is never offered twice. It used to be, and
  // taking it again simply multiplied the same number a second time — which is
  // the least interesting thing a card can do. Each caller's four are now a
  // finite set, and running that set down is what earns a bonded signal.
  const fresh = TEMPLATES.filter((b) => !taken.has(b.id));

  // Anything the run has now qualified for. These jump the queue: a bonded
  // signal is rare enough that burying it under a random draw would mean most
  // players never see one.
  const earned: BoonTemplate[] = PAIRINGS.filter(
    (p) => !taken.has(p.id) && p.requires.every((r) => taken.has(r))
  );

  const bond = (b: BoonTemplate): Boon => ({ ...b, tier: 'RELIC', bonded: true });

  if (lockedCaller) {
    const theirs = fresh.filter((b) => b.caller === lockedCaller).sort(() => Math.random() - 0.5);
    const offers: Boon[] = earned.slice(0, 1).map(bond);

    for (const b of theirs) {
      if (offers.length >= 3) break;
      offers.push({ ...b, tier: rollTier(sectorNumber) });
    }

    // Their four are spent. Rather than showing a short hand, the rest of the
    // band covers — somebody else on the dial answers instead.
    if (offers.length < 3) {
      const others = fresh.filter((b) => b.caller !== lockedCaller).sort(() => Math.random() - 0.5);
      for (const b of others) {
        if (offers.length >= 3) break;
        offers.push({ ...b, tier: rollTier(sectorNumber) });
      }
    }
    return offers;
  }

  const pool = [...fresh];

  // Nudge one favoured-caller offer to the front when the player has a theme.
  if (favouredCaller && Math.random() < 0.5) {
    const favoured = pool.filter((b) => b.caller === favouredCaller);
    if (favoured.length) {
      const pick = favoured[Math.floor(Math.random() * favoured.length)];
      pool.splice(pool.indexOf(pick), 1);
      pool.unshift(pick);
    }
  }

  const chosen: BoonTemplate[] = [];
  const usedCallers = new Set<Caller>();

  for (const b of pool.slice(0, 1)) {
    chosen.push(b);
    usedCallers.add(b.caller);
  }

  const rest = pool.slice(1).sort(() => Math.random() - 0.5);
  for (const b of rest) {
    if (chosen.length >= 3) break;
    if (usedCallers.has(b.caller)) continue;
    chosen.push(b);
    usedCallers.add(b.caller);
  }

  const offers: Boon[] = earned.slice(0, 1).map(bond);
  for (const b of chosen) {
    if (offers.length >= 3) break;
    offers.push({ ...b, tier: rollTier(sectorNumber) });
  }
  return offers;
}

export function applyBoon(boon: Boon, player: Player): void {
  const k = boonScale(boon);
  boon.apply(player, k);
  player.heldBoons.set(boon.id, boon.tier);
  player.addBuff(boon.caller, CALLERS[boon.caller].name, boon.caller[0], CALLERS[boon.caller].color);
}

/** Bonded signals change a rule, so there is no tier for them to scale with. */
function boonScale(boon: Boon): number {
  return boon.bonded ? 1 : TIER_SCALE[boon.tier];
}

/** One line on the run sheet: a favour the run is actually carrying. */
export interface HeldSignal {
  id: string;
  title: string;
  caller: Caller;
  tier: Tier;
  text: string;
  bonded: boolean;
}

/**
 * A bonded signal the run is part of the way to, and what is still missing.
 *
 * Without this the pairings would only ever be found by accident: nothing else
 * in the game tells the player that two particular favours add up to a third.
 * A lead is not a promise — the parent still has to be offered — but it turns
 * "take the biggest number" into "take the one that finishes something".
 */
export interface PairingLead {
  id: string;
  title: string;
  text: string;
  have: string[];
  missing: string[];
  /**
   * Both parents are on the sheet and it has not been taken yet — so it is
   * sitting in the pool waiting for the player to walk through a door with a
   * voice on it. Worth saying out loud: a run can hold both halves for three
   * sectors without seeing the card, if it keeps taking salvage gates.
   */
  ready: boolean;
}

function titleOf(id: string): string {
  return TEMPLATES.find((t) => t.id === id)?.title ?? PAIRINGS.find((p) => p.id === id)?.title ?? id;
}

/** Everything on the sheet, in the order it would have been picked up. */
export function heldSignals(held: ReadonlyMap<string, Tier>): HeldSignal[] {
  const out: HeldSignal[] = [];
  for (const [id, tier] of held) {
    const pairing = PAIRINGS.find((p) => p.id === id);
    const template: BoonTemplate | undefined = pairing ?? TEMPLATES.find((t) => t.id === id);
    if (!template) continue;
    const boon: Boon = { ...template, tier, bonded: !!pairing };
    out.push({
      id,
      title: template.title,
      caller: template.caller,
      tier,
      text: boonText(boon),
      bonded: !!pairing
    });
  }
  return out;
}

/** Pairings the run has started: one parent held, or both and not yet taken. */
export function pairingLeads(held: ReadonlyMap<string, Tier>): PairingLead[] {
  const leads: PairingLead[] = [];
  for (const p of PAIRINGS) {
    if (held.has(p.id)) continue;
    const have = p.requires.filter((r) => held.has(r));
    const missing = p.requires.filter((r) => !held.has(r));
    if (have.length === 0) continue;
    leads.push({
      id: p.id,
      title: p.title,
      text: p.describe(1),
      have: have.map(titleOf),
      missing: missing.map(titleOf),
      ready: missing.length === 0
    });
  }
  return leads;
}

export function boonText(boon: Boon): string {
  return boon.describe(boonScale(boon));
}

export class BoonModal {
  private root: HTMLElement;
  private visible: boolean = false;

  constructor() {
    injectTheme();

    this.root = document.createElement('div');
    this.root.id = 'signal-modal';
    this.root.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(8, 9, 6, 0.9);
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 1100;
      font-family: var(--body);
      user-select: none;
    `;
    document.body.appendChild(this.root);

    const style = document.createElement('style');
    style.textContent = `
      /* The caller's plate: portrait, name, and the frequency they are on. */
      .sig-who {
        display: flex;
        align-items: stretch;
        gap: 18px;
        padding: 14px 22px 14px 14px;
        background: linear-gradient(90deg, rgba(28,30,21,0.95), rgba(14,16,10,0.6));
        border: 1px solid var(--char);
        border-left: 4px solid var(--steel);
        animation: llFadeUp 0.26s ease-out;
      }
      .sig-who-art {
        position: relative;
        flex: 0 0 auto;
        /* The figure is cut out and carries its own shadow, so framing it here
           would only draw a box round the empty air beside its shoulders. */
      }
      .sig-who-name {
        font-family: var(--stencil);
        font-size: 34px;
        letter-spacing: 4px;
        line-height: 1.05;
      }
      .sig-who-band {
        font-size: 10.5px;
        letter-spacing: 2.6px;
        text-transform: uppercase;
        color: var(--ash);
        margin-top: 5px;
      }
      .sig-who-sting {
        font-size: 12.5px;
        font-style: italic;
        color: var(--bone);
        margin-top: 12px;
        max-width: 340px;
        line-height: 1.5;
      }

      .sig-card {
        position: relative;
        width: 292px;
        min-height: 340px;
        overflow: hidden;
        background: linear-gradient(180deg, #23251b 0%, #14150f 100%);
        border: 1px solid var(--char);
        border-left: 3px solid var(--steel);
        border-radius: 2px;
        padding: 22px 22px 18px;
        display: flex;
        flex-direction: column;
        cursor: pointer;
        transition: transform 0.15s ease-out, border-color 0.15s linear, box-shadow 0.15s linear;
        box-shadow: 0 16px 40px rgba(0,0,0,0.6);
        animation: llFadeUp 0.28s ease-out backwards;
      }
      .sig-card:hover {
        transform: translateY(-6px);
        box-shadow: 0 24px 54px rgba(0,0,0,0.75);
      }
      .sig-band {
        font-size: 10px;
        letter-spacing: 2px;
        color: var(--ash);
        text-transform: uppercase;
      }
      .sig-caller {
        font-family: var(--stencil);
        font-size: 25px;
        letter-spacing: 3px;
        margin-top: 3px;
      }
      .sig-tier {
        position: absolute;
        top: 14px; right: 16px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 2px;
        padding: 3px 8px;
        border: 1px solid;
        border-radius: 1px;
      }
      .sig-title {
        font-family: var(--stencil);
        font-size: 22px;
        letter-spacing: 1.5px;
        color: var(--paper);
        margin-top: 20px;
      }
      .sig-desc {
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--bone);
        margin-top: 10px;
        flex-grow: 1;
      }
      .sig-sting {
        font-size: 11.5px;
        font-style: italic;
        color: var(--ash);
        border-top: 1px solid var(--char);
        padding-top: 11px;
        margin-top: 14px;
      }
      .sig-take {
        margin-top: 12px;
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 3px;
        color: var(--ash);
        border: 1px solid var(--char);
        padding: 8px 0;
      }
      .sig-card:hover .sig-take { color: var(--paper); }

      /* The caller's mark, stamped large and faint across the card. */
      .sig-mark {
        position: absolute;
        right: -18px;
        bottom: -14px;
        opacity: 0.13;
        pointer-events: none;
        transition: opacity 0.15s linear, transform 0.2s ease-out;
      }
      .sig-card:hover .sig-mark { opacity: 0.22; transform: translateY(-6px); }
      .sig-card > *:not(.sig-mark) { position: relative; z-index: 1; }
    `;
    document.head.appendChild(style);
  }

  public show(boons: Boon[], onSelect: (boon: Boon) => void): void {
    // Gate-driven offers all come from one person, and then the portrait plate
    // above the cards carries the identity instead of repeating it three times.
    const single = boons.length > 0 && boons.every((b) => b.caller === boons[0].caller);
    const host = single ? boons[0].caller : null;

    const cards = boons.map((b, i) => {
      const info = CALLERS[b.caller];
      const tierColor = b.bonded ? TIER_COLOR.BONDED : TIER_COLOR[b.tier];
      const parents = b.bonded ? PAIRINGS.find((p) => p.id === b.id)?.parents : undefined;
      return `
        <div class="sig-card" data-idx="${i}" style="border-left-color:${tierColor}; animation-delay:${i * 60}ms;">
          <div class="sig-mark">${callerSigil(b.caller, 150, info.color)}</div>
          <div class="sig-tier" style="color:${tierColor}; border-color:${tierColor};">${b.bonded ? 'BONDED' : b.tier}</div>
          ${
            b.bonded
              ? `<div class="sig-band" style="color:${tierColor};">Two of them worked this out</div>`
              : single
                ? `<div class="sig-band">Offer ${i + 1} of ${boons.length}</div>`
                : `<div class="sig-band">${info.band}</div>
                   <div class="sig-caller" style="color:${info.color};">${info.name}</div>`
          }
          <div class="sig-title"${single || b.bonded ? ' style="margin-top:8px;"' : ''}>${b.title}</div>
          <div class="sig-desc">${boonText(b)}</div>
          ${parents ? `<div class="sig-sting" style="color:${tierColor};">${parents}</div>` : ''}
          ${single || b.bonded ? '' : `<div class="sig-sting">${info.sting}</div>`}
          <div class="sig-take">ANSWER</div>
        </div>
      `;
    }).join('');

    const plate = host
      ? `
        <div class="sig-who" style="border-left-color:${CALLERS[host].color}; margin-bottom:24px;">
          <div class="sig-who-art">${callerPortrait(host, 132)}</div>
          <div style="display:flex; flex-direction:column; justify-content:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              ${callerSigil(host, 26, CALLERS[host].color)}
              <div class="sig-who-name" style="color:${CALLERS[host].color};">${CALLERS[host].name}</div>
            </div>
            <div class="sig-who-band">${CALLERS[host].band}</div>
            <div class="sig-who-sting">${CALLERS[host].sting}</div>
          </div>
        </div>
      `
      : '';

    this.root.innerHTML = `
      <div style="text-align:center; margin-bottom:20px; animation: llFade 0.3s ease-out;">
        <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
          ${emblemSvg('signal', 26)}
          <div style="font-size:11px; letter-spacing:5px; color:var(--ash); text-transform:uppercase;">
            The handset crackles
          </div>
        </div>
        <div class="ll-title" style="font-size:38px; margin-top:8px;">
          ${host ? 'They Picked Up' : 'Somebody Is Still Out There'}
        </div>
        <div class="ll-sub">Take one offer. The others go quiet.</div>
      </div>
      ${plate}
      <div style="display:flex; gap:24px; justify-content:center; flex-wrap:wrap; padding:0 20px;">
        ${cards}
      </div>
    `;

    this.root.querySelectorAll<HTMLElement>('.sig-card').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx ?? '0', 10);
        this.hide();
        onSelect(boons[idx]);
      });
    });

    this.root.style.display = 'flex';
    this.visible = true;
  }

  /**
   * The workbench, laid out on the same cards.
   *
   * It is not a signal and nobody is on the handset for it — the gun is the
   * only thing talking. The cards are shared with the boon draw on purpose:
   * the player has already learned that three cards means "take one, the rest
   * go away", and the workbench should not have to teach that again.
   */
  public showWorks(works: FieldWork[], weaponName: string, onSelect: (work: FieldWork) => void): void {
    const cards = works.map((w, i) => `
      <div class="sig-card" data-idx="${i}" style="border-left-color:${WORKS_INK}; animation-delay:${i * 60}ms;">
        <div class="sig-mark">${emblemSvg('works', 150)}</div>
        <div class="sig-tier" style="color:${WORKS_INK}; border-color:${WORKS_INK};">FITTED HERE</div>
        <div class="sig-band">Bench work ${i + 1} of ${works.length}</div>
        <div class="sig-title" style="margin-top:8px;">${w.name}</div>
        <div class="sig-desc">${w.desc}</div>
        <div class="sig-take">FIT IT</div>
      </div>
    `).join('');

    this.root.innerHTML = `
      <div style="text-align:center; margin-bottom:20px; animation: llFade 0.3s ease-out;">
        <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
          ${emblemSvg('works', 26)}
          <div style="font-size:11px; letter-spacing:5px; color:var(--ash); text-transform:uppercase;">
            The vice is still tight
          </div>
        </div>
        <div class="ll-title" style="font-size:38px; margin-top:8px;">The Workbench</div>
        <div class="ll-sub">One piece of work on the ${weaponName}. It stays fitted for the rest of the run.</div>
      </div>
      <div style="display:flex; gap:24px; justify-content:center; flex-wrap:wrap; padding:0 20px;">
        ${cards}
      </div>
    `;

    this.root.querySelectorAll<HTMLElement>('.sig-card').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx ?? '0', 10);
        this.hide();
        onSelect(works[idx]);
      });
    });

    this.root.style.display = 'flex';
    this.visible = true;
  }

  public hide(): void {
    this.root.style.display = 'none';
    this.visible = false;
  }

  public get isOpen(): boolean {
    return this.visible;
  }
}
