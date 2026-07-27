export interface IPoolable {
  active: boolean;
  reset(...args: any[]): void;
}

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  public activeItems: T[] = [];
  private factory: () => T;

  constructor(factory: () => T, initialSize: number = 30) {
    this.factory = factory;
    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.active = false;
      this.pool.push(item);
    }
  }

  public get(...args: any[]): T {
    let item = this.pool.find(i => !i.active);
    if (!item) {
      item = this.factory();
      this.pool.push(item);
    }
    item.reset(...args);
    item.active = true;
    if (!this.activeItems.includes(item)) {
      this.activeItems.push(item);
    }
    return item;
  }

  public release(item: T): void {
    item.active = false;
    const idx = this.activeItems.indexOf(item);
    if (idx !== -1) {
      // Fast swap and pop to remove in O(1) without array re-allocation
      const last = this.activeItems.pop()!;
      if (idx < this.activeItems.length) {
        this.activeItems[idx] = last;
      }
    }
  }

  public getActiveItems(): T[] {
    // Synchronize active list in O(N) swap to ensure clean state
    for (let i = this.activeItems.length - 1; i >= 0; i--) {
      if (!this.activeItems[i].active) {
        const last = this.activeItems.pop()!;
        if (i < this.activeItems.length) {
          this.activeItems[i] = last;
        }
      }
    }
    return this.activeItems;
  }

  public releaseAll(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
    this.activeItems.length = 0;
  }
}
