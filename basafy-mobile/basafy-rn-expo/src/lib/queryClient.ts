import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s before a re-fetch on re-focus
      gcTime: 5 * 60_000,      // keep unused cache for 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
