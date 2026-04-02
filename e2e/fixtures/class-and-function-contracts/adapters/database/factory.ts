import type { DatabaseAdapterConfig } from './types';
import type { DatabaseAdapter } from './adapter';

export function createDatabaseAdapter(config: DatabaseAdapterConfig): DatabaseAdapter {
  throw new Error('Not implemented');
}
