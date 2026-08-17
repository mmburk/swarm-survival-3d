import type { PortraitId } from './Portraits';

import eli from '../../assets/portraits/eli.webp';
import mae from '../../assets/portraits/mae.webp';
import player from '../../assets/portraits/player.webp';
import quiet from '../../assets/portraits/quiet.webp';
import sarge from '../../assets/portraits/sarge.webp';
import vasquez from '../../assets/portraits/vasquez.webp';

/**
 * THE PAINTED CAST.
 *
 * Six pieces of key art, one per face the game names. They are imported rather
 * than pointed at by path so the build fails loudly if one goes missing, and so
 * each ships with a content hash in its filename — a portrait that changes gets
 * a new URL, and a portrait that does not stays in the browser's cache.
 *
 * Each file is cropped to 5:6 and stored at 480x576, which is roughly three
 * times the largest box any of them is ever drawn into (138px in the roster).
 * That is enough for a high-density display and no more; the whole cast is
 * about 150KB, against 15MB for the artwork as it was delivered.
 */
export const PORTRAIT_SRC: Record<PortraitId, string> = {
  SARGE: sarge,
  VASQUEZ: vasquez,
  MAE: mae,
  ELI: eli,
  QUIET: quiet,
  PLAYER: player
};
