export interface IPoolable {
  active: boolean;
  reset(...args: any[]): void;
}

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  private factory: () => T;
  private maxCap: number;

  /**
   * Where the last search for a free slot finished. Freed slots tend to be
   * adjacent to the one just taken, so starting from here makes `get` an O(1)
   * step in the common case instead of a scan from zero every time.
   */
  private cursor: number = 0;

  /**
   * The buffer `getActiveItems` fills. Handing back the same array every call
   * is what keeps a frame free of garbage — a hundred bullets and six hundred
   * particles were being copied into fresh arrays eight times a frame — but it
   * means a caller only owns the result until the next call on the same pool.
   * Nothing holds two live lists from one pool; check that before adding one.
   */
  private activeBuffer: T[] = [];

  constructor(factory: () => T, initialSize: number = 50, maxCap: number = 400) {
    this.factory = factory;
    this.maxCap = maxCap;
    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.active = false;
      this.pool.push(item);
    }
  }

  /** First free slot at or after the cursor, wrapping once. -1 if all taken. */
  private findFree(): number {
    const n = this.pool.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      if (!this.pool[idx].active) return idx;
    }
    return -1;
  }

  public get(...args: any[]): T {
    let item: T | undefined;

    const free = this.pool.length > 0 ? this.findFree() : -1;
    if (free >= 0) {
      item = this.pool[free];
      this.cursor = free + 1;
    } else if (this.pool.length < this.maxCap) {
      item = this.factory();
      this.pool.push(item);
      this.cursor = this.pool.length;
    } else {
      // Full and capped: steal the oldest slot rather than return nothing.
      item = this.pool[this.cursor % this.pool.length];
      this.cursor++;
    }

    item.active = true;
    try {
      item.reset(...args);
    } catch (err) {
      console.error('Error in pool item reset:', err);
    }
    return item;
  }

  public release(item: T): void {
    if (item) {
      item.active = false;
    }
  }

  /**
   * The live items, in a buffer owned by the pool. Valid until the next call
   * to `getActiveItems` on this same pool — copy it if you need to keep it.
   */
  public getActiveItems(): T[] {
    const out = this.activeBuffer;
    out.length = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (item && item.active) out.push(item);
    }
    return out;
  }

  public recycleAllActive(onRecycle?: (item: T) => void): void {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (item && item.active) {
        if (onRecycle) {
          try {
            onRecycle(item);
          } catch (err) {
            console.error('Error during pool recycling callback:', err);
          }
        }
        item.active = false;
      }
    }
    this.cursor = 0;
  }
}
