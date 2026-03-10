import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s before a re-fetch on re-focus
      gcTime: 6 * 60 * 60_000, // keep unused cache for 6 hours (align with persistence)
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
  maxAge: 6 * 60 * 60_000, // 6 hours
  buster: 'v1',
};
