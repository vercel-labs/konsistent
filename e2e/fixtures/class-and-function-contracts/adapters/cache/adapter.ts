import type { BaseAdapter } from '@app/core';

export class CacheAdapter extends BaseAdapter {
  async get(key: string): Promise<string | null> {
    return null;
  }
}
