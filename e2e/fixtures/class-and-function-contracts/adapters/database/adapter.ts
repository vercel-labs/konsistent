import type { BaseAdapter } from '@app/core';

export class DatabaseAdapter extends BaseAdapter {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
