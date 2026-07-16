// Rate limiting for gmail-sync-user edge function
// Uses Supabase to track request counts per user

// @ts-ignore
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// ============================================================================
// Rate Limit Configuration
// ============================================================================

export interface RateLimitConfig {
    /** Maximum requests allowed in the time window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Identifier for the rate limit type */
    limitType: string;
}

// Default rate limits (relaxed for development/testing)
export const RATE_LIMITS = {
    // Standard sync
    sync: {
        maxRequests: 9999,
        windowSeconds: 3600, // 1 hour
        limitType: 'sync',
    } as RateLimitConfig,

    // Hard sync (full resync)
    hardSync: {
        maxRequests: 9999,
        windowSeconds: 3600, // 1 hour
        limitType: 'hard_sync',
    } as RateLimitConfig,

    // Seed only (lightweight)
    seedOnly: {
        maxRequests: 9999,
        windowSeconds: 3600, // 1 hour
        limitType: 'seed_only',
    } as RateLimitConfig,

    // Enrich only
    enrichOnly: {
        maxRequests: 9999,
        windowSeconds: 3600, // 1 hour
        limitType: 'enrich_only',
    } as RateLimitConfig,

    // Daily limit across all types
    daily: {
        maxRequests: 9999,
        windowSeconds: 86400, // 24 hours
        limitType: 'daily',
    } as RateLimitConfig,
};

// ============================================================================
// Rate Limit Result
// ============================================================================

export interface RateLimitResult {
    limit: number;
    limitName: string;
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfterSeconds?: number;
    limitType: string;
}

// ============================================================================
// In-Memory Rate Limiter (with DB fallback for persistence)
// ============================================================================

/**
 * Check and update rate limit for a user
 * Uses the gmail_sync_logs table to count recent requests
 */
export async function checkRateLimit(
    admin: SupabaseClient,
    userId: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
    const baseResult = {
        limit: config.maxRequests,
        limitName: config.limitType,
        limitType: config.limitType,
    };

    try {
        // Count recent sync attempts from gmail_sync_logs
        const { count, error } = await admin
            .from('gmail_sync_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('started_at', windowStart.toISOString());

        if (error) {
            console.error('Rate limit check failed', { error, userId, limitType: config.limitType });
            // On error, allow the request (fail open) but log it
            return {
                ...baseResult,
                allowed: true,
                remaining: config.maxRequests,
                resetAt: new Date(now.getTime() + config.windowSeconds * 1000),
            };
        }

        const requestCount = count ?? 0;
        const remaining = Math.max(0, config.maxRequests - requestCount);
        const resetAt = new Date(windowStart.getTime() + config.windowSeconds * 1000);

        if (requestCount >= config.maxRequests) {
            const retryAfterSeconds = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
            return {
                ...baseResult,
                allowed: false,
                remaining: 0,
                resetAt,
                retryAfterSeconds,
            };
        }

        return {
            ...baseResult,
            allowed: true,
            remaining: remaining - 1, // Account for current request
            resetAt,
        };
    } catch (err) {
        console.error('Rate limit check exception', { err, userId, limitType: config.limitType });
        // Fail open on exceptions
        return {
            ...baseResult,
            allowed: true,
            remaining: config.maxRequests,
            resetAt: new Date(now.getTime() + config.windowSeconds * 1000),
        };
    }
}

/**
 * Check multiple rate limits and return the most restrictive result
 */
export async function checkMultipleRateLimits(
    admin: SupabaseClient,
    userId: string,
    configs: RateLimitConfig[]
): Promise<RateLimitResult> {
    const results = await Promise.all(
        configs.map((config) => checkRateLimit(admin, userId, config))
    );

    // Find the first denied result, or the one with lowest remaining
    const denied = results.find((r) => !r.allowed);
    if (denied) {
        return denied;
    }

    // All allowed, return the one with lowest remaining
    return results.reduce((min, r) => (r.remaining < min.remaining ? r : min), results[0]);
}

/**
 * Get the appropriate rate limit configs based on request type
 */
export function getRateLimitConfigs(params: {
    hardSync: boolean;
    seedOnly: boolean;
    enrichOnly: boolean;
}): RateLimitConfig[] {
    const configs: RateLimitConfig[] = [RATE_LIMITS.daily];

    if (params.hardSync) {
        configs.push(RATE_LIMITS.hardSync);
    } else if (params.seedOnly) {
        configs.push(RATE_LIMITS.seedOnly);
    } else if (params.enrichOnly) {
        configs.push(RATE_LIMITS.enrichOnly);
    } else {
        configs.push(RATE_LIMITS.sync);
    }

    return configs;
}

/**
 * Build rate limit response headers
 */
export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': String(
            result.limit
        ),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
        ...(result.retryAfterSeconds ? { 'Retry-After': String(result.retryAfterSeconds) } : {}),
    };
}

/**
 * Format a user-friendly rate limit error message
 */
export function formatRateLimitError(result: RateLimitResult): string {
    const minutes = Math.ceil((result.retryAfterSeconds ?? 60) / 60);
    const limitName = result.limitType === 'daily' ? 'daily' : 'hourly';
    return `Rate limit exceeded. You've reached your ${limitName} sync limit. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
