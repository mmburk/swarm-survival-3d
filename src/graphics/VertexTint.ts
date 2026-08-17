import * as THREE from 'three';

/**
 * Paints a flat colour into a geometry's vertex-colour attribute.
 *
 * This is what lets a pile of small boxes in different colours become one mesh
 * and one draw call: the colour that used to live on a material per box gets
 * baked into the vertices instead, and a single vertex-coloured material draws
 * the lot. It only works across parts that want the same surface — the same
 * roughness and metalness — since those stay on the material.
 */
export function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
