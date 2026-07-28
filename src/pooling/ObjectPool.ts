export interface IPoolable {
  active: boolean;
  reset(...args: any[]): void;
}

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  private factory: () => T;
  private maxCap: number;

  constructor(factory: () => T, initialSize: number = 50, maxCap: number = 400) {
    this.factory = factory;
    this.maxCap = maxCap;
    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.active = false;
      this.pool.push(item);
    }
  }

  public get(...args: any[]): T | null {
    let item: T | undefined = this.pool.find(i => !i.active);

    if (!item) {
      if (this.pool.length < this.maxCap) {
        item = this.factory();
        this.pool.push(item);
      } else {
        // FIFO Recycling if max pool capacity is reached
        item = this.pool[0];
        item.active = false;
      }
    }

    if (!item) return null;

    item.active = true;
    try {
      item.reset(...args);
    } catch (err) {
      console.error('Error in pool item reset:', err);
    }
    return item;
  }

  public release(item: T): void {
    item.active = false;
  }

  public getActiveItems(): T[] {
    const activeList: T[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        activeList.push(this.pool[i]);
      }
    }
    return activeList;
  }

  public releaseAll(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}
