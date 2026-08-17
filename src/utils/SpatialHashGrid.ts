import type * as THREE from 'three';

export interface ISpatialEntity {
  id: number;
  position: THREE.Vector3;
  active: boolean;
}

/** How many query results can be alive at once before one gets recycled. */
const QUERY_BUFFERS = 4;

export class SpatialHashGrid<T extends ISpatialEntity> {
  private cellSize: number;
  private buckets: Map<number, T[]> = new Map();

  /**
   * Query results are handed out from a small ring rather than one shared
   * array. A kill can start a chain — a corpse ruptures, which queries its
   * neighbours, and killing one of those ruptures again — and every one of
   * those queries used to overwrite the list the caller above it was still
   * walking, so a chain reaction quietly re-scanned whatever the innermost
   * blast happened to leave behind.
   */
  private queryBuffers: T[][] = [];
  private nextBuffer: number = 0;

  constructor(cellSize: number = 6.0) {
    this.cellSize = cellSize;
    for (let i = 0; i < QUERY_BUFFERS; i++) this.queryBuffers.push([]);
  }

  // Fast 3D integer hash - zero string allocation
  private getHash(x: number, y: number, z: number): number {
    const cx = Math.floor(x / this.cellSize) | 0;
    const cy = Math.floor(y / this.cellSize) | 0;
    const cz = Math.floor(z / this.cellSize) | 0;
    return (((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0);
  }

  public clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0; // Empty arrays without garbage collection
    }
  }

  public insert(entity: T): void {
    if (!entity.active) return;
    const hash = this.getHash(entity.position.x, entity.position.y, entity.position.z);
    let cell = this.buckets.get(hash);
    if (!cell) {
      cell = [];
      this.buckets.set(hash, cell);
    }
    cell.push(entity);
  }

  /**
   * Broad phase only: everything in the cells the sphere touches, which is
   * more than the sphere itself covers. Callers that treat the result as
   * "everything within radius" have to measure the distance themselves.
   *
   * Pass `into` to own the result outright. A caller that walks its list while
   * doing something that queries again — anything that can kill — should,
   * because the ring is only so deep.
   */
  public query(position: THREE.Vector3, radius: number, into?: T[]): T[] {
    let out: T[];
    if (into) {
      out = into;
    } else {
      out = this.queryBuffers[this.nextBuffer];
      this.nextBuffer = (this.nextBuffer + 1) % QUERY_BUFFERS;
    }
    out.length = 0;

    const minX = Math.floor((position.x - radius) / this.cellSize) | 0;
    const maxX = Math.floor((position.x + radius) / this.cellSize) | 0;
    const minY = Math.floor((position.y - radius) / this.cellSize) | 0;
    const maxY = Math.floor((position.y + radius) / this.cellSize) | 0;
    const minZ = Math.floor((position.z - radius) / this.cellSize) | 0;
    const maxZ = Math.floor((position.z + radius) / this.cellSize) | 0;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const hash = (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0);
          const cell = this.buckets.get(hash);
          if (cell) {
            for (let i = 0; i < cell.length; i++) {
              out.push(cell[i]);
            }
          }
        }
      }
    }
    return out;
  }
}
