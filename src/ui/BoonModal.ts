import { injectTheme, TIER_COLOR } from '../theme/Palette';
import type { Player } from '../entities/Player';

/**
 * SIGNALS.
 *
 * Hades hands you boons from gods on Olympus. Out here, five people are still
 * broadcasting, and each of them helps in the only way they know how. Taking
 * from one repeatedly is how a run develops an identity.
 */
export type Caller = 'SARGE' | 'VASQUEZ' | 'MAE' | 'ELI' | 'QUIET';
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
}

type BoonTemplate = Omit<Boon, 'tier'>;

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
 * Three offers, never two from the same caller, weighted toward whoever the
 * player has been taking from — runs should be able to specialise.
 */
export function generateBoons(sectorNumber: number, favouredCaller?: Caller): Boon[] {
  const pool = [...TEMPLATES];

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

  return chosen.map((b) => ({ ...b, tier: rollTier(sectorNumber) }));
}

export function applyBoon(boon: Boon, player: Player): void {
  const k = TIER_SCALE[boon.tier];
  boon.apply(player, k);
  player.addBuff(boon.caller, CALLERS[boon.caller].name, boon.caller[0], CALLERS[boon.caller].color);
}

export function boonText(boon: Boon): string {
  return boon.describe(TIER_SCALE[boon.tier]);
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
      .sig-card {
        position: relative;
        width: 292px;
        min-height: 340px;
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
    `;
    document.head.appendChild(style);
  }

  public show(boons: Boon[], onSelect: (boon: Boon) => void): void {
    const cards = boons.map((b, i) => {
      const info = CALLERS[b.caller];
      const tierColor = TIER_COLOR[b.tier];
      return `
        <div class="sig-card" data-idx="${i}" style="border-left-color:${info.color}; animation-delay:${i * 60}ms;">
          <div class="sig-tier" style="color:${tierColor}; border-color:${tierColor};">${b.tier}</div>
          <div class="sig-band">${info.band}</div>
          <div class="sig-caller" style="color:${info.color};">${info.name}</div>
          <div class="sig-title">${b.title}</div>
          <div class="sig-desc">${boonText(b)}</div>
          <div class="sig-sting">${info.sting}</div>
          <div class="sig-take">ANSWER</div>
        </div>
      `;
    }).join('');

    this.root.innerHTML = `
      <div style="text-align:center; margin-bottom:26px; animation: llFade 0.3s ease-out;">
        <div style="font-size:11px; letter-spacing:5px; color:var(--ash); text-transform:uppercase;">
          The handset crackles
        </div>
        <div class="ll-title" style="font-size:38px; margin-top:8px;">Somebody Is Still Out There</div>
        <div class="ll-sub">Take one offer. The others go quiet.</div>
      </div>
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

  public hide(): void {
    this.root.style.display = 'none';
    this.visible = false;
  }

  public get isOpen(): boolean {
    return this.visible;
  }
}
