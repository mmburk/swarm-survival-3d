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

  public get(...args: any[]): T {
    let item: T | undefined = this.pool.find(i => !i.active);

    if (!item) {
      if (this.pool.length < this.maxCap) {
        item = this.factory();
        this.pool.push(item);
      } else {
        // Reuse oldest active instance or dynamically instantiate fallback to prevent null returns
        item = this.pool.find(i => i.active) || this.factory();
        item.active = false;
        if (!this.pool.includes(item)) {
          this.pool.push(item);
        }
      }
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

  public getActiveItems(): T[] {
    const activeList: T[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i] && this.pool[i].active) {
        activeList.push(this.pool[i]);
      }
    }
    return activeList;
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
  }
}
