import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys that must never be served from stale persisted cache (dates, real-time data)
const NEVER_PERSIST_KEYS = ['applications', 'pipeline'];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 6 * 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'basafy:react-query-cache',
  throttleTime: 1000,
});

export const queryPersistOptions: PersistQueryClientOptions = {
  queryClient,
  persister: queryPersister,
  maxAge: 6 * 60 * 60_000,
  buster: 'v3',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      const rootKey = query.queryKey[0];
      return !NEVER_PERSIST_KEYS.includes(rootKey as string);
    },
  },
};

const CACHE_BUST_VERSION = 'v3';
const CACHE_BUST_KEY = 'basafy:cache-busted';

/**
 * Clears the persisted React Query cache once per CACHE_BUST_VERSION.
 * Must be awaited before PersistQueryClientProvider renders to avoid
 * stale data being hydrated before the clear completes.
 */
export async function clearStaleDateCache() {
  try {
    const busted = await AsyncStorage.getItem(CACHE_BUST_KEY);
    if (busted !== CACHE_BUST_VERSION) {
      await AsyncStorage.removeItem('basafy:react-query-cache');
      await AsyncStorage.setItem(CACHE_BUST_KEY, CACHE_BUST_VERSION);
    }
  } catch {
    // ignore
  }
}
