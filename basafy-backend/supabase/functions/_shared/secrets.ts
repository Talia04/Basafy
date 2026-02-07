/**
 * Centralized secrets management for Supabase Edge Functions
 * 
 * All secrets should be configured via Supabase CLI:
 *   npx supabase secrets set KEY=value
 * 
 * Never commit actual secret values to the repository.
 */

// @ts-ignore - Deno environment
const env = Deno.env;

// ============================================================================
// Secret Definitions
// ============================================================================

export interface SecretsConfig {
    // Supabase
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;

    // Google OAuth
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI?: string;

    // OpenAI
    OPENAI_API_KEY?: string;

    // Expo (for push notifications)
    EXPO_ACCESS_TOKEN?: string;
}

// ============================================================================
// Secret Loaders with Fallbacks
// ============================================================================

/**
 * Get Supabase URL with fallback for different naming conventions
 */
export function getSupabaseUrl(): string {
    return env.get('PROJECT_URL') || env.get('SUPABASE_URL') || '';
}

/**
 * Get Supabase Anon Key with fallback
 */
export function getSupabaseAnonKey(): string {
    return env.get('ANON_KEY') || env.get('SUPABASE_ANON_KEY') || '';
}

/**
 * Get Supabase Service Role Key with fallback
 */
export function getSupabaseServiceRoleKey(): string {
    return env.get('SERVICE_ROLE_KEY') || env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

/**
 * Get Google Client ID
 */
export function getGoogleClientId(): string {
    return env.get('GOOGLE_CLIENT_ID') || '';
}

/**
 * Get Google Client Secret
 */
export function getGoogleClientSecret(): string {
    return env.get('GOOGLE_CLIENT_SECRET') || '';
}

/**
 * Get Google Redirect URI (optional)
 */
export function getGoogleRedirectUri(): string | undefined {
    const uri = env.get('GOOGLE_REDIRECT_URI');
    return uri && uri.length > 0 ? uri : undefined;
}

/**
 * Get OpenAI API Key
 */
export function getOpenAiApiKey(): string {
    return env.get('OPENAI_API_KEY') || '';
}

/**
 * Get Expo Access Token (for push notifications)
 */
export function getExpoAccessToken(): string {
    return env.get('EXPO_ACCESS_TOKEN') || '';
}

// ============================================================================
// Validation
// ============================================================================

export interface SecretValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
}

/**
 * Validate that required secrets are present
 */
export function validateSecrets(required: (keyof SecretsConfig)[]): SecretValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    const getters: Record<keyof SecretsConfig, () => string | undefined> = {
        SUPABASE_URL: getSupabaseUrl,
        SUPABASE_ANON_KEY: getSupabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: getSupabaseServiceRoleKey,
        GOOGLE_CLIENT_ID: getGoogleClientId,
        GOOGLE_CLIENT_SECRET: getGoogleClientSecret,
        GOOGLE_REDIRECT_URI: getGoogleRedirectUri,
        OPENAI_API_KEY: getOpenAiApiKey,
        EXPO_ACCESS_TOKEN: getExpoAccessToken,
    };

    for (const key of required) {
        const value = getters[key]?.();
        if (!value || value.length === 0) {
            missing.push(key);
        }
    }

    // Check for optional but recommended secrets
    if (!getOpenAiApiKey()) {
        warnings.push('OPENAI_API_KEY not set - LLM features will be disabled');
    }

    return {
        valid: missing.length === 0,
        missing,
        warnings,
    };
}

/**
 * Validate and throw if required secrets are missing
 */
export function requireSecrets(required: (keyof SecretsConfig)[]): void {
    const result = validateSecrets(required);

    if (!result.valid) {
        throw new Error(
            `Missing required secrets: ${result.missing.join(', ')}. ` +
            `Set them with: npx supabase secrets set KEY=value`
        );
    }

    // Log warnings
    for (const warning of result.warnings) {
        console.warn(`[Secrets] ${warning}`);
    }
}

// ============================================================================
// All-in-one loader
// ============================================================================

/**
 * Load all secrets at once
 */
export function loadAllSecrets(): SecretsConfig {
    return {
        SUPABASE_URL: getSupabaseUrl(),
        SUPABASE_ANON_KEY: getSupabaseAnonKey(),
        SUPABASE_SERVICE_ROLE_KEY: getSupabaseServiceRoleKey(),
        GOOGLE_CLIENT_ID: getGoogleClientId(),
        GOOGLE_CLIENT_SECRET: getGoogleClientSecret(),
        GOOGLE_REDIRECT_URI: getGoogleRedirectUri(),
        OPENAI_API_KEY: getOpenAiApiKey(),
        EXPO_ACCESS_TOKEN: getExpoAccessToken(),
    };
}
