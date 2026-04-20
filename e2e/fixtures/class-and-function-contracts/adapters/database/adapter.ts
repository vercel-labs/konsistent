import type { BaseAdapter, Connectable } from '@app/core';

export class DatabaseAdapter extends BaseAdapter implements Connectable {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
