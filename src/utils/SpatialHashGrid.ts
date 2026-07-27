import type * as THREE from 'three';

export interface ISpatialEntity {
  id: number;
  position: THREE.Vector3;
  active: boolean;
}

export class SpatialHashGrid<T extends ISpatialEntity> {
  private cellSize: number;
  private buckets: Map<number, T[]> = new Map();
  private queryResult: T[] = [];

  constructor(cellSize: number = 6.0) {
    this.cellSize = cellSize;
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

  public query(position: THREE.Vector3, radius: number): T[] {
    this.queryResult.length = 0; // Clear output buffer without new array allocation
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
              this.queryResult.push(cell[i]);
            }
          }
        }
      }
    }
    return this.queryResult;
  }
}
