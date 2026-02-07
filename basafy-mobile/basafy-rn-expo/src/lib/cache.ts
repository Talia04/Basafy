/**
 * Offline caching utility for React Native
 * Provides transparent caching for API data with stale-while-revalidate pattern
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = '@basafy_cache:';
const CACHE_METADATA_KEY = '@basafy_cache_metadata';

export interface CacheConfig {
    /** Time in milliseconds before cache is considered stale (default: 5 minutes) */
    maxAge?: number;
    /** Time in milliseconds before cache is completely invalidated (default: 24 hours) */
    staleAge?: number;
    /** Whether to return stale data while revalidating (default: true) */
    staleWhileRevalidate?: boolean;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    key: string;
}

interface CacheMetadata {
    keys: string[];
    totalSize: number;
    lastCleanup: number;
}

const DEFAULT_CONFIG: Required<CacheConfig> = {
    maxAge: 5 * 60 * 1000, // 5 minutes
    staleAge: 24 * 60 * 60 * 1000, // 24 hours
    staleWhileRevalidate: true,
};

/**
 * Check if the device is online
 */
export async function isOnline(): Promise<boolean> {
    try {
        const state = await NetInfo.fetch();
        return state.isConnected ?? false;
    } catch {
        return true; // Assume online if we can't check
    }
}

/**
 * Generate a cache key from the given identifier
 */
function getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
}

/**
 * Get cached data
 */
export async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
        const cacheKey = getCacheKey(key);
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) return null;
        return JSON.parse(cached) as CacheEntry<T>;
    } catch (error) {
        console.warn('[Cache] Failed to read cache:', key, error);
        return null;
    }
}

/**
 * Set cached data
 */
export async function setCache<T>(key: string, data: T): Promise<void> {
    try {
        const cacheKey = getCacheKey(key);
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            key,
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
        await updateCacheMetadata(key);
    } catch (error) {
        console.warn('[Cache] Failed to write cache:', key, error);
    }
}

/**
 * Remove cached data
 */
export async function removeCache(key: string): Promise<void> {
    try {
        const cacheKey = getCacheKey(key);
        await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
        console.warn('[Cache] Failed to remove cache:', key, error);
    }
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
        if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
        }
        await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    } catch (error) {
        console.warn('[Cache] Failed to clear cache:', error);
    }
}

/**
 * Update cache metadata for cleanup tracking
 */
async function updateCacheMetadata(key: string): Promise<void> {
    try {
        const metadataStr = await AsyncStorage.getItem(CACHE_METADATA_KEY);
        const metadata: CacheMetadata = metadataStr
            ? JSON.parse(metadataStr)
            : { keys: [], totalSize: 0, lastCleanup: Date.now() };

        if (!metadata.keys.includes(key)) {
            metadata.keys.push(key);
        }

        await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
        // Metadata update is non-critical
    }
}

/**
 * Check if cached data is fresh (within maxAge)
 */
export function isCacheFresh<T>(entry: CacheEntry<T> | null, config: CacheConfig = {}): boolean {
    if (!entry) return false;
    const { maxAge } = { ...DEFAULT_CONFIG, ...config };
    return Date.now() - entry.timestamp < maxAge;
}

/**
 * Check if cached data is stale but still usable (within staleAge)
 */
export function isCacheStale<T>(entry: CacheEntry<T> | null, config: CacheConfig = {}): boolean {
    if (!entry) return true;
    const { maxAge, staleAge } = { ...DEFAULT_CONFIG, ...config };
    const age = Date.now() - entry.timestamp;
    return age >= maxAge && age < staleAge;
}

/**
 * Check if cached data has expired (beyond staleAge)
 */
export function isCacheExpired<T>(entry: CacheEntry<T> | null, config: CacheConfig = {}): boolean {
    if (!entry) return true;
    const { staleAge } = { ...DEFAULT_CONFIG, ...config };
    return Date.now() - entry.timestamp >= staleAge;
}

/**
 * Fetch with cache - implements stale-while-revalidate pattern
 * 
 * @param key - Unique cache key
 * @param fetcher - Async function that fetches fresh data
 * @param config - Cache configuration
 * @returns Object with data, source, and optional error
 */
export async function fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
): Promise<{
    data: T | null;
    source: 'cache' | 'network' | 'stale';
    error?: Error;
    isStale?: boolean;
}> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const cached = await getCache<T>(key);
    const online = await isOnline();

    // If cache is fresh, return it immediately
    if (isCacheFresh(cached, mergedConfig)) {
        return { data: cached!.data, source: 'cache', isStale: false };
    }

    // If offline, return stale cache if available
    if (!online) {
        if (cached && !isCacheExpired(cached, mergedConfig)) {
            return { data: cached.data, source: 'stale', isStale: true };
        }
        return {
            data: null,
            source: 'cache',
            error: new Error('No network connection and no cached data available'),
        };
    }

    // If cache is stale but usable and staleWhileRevalidate is enabled,
    // return stale data immediately and revalidate in background
    if (mergedConfig.staleWhileRevalidate && isCacheStale(cached, mergedConfig)) {
        // Fire and forget background revalidation
        fetcher()
            .then(data => setCache(key, data))
            .catch(err => console.warn('[Cache] Background revalidation failed:', err));

        return { data: cached!.data, source: 'stale', isStale: true };
    }

    // Fetch fresh data
    try {
        const data = await fetcher();
        await setCache(key, data);
        return { data, source: 'network', isStale: false };
    } catch (error) {
        // On network error, fall back to stale cache if available
        if (cached && !isCacheExpired(cached, mergedConfig)) {
            return {
                data: cached.data,
                source: 'stale',
                isStale: true,
                error: error as Error,
            };
        }
        return {
            data: null,
            source: 'network',
            error: error as Error,
        };
    }
}

/**
 * Invalidate specific cache entries by pattern
 */
export async function invalidateCacheByPattern(pattern: string): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const matchingKeys = keys.filter(k =>
            k.startsWith(CACHE_PREFIX) && k.includes(pattern)
        );
        if (matchingKeys.length > 0) {
            await AsyncStorage.multiRemove(matchingKeys);
        }
    } catch (error) {
        console.warn('[Cache] Failed to invalidate cache:', pattern, error);
    }
}

/**
 * Cleanup expired cache entries
 */
export async function cleanupExpiredCache(config: CacheConfig = {}): Promise<number> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    let removedCount = 0;

    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));

        for (const cacheKey of cacheKeys) {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                const entry = JSON.parse(cached) as CacheEntry<unknown>;
                if (isCacheExpired(entry, mergedConfig)) {
                    await AsyncStorage.removeItem(cacheKey);
                    removedCount++;
                }
            }
        }
    } catch (error) {
        console.warn('[Cache] Cleanup failed:', error);
    }

    return removedCount;
}

/**
 * Pre-defined cache keys for consistency
 */
export const CacheKeys = {
    applications: (userId: string) => `applications:${userId}`,
    applicationDetail: (appId: string) => `application:${appId}`,
    pipeline: (userId: string) => `pipeline:${userId}`,
    calendar: (userId: string, month: string) => `calendar:${userId}:${month}`,
    notifications: (userId: string) => `notifications:${userId}`,
    insights: (userId: string) => `insights:${userId}`,
    profile: (userId: string) => `profile:${userId}`,
};

export default {
    getCache,
    setCache,
    removeCache,
    clearAllCache,
    fetchWithCache,
    invalidateCacheByPattern,
    cleanupExpiredCache,
    isOnline,
    isCacheFresh,
    isCacheStale,
    isCacheExpired,
    CacheKeys,
};
