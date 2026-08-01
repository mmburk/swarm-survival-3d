/**
 * LAST LIGHT — shared visual language.
 *
 * The game is set in a dead city after the outbreak. Nothing in it glows on
 * purpose: light comes from petrol lamps, road flares, muzzle flash and a
 * grey overcast sky. Every colour below is desaturated on purpose — if a value
 * looks like it belongs on a synthwave poster, it does not belong here.
 */

/** CSS colour strings, for HUD / menus / modals. */
export const CSS = {
  ink: '#0d0e0b',          // deepest shadow, page background
  soot: '#16180f',         // panel background
  soot2: '#1e2116',        // raised panel
  char: '#2a2d22',         // borders, dividers
  steel: '#4b4f45',        // inactive controls
  ash: '#8b8878',          // secondary text
  bone: '#ddd6c2',         // primary text
  paper: '#f0eada',        // headings
  rust: '#a8552b',         // primary accent (signage, rusted metal)
  rustDim: '#6d3a20',
  blood: '#8e2323',        // damage, danger
  bloodDim: '#511616',
  amber: '#d9a441',        // lamplight, currency, highlights
  amberDim: '#8a6826',
  moss: '#5d6b3a',         // infection, sickly green
  mossDim: '#39421f',
  sky: '#6d7a80',          // cold daylight
  copper: '#b07d42'
} as const;

/** three.js numeric colours. */
export const HEX = {
  ink: 0x0d0e0b,
  soot: 0x16180f,
  char: 0x2a2d22,
  steel: 0x4b4f45,
  ash: 0x8b8878,
  bone: 0xddd6c2,
  rust: 0xa8552b,
  rustDeep: 0x6d3a20,
  blood: 0x8e2323,
  bloodDark: 0x3f1010,
  gore: 0x6b1a1a,
  amber: 0xd9a441,
  amberDeep: 0x8a6826,
  moss: 0x5d6b3a,
  mossDark: 0x39421f,
  flesh: 0x8a8f76,       // rotten skin
  fleshPale: 0xa8ab92,
  fleshDark: 0x5c6250,
  denim: 0x3c4552,
  asphalt: 0x2b2c28,
  concrete: 0x54544c,
  dirt: 0x413526,
  smoke: 0x6b6b63,
  muzzle: 0xffd9a0,
  brass: 0xb98b3c
} as const;

let injected = false;

/**
 * Injects the shared stylesheet used by every DOM surface in the game.
 * Safe to call more than once.
 */
export function injectTheme(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'lastlight-theme';
  style.textContent = `
    :root {
      --ink: ${CSS.ink};
      --soot: ${CSS.soot};
      --soot2: ${CSS.soot2};
      --char: ${CSS.char};
      --steel: ${CSS.steel};
      --ash: ${CSS.ash};
      --bone: ${CSS.bone};
      --paper: ${CSS.paper};
      --rust: ${CSS.rust};
      --blood: ${CSS.blood};
      --amber: ${CSS.amber};
      --moss: ${CSS.moss};
      --stencil: "Arial Narrow", "Segoe UI Semibold", "Haettenschweiler", Impact, sans-serif;
      --body: "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    }

    .ll-panel {
      background:
        linear-gradient(180deg, rgba(38,40,30,0.97) 0%, rgba(18,20,14,0.98) 100%);
      border: 1px solid var(--char);
      border-top: 1px solid #3b3f31;
      box-shadow: 0 18px 50px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.04);
      border-radius: 3px;
      color: var(--bone);
    }

    /* Corner staples — cheap way to make a panel read as pinned paper. */
    .ll-panel.ll-pinned::before,
    .ll-panel.ll-pinned::after {
      content: '';
      position: absolute;
      width: 10px; height: 3px;
      background: var(--steel);
      top: 10px;
      opacity: 0.8;
    }
    .ll-panel.ll-pinned::before { left: 14px; transform: rotate(-12deg); }
    .ll-panel.ll-pinned::after  { right: 14px; transform: rotate(9deg); }

    .ll-title {
      font-family: var(--stencil);
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--paper);
      line-height: 1.05;
    }
    .ll-sub {
      font-family: var(--body);
      font-size: 11px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--ash);
      margin-top: 6px;
    }
    .ll-rule {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--char) 15%, var(--char) 85%, transparent);
      margin: 16px 0;
    }

    .ll-btn {
      font-family: var(--stencil);
      font-size: 17px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--ink);
      background: linear-gradient(180deg, #c46a35 0%, #8d4520 100%);
      border: 1px solid #d08048;
      border-radius: 2px;
      padding: 13px 26px;
      cursor: pointer;
      width: 100%;
      transition: filter 0.12s linear, transform 0.12s ease-out;
      pointer-events: auto;
    }
    .ll-btn:hover { filter: brightness(1.14); transform: translateY(-1px); }
    .ll-btn:active { transform: translateY(1px); filter: brightness(0.94); }
    .ll-btn[disabled] {
      background: linear-gradient(180deg, #3a3d33 0%, #24261e 100%);
      border-color: var(--char);
      color: #6d6a60;
      cursor: not-allowed;
      filter: none;
      transform: none;
    }

    .ll-btn-ghost {
      font-family: var(--body);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--ash);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--char);
      border-radius: 2px;
      padding: 9px 18px;
      cursor: pointer;
      transition: color 0.12s linear, border-color 0.12s linear;
      pointer-events: auto;
    }
    .ll-btn-ghost:hover { color: var(--bone); border-color: var(--steel); }
    .ll-btn-ghost[disabled] { opacity: 0.4; cursor: not-allowed; }

    .ll-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--body);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ash);
      background: rgba(0,0,0,0.35);
      border: 1px solid var(--char);
      border-radius: 2px;
      padding: 5px 11px;
    }
    .ll-tag.scrap { color: var(--amber); border-color: rgba(217,164,65,0.35); }

    .ll-scroll::-webkit-scrollbar { width: 8px; }
    .ll-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); }
    .ll-scroll::-webkit-scrollbar-thumb { background: var(--char); border-radius: 0; }
    .ll-scroll::-webkit-scrollbar-thumb:hover { background: var(--steel); }

    @keyframes llFadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes llFade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/** Rarity tiers shared by boons and trader stock. */
export const TIER_COLOR: Record<string, string> = {
  SALVAGED: '#8b8878',
  SOLID: '#7f9a63',
  PRIME: '#d9a441',
  RELIC: '#a8552b'
};
