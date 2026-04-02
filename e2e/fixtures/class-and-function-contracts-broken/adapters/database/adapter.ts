import type { BaseAdapter } from '@app/core';

export class DatabaseAdapter extends WrongBase {
  async connect(): Promise<void> {}
}
