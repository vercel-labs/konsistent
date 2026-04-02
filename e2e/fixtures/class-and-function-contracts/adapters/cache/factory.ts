import type { CacheAdapterConfig } from './types';
import type { CacheAdapter } from './adapter';

export function createCacheAdapter(config: CacheAdapterConfig): CacheAdapter {
  throw new Error('Not implemented');
}
