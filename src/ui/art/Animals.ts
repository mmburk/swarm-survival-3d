import { svgRoot } from './Ink';
import type { AnimalId } from '../../config/Animals';

/**
 * THE PEN MARKS.
 *
 * One flat silhouette per animal, drawn side-on the way a stock sign or a
 * butcher's chart is drawn, because that is the only register in which seven
 * different animals read as one set. No outlines, no shading, no eyes — the
 * whole job is the shape at 60 pixels wide, sat in a row on the pens card.
 *
 * They are also the reason the roster can be told apart at a glance in a game
 * where every model is the same eight browns: a magpie tail and a pair of horns
 * are legible where a coat colour is not.
 */

function dog(c: string): string {
  return `
    <g fill="${c}">
      <rect x="27" y="41" width="45" height="18" rx="7"/>
      <rect x="30" y="56" width="7" height="24" rx="3"/>
      <rect x="41" y="56" width="7" height="24" rx="3"/>
      <rect x="55" y="56" width="7" height="24" rx="3"/>
      <rect x="65" y="56" width="7" height="24" rx="3"/>
      <path d="M30 40 L16 38 L9 45 L11 53 L30 57 Z"/>
      <path d="M19 37 L17 24 L27 32 Z"/>
      <path d="M71 43 L88 27 L92 33 L78 51 Z"/>
    </g>
  `;
}

function cat(c: string): string {
  return `
    <g fill="${c}">
      <rect x="30" y="47" width="38" height="15" rx="7"/>
      <rect x="33" y="59" width="6" height="21" rx="3"/>
      <rect x="42" y="59" width="6" height="21" rx="3"/>
      <rect x="53" y="59" width="6" height="21" rx="3"/>
      <rect x="61" y="59" width="6" height="21" rx="3"/>
      <circle cx="26" cy="47" r="10"/>
      <path d="M18 41 L16 30 L26 37 Z"/>
      <path d="M30 38 L34 28 L37 40 Z"/>
      <path d="M67 52 C 82 52, 86 40, 80 24 L 74 26 C 79 40, 76 46, 67 45 Z"/>
    </g>
  `;
}

function magpie(c: string): string {
  return `
    <g fill="${c}">
      <ellipse cx="42" cy="45" rx="16" ry="13"/>
      <circle cx="27" cy="35" r="9"/>
      <path d="M19 34 L6 37 L19 41 Z"/>
      <path d="M54 50 L88 76 L92 68 L60 42 Z"/>
      <path d="M40 36 L64 26 L60 44 Z"/>
      <rect x="38" y="56" width="4" height="14" rx="2"/>
      <rect x="47" y="56" width="4" height="14" rx="2"/>
    </g>
  `;
}

function hawk(c: string): string {
  return `
    <g fill="${c}">
      <ellipse cx="50" cy="52" rx="13" ry="17"/>
      <circle cx="50" cy="31" r="10"/>
      <path d="M50 24 L58 20 L52 34 Z"/>
      <path d="M39 44 C 22 30, 10 30, 4 40 C 18 42, 30 52, 38 60 Z"/>
      <path d="M61 44 C 78 30, 90 30, 96 40 C 82 42, 70 52, 62 60 Z"/>
      <path d="M44 66 L56 66 L58 84 L42 84 Z"/>
    </g>
  `;
}

function goat(c: string): string {
  return `
    <g fill="${c}">
      <rect x="30" y="40" width="42" height="20" rx="6"/>
      <rect x="33" y="57" width="7" height="24" rx="3"/>
      <rect x="43" y="57" width="7" height="24" rx="3"/>
      <rect x="57" y="57" width="7" height="24" rx="3"/>
      <rect x="66" y="57" width="7" height="24" rx="3"/>
      <path d="M32 38 L17 36 L10 44 L13 53 L32 55 Z"/>
      <path d="M13 52 L11 66 L18 60 Z"/>
      <path d="M22 33 C 22 20, 34 14, 40 20 C 32 22, 27 27, 26 34 Z"/>
      <path d="M28 34 C 29 22, 40 17, 45 23 C 37 24, 33 29, 32 35 Z"/>
      <path d="M71 41 L79 33 L83 38 L75 47 Z"/>
    </g>
  `;
}

function boar(c: string): string {
  return `
    <g fill="${c}">
      <path d="M32 56 C 32 38, 44 32, 56 33 C 70 34, 76 42, 76 56 Z"/>
      <rect x="35" y="54" width="8" height="24" rx="3"/>
      <rect x="47" y="54" width="8" height="24" rx="3"/>
      <rect x="60" y="54" width="8" height="24" rx="3"/>
      <rect x="68" y="54" width="8" height="24" rx="3"/>
      <path d="M34 40 L16 46 L10 58 L20 62 L34 58 Z"/>
      <path d="M14 55 C 8 52, 6 45, 10 42 C 10 48, 13 51, 17 52 Z"/>
      <path d="M22 42 L20 32 L29 38 Z"/>
      <path d="M40 30 L44 22 L48 30 L52 23 L56 31 L60 25 L63 33 Z"/>
      <path d="M76 46 L86 42 L88 47 L78 53 Z"/>
    </g>
  `;
}

function bear(c: string): string {
  return `
    <g fill="${c}">
      <rect x="26" y="34" width="50" height="30" rx="13"/>
      <rect x="30" y="60" width="12" height="22" rx="5"/>
      <rect x="45" y="60" width="12" height="22" rx="5"/>
      <rect x="61" y="60" width="12" height="22" rx="5"/>
      <circle cx="24" cy="38" r="13"/>
      <circle cx="16" cy="26" r="6"/>
      <circle cx="33" cy="25" r="6"/>
      <path d="M12 40 L4 44 L6 50 L16 48 Z"/>
      <circle cx="77" cy="45" r="5"/>
    </g>
  `;
}

const MARKS: Record<AnimalId, (c: string) => string> = {
  ROOK: dog,
  MOUSER: cat,
  SIXPENCE: magpie,
  NAN: goat,
  KITE: hawk,
  BRISTLE: boar,
  HONEY: bear
};

/** One-colour stock mark, for the pens card and the HUD plate. */
export function animalMark(id: AnimalId, size: number = 48, colour: string = '#ddd6c2'): string {
  return svgRoot(MARKS[id](colour), '0 0 100 100', size);
}
