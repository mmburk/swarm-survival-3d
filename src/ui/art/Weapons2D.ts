import { INK, INK_SOFT, RIM, celGradient, grainFilter } from './Ink';
import type { WeaponId } from '../../config/Weapons';

/**
 * THE RACK.
 *
 * Every firearm gets a painted side elevation, the way a weapon would be drawn
 * on a workshop card: flat colour, one hard shadow, ink outline, no perspective
 * and no gloss. Locked weapons render as pure silhouette — you can see the shape
 * of what you have not earned, which is the whole point of a rack.
 */

const WOOD = '#6b4a2a';
const WOOD_DARK = '#472f1a';
const STEEL = '#5a5f55';
const STEEL_DARK = '#3a3e36';
const STEEL_LIGHT = '#7e8479';
const POLY = '#3b3f33';
const POLY_DARK = '#272a21';
const TAPE = '#6d6a58';

const VIEW_W = 340;
const VIEW_H = 132;

/** Standard body: heavy outline, flat fill. */
function part(d: string, fill: string, w = 3.4): string {
  return `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>`;
}

function box(x: number, y: number, w: number, h: number, fill: string, r = 0, sw = 3.4): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>`;
}

/** The single warm highlight running along the top of every piece of metal. */
function shine(d: string, opacity = 0.55): string {
  return `<path d="${d}" fill="none" stroke="${RIM}" stroke-width="2.6" stroke-linecap="round" opacity="${opacity}"/>`;
}

// ------------------------------------------------------------------ the guns

function ranger(): string {
  return `
    ${part('M12 48 L46 42 L58 62 L54 86 L20 80 Z', WOOD)}
    ${part('M12 48 L46 42 L48 52 L16 60 Z', '#8a6237')}
    ${part('M50 54 h34 v26 h-34 Z', WOOD_DARK)}
    ${box(80, 44, 84, 32, STEEL, 2)}
    ${part('M80 60 h84 v16 h-84 Z', STEEL_DARK, 0)}
    ${part('M96 76 l6 34 h24 l4 -34 Z', STEEL_DARK)}
    ${part('M86 76 h22 l-6 32 h-20 Z', POLY)}
    ${box(164, 54, 128, 12, STEEL_DARK, 1)}
    ${box(160, 46, 56, 22, STEEL, 2)}
    <path d="M170 52 v10 M180 52 v10 M190 52 v10 M200 52 v10" stroke="${INK}" stroke-width="2.6"/>
    ${box(284, 48, 14, 24, STEEL, 2)}
    ${box(112, 20, 72, 18, POLY, 9)}
    ${part('M124 38 h10 v8 h-10 Z', POLY_DARK)}
    ${part('M164 38 h10 v8 h-10 Z', POLY_DARK)}
    ${box(206, 70, 56, 22, STEEL_DARK, 4)}
    <circle cx="258" cy="81" r="6" fill="${INK}"/>
    ${shine('M84 47 h76')}
    ${shine('M166 57 h114', 0.4)}
    ${shine('M118 24 h58', 0.5)}
  `;
}

function boomstick(): string {
  return `
    ${part('M18 46 L58 40 L70 58 L64 92 L26 86 Z', WOOD)}
    ${part('M18 46 L58 40 L60 50 L22 58 Z', '#8a6237')}
    ${part('M64 52 h26 v30 h-26 Z', WOOD_DARK)}
    ${box(88, 42, 62, 40, STEEL, 3)}
    ${part('M100 82 l4 26 h22 l2 -26 Z', WOOD_DARK)}
    ${box(150, 44, 108, 16, STEEL_DARK, 2)}
    ${box(150, 62, 108, 16, STEEL_DARK, 2)}
    ${box(252, 40, 16, 42, STEEL, 2)}
    <circle cx="260" cy="52" r="5" fill="${INK}"/>
    <circle cx="260" cy="70" r="5" fill="${INK}"/>
    ${part('M96 42 l-4 -16 h12 l-2 16 Z', STEEL_LIGHT)}
    ${part('M116 42 l-4 -16 h12 l-2 16 Z', STEEL_LIGHT)}
    ${part('M140 78 h22 l-4 18 h-16 Z', WOOD_DARK)}
    <path d="M158 92 h18 M158 100 h18" stroke="${TAPE}" stroke-width="5" stroke-linecap="round"/>
    ${shine('M92 45 h54')}
    ${shine('M154 47 h96', 0.42)}
  `;
}

function widowmaker(): string {
  return `
    ${part('M8 52 L44 44 L62 62 L58 96 L18 88 Z', WOOD)}
    ${part('M8 52 L44 44 L46 54 L12 64 Z', '#8a6237')}
    ${part('M58 56 h40 v34 h-40 Z', WOOD)}
    ${part('M58 56 h40 v10 h-40 Z', WOOD_DARK)}
    ${box(96, 48, 72, 28, STEEL, 2)}
    ${part('M118 48 l-8 -20 h10 l6 20 Z', STEEL_LIGHT)}
    <circle cx="115" cy="28" r="6.5" fill="${STEEL_LIGHT}" stroke="${INK}" stroke-width="3"/>
    ${part('M126 76 l4 22 h20 l2 -22 Z', STEEL_DARK)}
    ${part('M98 76 h20 l-6 28 h-18 Z', WOOD_DARK)}
    ${box(168, 56, 156, 10, STEEL_DARK, 1)}
    ${box(316, 50, 12, 22, STEEL, 2)}
    ${box(112, 18, 96, 16, POLY, 8)}
    ${part('M124 34 h10 v10 h-10 Z', POLY_DARK)}
    ${part('M186 34 h10 v10 h-10 Z', POLY_DARK)}
    <circle cx="118" cy="26" r="5" fill="${INK_SOFT}"/>
    ${part('M168 90 q40 20 84 6', 'none', 4)}
    ${shine('M100 51 h64')}
    ${shine('M172 58 h140', 0.35)}
    ${shine('M118 21 h82', 0.5)}
  `;
}

function stutter(): string {
  return `
    ${box(70, 40, 118, 40, POLY, 2)}
    ${part('M70 62 h118 v18 h-118 Z', POLY_DARK, 0)}
    ${part('M92 80 h26 l-8 34 h-24 Z', POLY)}
    ${part('M126 80 h22 l6 46 h-22 Z', STEEL_DARK)}
    <path d="M132 92 h14 M133 104 h14 M134 116 h14" stroke="${INK}" stroke-width="2.6"/>
    ${box(188, 48, 74, 16, STEEL_DARK, 1)}
    ${box(256, 42, 12, 28, STEEL, 2)}
    ${part('M180 34 h34 v12 h-34 Z', STEEL, 3)}
    <path d="M186 34 v-8 M196 34 v-8 M206 34 v-8" stroke="${INK}" stroke-width="3"/>
    ${part('M70 44 L26 30 L20 44 L58 62 Z', STEEL_DARK)}
    ${part('M26 30 L20 44 L34 50 L40 34 Z', STEEL)}
    <path d="M84 36 h30 M84 46 h30" stroke="${TAPE}" stroke-width="6" stroke-linecap="round"/>
    <path d="M148 82 h16 M150 92 h16" stroke="${TAPE}" stroke-width="5" stroke-linecap="round"/>
    ${part('M60 34 h16 v10 h-16 Z', STEEL_LIGHT)}
    ${shine('M74 43 h108', 0.45)}
    ${shine('M192 50 h62', 0.35)}
  `;
}

function harvester(): string {
  return `
    ${box(16, 34, 56, 62, STEEL, 10)}
    ${part('M16 66 h56 v30 a10 10 0 0 1 -10 10 h-36 a10 10 0 0 1 -10 -10 Z', STEEL_DARK, 0)}
    ${box(34, 22, 20, 14, STEEL_DARK, 3)}
    <circle cx="44" cy="24" r="7" fill="${STEEL_LIGHT}" stroke="${INK}" stroke-width="3"/>
    ${part('M72 52 q34 -18 56 4', 'none', 5)}
    ${box(120, 44, 96, 36, POLY, 3)}
    ${part('M120 64 h96 v16 h-96 Z', POLY_DARK, 0)}
    ${part('M134 80 h24 l-6 32 h-24 Z', POLY)}
    ${part('M168 40 h44 v-16 h-44 Z', STEEL_DARK)}
    <path d="M176 24 v16 M186 24 v16 M196 24 v16 M206 24 v16" stroke="${INK}" stroke-width="2.6"/>
    ${box(216, 54, 92, 14, STEEL_DARK, 1)}
    ${box(300, 48, 12, 26, STEEL, 2)}
    ${part('M216 68 h34 v14 h-34 Z', STEEL)}
    <circle cx="44" cy="70" r="9" fill="${INK}" opacity="0.55"/>
    <path d="M36 78 h16" stroke="${RIM}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    ${shine('M22 40 q6 -4 14 -4', 0.6)}
    ${shine('M124 47 h88', 0.45)}
    ${shine('M220 56 h80', 0.3)}
  `;
}

const PLATES: Record<WeaponId, () => string> = {
  RANGER: ranger,
  BOOMSTICK: boomstick,
  WIDOWMAKER: widowmaker,
  STUTTER: stutter,
  HARVESTER: harvester
};

/**
 * The painted elevation. `locked` blacks the whole thing out to a silhouette
 * with a punched keyhole, which is how the rack shows you what you cannot take.
 */
export function weaponPlate(id: WeaponId, width: number = 320, locked: boolean = false): string {
  const height = Math.round((width * VIEW_H) / VIEW_W);
  const uid = `wp-${id}${locked ? '-l' : ''}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${width}" height="${height}" style="display:block; width:100%; max-width:${width}px; height:auto;">
    <defs>
      ${grainFilter(`${uid}-grain`, id.length + 11, 0.3)}
      ${celGradient(`${uid}-shelf`, '#33372a', '#1c1f16', 90)}
      ${locked ? `<filter id="${uid}-flat"><feColorMatrix type="matrix" values="0 0 0 0 0.055  0 0 0 0 0.05 0 0 0 0 0.03  0 0 0 1 0"/></filter>` : ''}
    </defs>

    <!-- the rack itself: two pegs and the shadow the gun throws on the board -->
    <rect x="0" y="112" width="${VIEW_W}" height="6" fill="url(#${uid}-shelf)" opacity="0.75"/>
    <ellipse cx="170" cy="116" rx="128" ry="7" fill="${INK}" opacity="0.4"/>
    <path d="M62 8 v14 M272 8 v14" stroke="${INK_SOFT}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>

    <g ${locked ? `filter="url(#${uid}-flat)" opacity="0.85"` : ''}>
      <g filter="url(#${uid}-grain)">${PLATES[id]()}</g>
    </g>
    ${locked ? `
      <circle cx="170" cy="64" r="26" fill="#0f110b" stroke="${RIM}" stroke-width="4" opacity="0.9"/>
      <path d="M170 50 a9 9 0 0 1 9 9 v4 h-6 v-4 a3 3 0 0 0 -6 0 v4 h-6 v-4 a9 9 0 0 1 9 -9 Z"
            fill="${RIM}" opacity="0.95"/>
      <rect x="156" y="63" width="28" height="20" rx="3" fill="${RIM}" opacity="0.95"/>
      <circle cx="170" cy="72" r="3.4" fill="#0f110b"/>
    ` : ''}
  </svg>`;
}

/** Small silhouette for the list column — shape only, no interior detail. */
export function weaponThumb(id: WeaponId, width: number = 92, tint: string = INK): string {
  const height = Math.round((width * VIEW_H) / VIEW_W);
  const uid = `wt-${id}-${tint.replace('#', '')}`;
  const r = parseInt(tint.slice(1, 3), 16) / 255;
  const g = parseInt(tint.slice(3, 5), 16) / 255;
  const b = parseInt(tint.slice(5, 7), 16) / 255;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${width}" height="${height}" style="display:block;">
    <defs>
      <filter id="${uid}">
        <feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(3)}  0 0 0 0 ${g.toFixed(3)}  0 0 0 0 ${b.toFixed(3)}  0 0 0 1 0"/>
      </filter>
    </defs>
    <g filter="url(#${uid})">${PLATES[id]()}</g>
  </svg>`;
}
