import { INK, INK_SOFT, RIM, svgRoot } from './Ink';

/**
 * THE MINT.
 *
 * Everything the player can be paid in gets a struck token, and they are all
 * struck the same way: an eight-sided plate cut from salvage, four rivets, a
 * bevelled inner face, one motif stamped into it. Reading them side by side is
 * supposed to feel like emptying a pocket, which is the only reason the family
 * resemblance matters more than any single icon.
 */
export type EmblemId =
  | 'scrap'     // the currency that survives your death
  | 'supplies'  // field medicine
  | 'arsenal'   // munitions and the hammer that fits them
  | 'signal'    // a voice on the band
  | 'trade'     // Vic's stall
  | 'works'     // somebody's bench, and what it does to your gun
  | 'home'      // the way back
  | 'bandage'   // in-run heal
  | 'stim';     // in-run flare charge

interface EmblemSkin {
  /** Lit face of the plate. */
  plate: string;
  /** Shadowed face of the plate. */
  plateDark: string;
  /** The stamped motif. */
  motif: string;
  /** Highlight catching the rim. */
  rim: string;
  label: string;
}

export const EMBLEM_SKIN: Record<EmblemId, EmblemSkin> = {
  scrap:    { plate: '#b98b3c', plateDark: '#7a5620', motif: '#2b1f0d', rim: '#e6c176', label: 'Scrap' },
  supplies: { plate: '#c3bda8', plateDark: '#837f6d', motif: '#8e2323', rim: '#efe9d6', label: 'Supplies' },
  arsenal:  { plate: '#a8552b', plateDark: '#6d3a20', motif: '#241408', rim: '#d9884f', label: 'Munitions' },
  signal:   { plate: '#c9a24a', plateDark: '#82652a', motif: '#231a08', rim: '#f0d089', label: 'Signal' },
  trade:    { plate: '#9a8256', plateDark: '#64543a', motif: '#211a0e', rim: '#cbb07a', label: 'Trade' },
  works:    { plate: '#7f8a92', plateDark: '#4e565c', motif: '#171b1e', rim: '#b9c5cc', label: 'Workbench' },
  home:     { plate: '#8f9a86', plateDark: '#5b6455', motif: '#161a12', rim: '#c8d0be', label: 'Home' },
  bandage:  { plate: '#cfc9b4', plateDark: '#8d8877', motif: '#8e2323', rim: '#f2ecd9', label: 'Bandage' },
  stim:     { plate: '#c07a3a', plateDark: '#7d4a1e', motif: '#1e1408', rim: '#efab5c', label: 'Stim' }
};

const OUTER = '92.5,67.6 67.6,92.5 32.4,92.5 7.5,67.6 7.5,32.4 32.4,7.5 67.6,7.5 92.5,32.4';
const INNER = '83.3,63.8 63.8,83.3 36.2,83.3 16.7,63.8 16.7,36.2 36.2,16.7 63.8,16.7 83.3,36.2';

/** The colours a struck plate needs. Everything else is shared. */
export interface PlateSkin {
  plate: string;
  plateDark: string;
  rim: string;
}

/**
 * The blank the whole set is struck on: eight sides, four rivets, a bevelled
 * inner face lit from the top left. Exported so anything that wants to belong
 * to this family — a survivor's mark, say — is struck the same way.
 */
export function struckPlate(motifBody: string, s: PlateSkin, size: number): string {
  return svgRoot(`
    <polygon points="${OUTER}" fill="${s.plateDark}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="${INNER}" fill="${s.plate}" stroke="${INK_SOFT}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32.4,7.5 L7.5,32.4 L7.5,67.6" fill="none" stroke="${s.rim}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
    <path d="M67.6,92.5 L92.5,67.6 L92.5,32.4" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
    ${motifBody}
    <circle cx="79" cy="21" r="2.8" fill="${INK}"/>
    <circle cx="21" cy="21" r="2.8" fill="${INK}"/>
    <circle cx="21" cy="79" r="2.8" fill="${INK}"/>
    <circle cx="79" cy="79" r="2.8" fill="${INK}"/>
  `, '0 0 100 100', size);
}

/** The stamped motif for each token, drawn into the inner 30..70 field. */
function motif(id: EmblemId, s: EmblemSkin): string {
  const ink = s.motif;

  switch (id) {
    // A hex nut off a wrecked car. Reads as hardware and as a coin at once,
    // which is exactly what scrap is.
    case 'scrap':
      return `
        <path d="M50 26 L71 38 L71 62 L50 74 L29 62 L29 38 Z" fill="${ink}"/>
        <path d="M50 34 L64 42 L64 58 L50 66 L36 58 L36 42 Z" fill="${s.plate}"/>
        <circle cx="50" cy="50" r="9" fill="${ink}"/>
        <path d="M33 40 L48 31" stroke="${s.rim}" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
        <path d="M31 58 L31 42" stroke="${s.rim}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
      `;

    // Field tin with a latch, cross painted on the lid by hand.
    case 'supplies':
      return `
        <rect x="28" y="34" width="44" height="32" rx="3" fill="${s.plateDark}" stroke="${ink}" stroke-width="4"/>
        <rect x="28" y="34" width="44" height="8" fill="${ink}" opacity="0.35"/>
        <rect x="45" y="30" width="10" height="6" rx="2" fill="${ink}"/>
        <path d="M46 44 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 Z" fill="${ink}"/>
        <path d="M30 36 L70 36" stroke="${s.rim}" stroke-width="2" opacity="0.55"/>
      `;

    // Three rounds standing in a clip. Nothing else needed.
    case 'arsenal': {
      const round = (x: number, y: number, k: number) => `
        <path d="M${x - 6 * k} ${y} h${12 * k} v${20 * k} h${-12 * k} Z" fill="${ink}"/>
        <path d="M${x - 6 * k} ${y} q${6 * k} ${-13 * k} ${12 * k} 0 Z" fill="${ink}"/>
        <path d="M${x - 6 * k} ${y + 20 * k} h${12 * k} v${5 * k} h${-12 * k} Z" fill="${ink}"/>
        <path d="M${x - 3.4 * k} ${y - 4 * k} v${20 * k}" stroke="${s.rim}" stroke-width="${2.2 * k}" stroke-linecap="round" opacity="0.7"/>
      `;
      return `
        ${round(31, 44, 0.82)}
        ${round(69, 44, 0.82)}
        ${round(50, 36, 1.05)}
        <path d="M26 70 h48 v8 h-48 Z" fill="${ink}"/>
        <path d="M29 72 h18" stroke="${s.rim}" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      `;
    }

    // Handset, antenna, three arcs going out. Somebody is talking.
    case 'signal':
      return `
        <path d="M40 38 h13 v9 h-4 v12 h4 v9 h-13 v-9 h4 v-12 h-4 Z" fill="${ink}"/>
        <path d="M53 34 L64 25" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="65.5" cy="23.5" r="3.4" fill="${ink}"/>
        <path d="M58 44 a11 11 0 0 1 0 14" fill="none" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M64 39 a19 19 0 0 1 0 24" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" opacity="0.8"/>
        <path d="M70 34 a27 27 0 0 1 0 34" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" opacity="0.55"/>
        <path d="M42 40 v26" stroke="${s.rim}" stroke-width="2" opacity="0.5"/>
      `;

    // Goods going one way, scrap the other. Vic's whole business, in two arrows.
    case 'trade':
      return `
        <path d="M28 40 h38" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
        <path d="M58 30 L72 40 L58 50 Z" fill="${ink}"/>
        <path d="M72 62 h-38" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
        <path d="M42 52 L28 62 L42 72 Z" fill="${ink}"/>
        <path d="M30 36 h20" stroke="${s.rim}" stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>
      `;

    // A hammer crossed with an open-end spanner. Somebody's tools, still on
    // the bench where they left them.
    case 'works':
      return `
        <g transform="rotate(-38 50 50)">
          <rect x="46.5" y="33" width="7" height="37" rx="2.5" fill="${ink}"/>
          <path d="M35 24 h30 v10 h-6.5 l-2.5 4.5 h-12 l-2.5 -4.5 h-6.5 Z" fill="${ink}"/>
          <path d="M48.5 38 v28" stroke="${s.rim}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        </g>
        <g transform="rotate(40 50 50)">
          <rect x="46.5" y="36" width="7" height="34" rx="2.5" fill="${ink}"/>
          <path d="M42 24 h4.5 v7 h7 v-7 h4.5 v13 a7.8 7.8 0 0 1 -16 0 Z" fill="${ink}"/>
          <path d="M48.5 42 v26" stroke="${s.rim}" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
        </g>
      `;

    // A doorway with the light on behind it, and an arrow pointing back in.
    case 'home':
      return `
        <path d="M31 72 V38 a19 19 0 0 1 38 0 v34 Z" fill="${s.plateDark}" stroke="${ink}" stroke-width="4"/>
        <path d="M40 72 V41 a10 10 0 0 1 20 0 v31 Z" fill="${RIM}" opacity="0.42"/>
        <path d="M58 52 H43 M49 45 L42 52 L49 59" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      `;

    // Gauze roll, end tucked under, cross tab.
    case 'bandage':
      return `
        <rect x="27" y="38" width="46" height="24" rx="12" fill="${s.plateDark}" stroke="${ink}" stroke-width="4"/>
        <path d="M37 39 v22 M63 39 v22" stroke="${ink}" stroke-width="3" opacity="0.7"/>
        <path d="M46 41 h8 v5 h5 v8 h-5 v5 h-8 v-5 h-5 v-8 h5 Z" fill="${ink}"/>
        <path d="M29 42 h42" stroke="${s.rim}" stroke-width="2" opacity="0.45"/>
      `;

    // Road flare with the cap struck and burning.
    case 'stim':
    default:
      return `
        <g transform="rotate(18 50 50)">
          <rect x="43" y="40" width="14" height="32" rx="2.5" fill="${ink}"/>
          <rect x="41" y="36" width="18" height="6" rx="2" fill="${ink}"/>
          <path d="M45.5 44 v24" stroke="${s.rim}" stroke-width="2.4" opacity="0.55"/>
          <path d="M50 34 c-7 -8 -3 -13 0 -17 c3 4 7 9 0 17 Z" fill="${ink}"/>
          <path d="M50 31 c-3.5 -5 -1.5 -8 0 -10 c1.5 2 3.5 5 0 10 Z" fill="${s.rim}"/>
        </g>
      `;
  }
}

/**
 * A struck token. `size` is the rendered pixel box; the art is authored at
 * 100×100 so it stays crisp at anything from a 14px HUD chip to a gate plaque.
 */
export function emblemSvg(id: EmblemId, size: number = 48): string {
  const s = EMBLEM_SKIN[id];
  return struckPlate(motif(id, s), s, size);
}

/** Inline chip: token plus a value, for HUD counters and price buttons. */
export function emblemChip(id: EmblemId, value: string | number, size = 18, color?: string): string {
  const s = EMBLEM_SKIN[id];
  return `
    <span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle;">
      ${emblemSvg(id, size)}
      <span style="color:${color ?? s.rim};">${value}</span>
    </span>
  `;
}
