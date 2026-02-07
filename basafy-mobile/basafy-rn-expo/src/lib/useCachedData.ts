/**
 * React hook for cached data fetching
 * Provides automatic caching with loading states and error handling
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithCache, CacheConfig, removeCache, isOnline } from './cache';

export interface UseCachedDataOptions<T> extends CacheConfig {
    /** Whether to fetch immediately on mount (default: true) */
    immediate?: boolean;
    /** Transform the fetched data before caching/returning */
    transform?: (data: T) => T;
    /** Callback when data is successfully fetched */
    onSuccess?: (data: T, source: 'cache' | 'network' | 'stale') => void;
    /** Callback when fetch fails */
    onError?: (error: Error) => void;
    /** Dependencies that trigger refetch when changed */
    deps?: unknown[];
}

export interface UseCachedDataResult<T> {
    /** The cached/fetched data */
    data: T | null;
    /** Loading state for initial fetch */
    loading: boolean;
    /** Error if fetch failed */
    error: Error | null;
    /** Whether the current data is from stale cache */
    isStale: boolean;
    /** Whether the device is currently online */
    isOnline: boolean;
    /** Data source: 'cache', 'network', or 'stale' */
    source: 'cache' | 'network' | 'stale' | null;
    /** Manually refresh the data */
    refresh: () => Promise<void>;
    /** Invalidate the cache and refetch */
    invalidate: () => Promise<void>;
    /** Whether a refresh is in progress */
    refreshing: boolean;
}

/**
 * Hook for fetching data with automatic caching
 * 
 * @example
 * ```tsx
 * const { data, loading, error, refresh, isStale } = useCachedData(
 *   'applications:user123',
 *   async () => {
 *     const { data } = await supabase.from('applications').select('*');
 *     return data;
 *   },
 *   { maxAge: 5 * 60 * 1000 }
 * );
 * ```
 */
export function useCachedData<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    options: UseCachedDataOptions<T> = {}
): UseCachedDataResult<T> {
    const {
        immediate = true,
        transform,
        onSuccess,
        onError,
        deps = [],
        ...cacheConfig
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(immediate);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [online, setOnline] = useState(true);
    const [source, setSource] = useState<'cache' | 'network' | 'stale' | null>(null);

    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);

    // Check online status
    useEffect(() => {
        let mounted = true;

        const checkOnline = async () => {
            const status = await isOnline();
            if (mounted) setOnline(status);
        };

        checkOnline();

        // Check periodically
        const interval = setInterval(checkOnline, 30000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (fetchingRef.current && !isRefresh) return;

        fetchingRef.current = true;

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const result = await fetchWithCache(
                cacheKey,
                async () => {
                    const fetchedData = await fetcher();
                    return transform ? transform(fetchedData) : fetchedData;
                },
                cacheConfig
            );

            if (!mountedRef.current) return;

            if (result.error && !result.data) {
                setError(result.error);
                onError?.(result.error);
            } else {
                setData(result.data);
                setIsStale(result.isStale ?? false);
                setSource(result.source);
                if (result.data) {
                    onSuccess?.(result.data, result.source);
                }
            }
        } catch (err) {
            if (!mountedRef.current) return;
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onError?.(error);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
                fetchingRef.current = false;
            }
        }
    }, [cacheKey, fetcher, transform, onSuccess, onError, ...Object.values(cacheConfig)]);

    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    const invalidate = useCallback(async () => {
        await removeCache(cacheKey);
        await fetchData(true);
    }, [cacheKey, fetchData]);

    // Initial fetch
    useEffect(() => {
        mountedRef.current = true;

        if (immediate) {
            fetchData();
        }

        return () => {
            mountedRef.current = false;
        };
    }, [cacheKey, ...deps]);

    return {
        data,
        loading,
        error,
        isStale,
        isOnline: online,
        source,
        refresh,
        invalidate,
        refreshing,
    };
}

/**
 * Hook for prefetching data into cache without rendering
 */
export function usePrefetch() {
    const prefetch = useCallback(async <T>(
        cacheKey: string,
        fetcher: () => Promise<T>,
        config?: CacheConfig
    ) => {
        try {
            await fetchWithCache(cacheKey, fetcher, config);
        } catch (error) {
            console.warn('[Prefetch] Failed:', cacheKey, error);
        }
    }, []);

    return { prefetch };
}

export default useCachedData;
