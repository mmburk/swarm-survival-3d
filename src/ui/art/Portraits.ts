import { svgRoot } from './Ink';
import { struckPlate, type PlateSkin } from './Emblems';
import { PORTRAIT_SRC } from './PortraitPhotos';

/**
 * THE CAST.
 *
 * Every face the game names appears in two forms, because they are read at two
 * very different distances:
 *
 *   - a painted bust, for the radio set, the roster and the boon card, where
 *     the player is stopped and looking straight at it;
 *   - a one-shape mark, for the chips and stencils they read at a run.
 *
 * The busts are artwork on disk (see PortraitPhotos.ts). The marks are drawn
 * here in SVG, because a painted face shrunk to 16px is mud, while a silhouette
 * you have seen five times is not.
 */
export type CallerArtId = 'SARGE' | 'VASQUEZ' | 'MAE' | 'ELI' | 'QUIET';
/** The cast, plus the person carrying the gun. */
export type PortraitId = CallerArtId | 'PLAYER';

export interface Skin {
  /** Lit plane of the face. */
  lit: string;
  /** The shadow side. A mixed colour, never the lit tone at low opacity. */
  shade: string;
  /** Deepest occlusion — under the brow, inside the hood. */
  core: string;
  hair: string;
  hairLit: string;
  cloth: string;
  clothDark: string;
  /** Signature colour. Matches CALLERS[].color for the five on the band. */
  key: string;
  /** The back light. Warm for the living, cold or bloody for what is not. */
  rim: string;
}

export const SKIN: Record<PortraitId, Skin> = {
  SARGE:   { lit: '#c08f61', shade: '#7c5335', core: '#4a2f1c', hair: '#2e2820', hairLit: '#4a4033', cloth: '#4b5136', clothDark: '#2b301d', key: '#a8552b', rim: '#ffb968' },
  VASQUEZ: { lit: '#bd8a63', shade: '#7a5138', core: '#452c1e', hair: '#1d1815', hairLit: '#382e28', cloth: '#7d8a5c', clothDark: '#414a2c', key: '#6f8a3c', rim: '#d9f08a' },
  MAE:     { lit: '#d2a374', shade: '#8d6440', core: '#513722', hair: '#8a4f1e', hairLit: '#c07c33', cloth: '#42506a', clothDark: '#242c3c', key: '#c99a3c', rim: '#ffd07a' },
  // Weathered darker than the rest of the cast on purpose: a pale beard over
  // pale skin under a white rim light turns the whole head into one blank mass.
  ELI:     { lit: '#a9805c', shade: '#6d4d34', core: '#3f2a1b', hair: '#8b8574', hairLit: '#c3bcaa', cloth: '#24231d', clothDark: '#111008', key: '#c6c2b0', rim: '#e8dcc0' },
  QUIET:   { lit: '#3f3730', shade: '#241f1a', core: '#0b0906', hair: '#151109', hairLit: '#2a2216', cloth: '#2c261c', clothDark: '#14100a', key: '#8e2323', rim: '#e03a2c' },
  PLAYER:  { lit: '#c49669', shade: '#7f563a', core: '#472e1e', hair: '#2a2317', hairLit: '#463c27', cloth: '#5a5236', clothDark: '#332f1e', key: '#a8552b', rim: '#ffbe72' }
};

/**
 * A cut-out bust, 5:6, sized to whatever box you give it.
 *
 * The figure has no ground of its own — it is lifted off its background and
 * stands on whatever panel it is dropped into, so a survivor leans out of the
 * radio set rather than sitting in a window cut into it.
 *
 * The two shadows are what keep that from looking like a sticker. The first
 * traces the silhouette in the character's signature colour, standing in for
 * the rim light that was cut away with the background and tying the figure to
 * the coloured tape along the radio set. The second is an ordinary dark shadow
 * dropped below, which is the only thing giving the figure any weight.
 *
 * No alt text: every surface that shows a portrait prints the character's name
 * beside it, and a screen reader saying that name twice helps nobody.
 */
export function callerPortrait(id: PortraitId, width: number = 120): string {
  const s = SKIN[id];
  const height = Math.round((width * 240) / 200);
  const halo = `drop-shadow(0 0 ${Math.round(width * 0.06)}px ${s.key})`;
  const weight = `drop-shadow(0 ${Math.round(width * 0.03)}px ${Math.round(width * 0.05)}px rgba(0,0,0,0.72))`;
  return `<img src="${PORTRAIT_SRC[id]}" alt="" width="${width}" height="${height}" draggable="false"
    style="display:block; width:${width}px; height:${height}px; object-fit:contain; filter:${halo} ${weight};"/>`;
}

// -------------------------------------------------------------------- marks

/**
 * Each survivor's mark.
 *
 * This is what gets nailed over a doorway — a face painted at that size and
 * read at a run is mud, but a shape you have seen five times is not. One
 * silhouette, no interior detail, legible at 16px.
 */
function sigilBody(id: PortraitId, c: string): string {
  const stroke = `fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"`;

  switch (id) {
    // Sergeant's stripes.
    case 'SARGE':
      return `
        <path d="M16 40 L50 18 L84 40" ${stroke}/>
        <path d="M16 62 L50 40 L84 62" ${stroke}/>
        <path d="M16 84 L50 62 L84 84" ${stroke}/>
      `;

    // A specimen vial. What is in it is the reason any of this happened.
    case 'VASQUEZ':
      return `
        <path d="M34 12 h32" ${stroke}/>
        <path d="M42 14 v24 L28 68 a24 22 0 0 0 44 0 L58 38 V14" ${stroke}/>
        <path d="M31 60 a24 22 0 0 0 38 0 Z" fill="${c}"/>
        <circle cx="44" cy="52" r="4.5" fill="${c}"/>
        <circle cx="58" cy="44" r="3" fill="${c}"/>
      `;

    // A wrench. Mae fixes what the world broke, in the order she finds it.
    case 'MAE':
      return `
        <g transform="rotate(-38 50 50)">
          <path d="M42 32 h16 v54 h-16 Z" fill="${c}"/>
          <path d="M34 10 h9 v11 h14 v-11 h9 v20 a16 16 0 0 1 -32 0 Z" fill="${c}"/>
          <path d="M42 32 h16 v9 h-16 Z" fill="#0d0e0b" opacity="0.3"/>
        </g>
      `;

    // Two boards and the nail holding them together.
    case 'ELI':
      return `
        <path d="M50 10 V90" ${stroke}/>
        <path d="M20 38 H80" ${stroke}/>
        <circle cx="50" cy="38" r="7" fill="#0d0e0b"/>
        <circle cx="50" cy="38" r="3" fill="${c}"/>
      `;

    // The player's own mark: the last lit window in a dead street.
    case 'PLAYER':
      return `
        <path d="M24 88 V40 L50 16 L76 40 v48 Z" fill="none" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>
        <path d="M40 88 V58 h20 v30 Z" fill="${c}"/>
        <path d="M50 30 v14 M38 42 h24" stroke="${c}" stroke-width="6" stroke-linecap="round"/>
      `;

    // A carrier wave that stops mid-sentence, and two beats of nothing after.
    case 'QUIET':
    default:
      return `
        <circle cx="50" cy="50" r="38" fill="none" stroke="${c}" stroke-width="5" opacity="0.45"/>
        <path d="M16 50 h10 l8 -17 l10 34 l9 -24 l6 7 h5" ${stroke}/>
        <circle cx="72" cy="50" r="4.5" fill="${c}" opacity="0.7"/>
        <circle cx="84" cy="50" r="3" fill="${c}" opacity="0.4"/>
      `;
  }
}

/** One-colour mark, for chips and stencils sprayed onto a surface. */
export function callerSigil(id: PortraitId, size: number = 28, color?: string): string {
  return svgRoot(sigilBody(id, color ?? SKIN[id].key), '0 0 100 100', size);
}

/** Plate colours per survivor, keyed off their signature colour. */
const TOKEN: Record<PortraitId, PlateSkin & { motif: string }> = {
  SARGE:   { plate: '#a8552b', plateDark: '#6d3a20', rim: '#d9884f', motif: '#241207' },
  VASQUEZ: { plate: '#6f8a3c', plateDark: '#455726', rim: '#a3bd66', motif: '#15200a' },
  MAE:     { plate: '#c99a3c', plateDark: '#856225', rim: '#f0c874', motif: '#2a1e08' },
  ELI:     { plate: '#c6c2b0', plateDark: '#827f70', rim: '#efe9d6', motif: '#20201a' },
  QUIET:   { plate: '#8e2323', plateDark: '#511616', rim: '#c85a4a', motif: '#170707' },
  PLAYER:  { plate: '#b98b3c', plateDark: '#7a5620', rim: '#e6c176', motif: '#2b1f0d' }
};

/**
 * The same mark struck onto a plate, so a survivor's gate reads as one of the
 * set alongside the salvage and medical tokens rather than as a loose drawing.
 */
export function callerToken(id: PortraitId, size: number = 96): string {
  const t = TOKEN[id];
  const motif = `<g transform="translate(50 50) scale(0.68) translate(-50 -50)">${sigilBody(id, t.motif)}</g>`;
  return struckPlate(motif, t, size);
}
