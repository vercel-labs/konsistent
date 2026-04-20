import type { BaseAdapter, Connectable } from '@app/core';

export class CacheAdapter extends BaseAdapter implements Connectable {
  async get(key: string): Promise<string | null> {
    return null;
  }
}
