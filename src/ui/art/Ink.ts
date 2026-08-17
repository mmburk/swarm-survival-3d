/**
 * Shared plumbing for the hand-inked 2D art.
 *
 * Everything drawn for the UI — reward emblems, survivor portraits, weapon
 * plates — is authored once as an SVG string and consumed in two places: inline
 * in the DOM (menus, cards, HUD) and rasterised onto a canvas for the in-world
 * signage textures. One source of art, two surfaces.
 *
 * The look is Hades' form language read through this game's palette: heavy warm
 * black outlines, flat cel fills with a single shadow tone, one warm rim light,
 * and a stamped/painted feel rather than anything that glows.
 */

/** Outline weights. Nothing in this art is thin — the ink is the design. */
export const INK = '#120e08';
export const INK_SOFT = '#241c11';
/** The one warm light every piece is lit by, so the set reads as a set. */
export const RIM = '#e0b063';

const imageCache = new Map<string, HTMLImageElement>();

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Rasterises an SVG string, caching by source so repeat draws (a gate sign
 * repainted every sector) never hit the decoder twice.
 */
export function svgImage(svg: string, onReady?: (img: HTMLImageElement) => void): HTMLImageElement {
  const cached = imageCache.get(svg);
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0) onReady?.(cached);
    else cached.addEventListener('load', () => onReady?.(cached), { once: true });
    return cached;
  }

  const img = new Image();
  img.addEventListener('load', () => onReady?.(img), { once: true });
  img.src = svgDataUrl(svg);
  imageCache.set(svg, img);
  return img;
}

/** Draws an SVG onto a 2D context, repainting once the raster is ready. */
export function drawSvg(
  ctx: CanvasRenderingContext2D,
  svg: string,
  x: number,
  y: number,
  w: number,
  h: number,
  onPainted?: () => void
): void {
  const img = svgImage(svg, (ready) => {
    ctx.drawImage(ready, x, y, w, h);
    onPainted?.();
  });
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
    onPainted?.();
  }
}

/** Wraps a body in an <svg> root at the given pixel size. */
export function svgRoot(body: string, viewBox: string, size: number, extraStyle = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}" style="display:block;${extraStyle}">${body}</svg>`;
}

/**
 * Torn-paper / scorched-edge noise, laid over whatever it is applied to.
 * Deterministic per seed so a given card looks the same every time it opens.
 *
 * The noise is composited *into* the source's alpha before it is blended back,
 * otherwise the filter hands back an opaque rectangle and every piece of art
 * ends up sitting in a grey box.
 */
export function grainFilter(id: string, seed: number, strength = 0.55): string {
  return `
    <filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0" result="g"/>
      <feComponentTransfer in="g" result="g2">
        <feFuncA type="linear" slope="${strength}" intercept="0"/>
      </feComponentTransfer>
      <feComposite in="g2" in2="SourceGraphic" operator="in" result="masked"/>
      <feBlend in="SourceGraphic" in2="masked" mode="multiply"/>
    </filter>
  `;
}

/** Two-stop flat gradient — cel shading, not a glow. */
export function celGradient(id: string, light: string, dark: string, angle = 90): string {
  const rad = (angle * Math.PI) / 180;
  const x2 = (Math.cos(rad) * 0.5 + 0.5).toFixed(3);
  const y2 = (Math.sin(rad) * 0.5 + 0.5).toFixed(3);
  return `
    <linearGradient id="${id}" x1="${(1 - +x2).toFixed(3)}" y1="${(1 - +y2).toFixed(3)}" x2="${x2}" y2="${y2}">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.52" stop-color="${light}"/>
      <stop offset="0.521" stop-color="${dark}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  `;
}
