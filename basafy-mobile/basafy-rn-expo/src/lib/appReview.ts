/**
 * App Review Prompt — Smart, Non-Intrusive Store Review System
 *
 * Prompts users to rate the app using the native in-app review dialog
 * after they reach positive milestones.  Respects Apple & Google guidelines
 * by only triggering when conditions align and never spamming.
 *
 * Conditions (ALL must be met):
 *  1. At least 3 days since first app open (user has had time to form opinion)
 *  2. At least 5 app opens (user is engaged)
 *  3. At least 3 tracked applications (user has found value)
 *  4. Prompt shown fewer than 3 times total (Apple guideline)
 *  5. At least 60 days since last prompt (no nagging)
 */
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@backend/supabase/client';

// ── Storage Keys ────────────────────────────────────────────────
const KEYS = {
    FIRST_OPEN: 'basafy:review:first-open',
    OPEN_COUNT: 'basafy:review:open-count',
    PROMPT_COUNT: 'basafy:review:prompt-count',
    LAST_PROMPT: 'basafy:review:last-prompt',
} as const;

// ── Thresholds ──────────────────────────────────────────────────
const MIN_DAYS_SINCE_INSTALL = 3;
const MIN_OPEN_COUNT = 5;
const MIN_APPLICATION_COUNT = 3;
const MAX_LIFETIME_PROMPTS = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 60;

// ────────────────────────────────────────────────────────────────
// Record App Open
// Call this once per cold launch when the user lands on the main
// screen (step === 'main').  It increments the open counter and
// seeds the first-open timestamp.
// ────────────────────────────────────────────────────────────────
export async function recordAppOpen(): Promise<void> {
    try {
        // Seed first-open timestamp
        const existing = await AsyncStorage.getItem(KEYS.FIRST_OPEN);
        if (!existing) {
            await AsyncStorage.setItem(KEYS.FIRST_OPEN, new Date().toISOString());
        }

        // Increment open count
        const raw = await AsyncStorage.getItem(KEYS.OPEN_COUNT);
        const count = raw ? parseInt(raw, 10) : 0;
        await AsyncStorage.setItem(KEYS.OPEN_COUNT, String(count + 1));
    } catch {
        // Non-critical — silently ignore
    }
}

// ────────────────────────────────────────────────────────────────
// Maybe Request Review
// Evaluates all conditions and triggers the native review dialog
// if they're all met.  Safe to call opportunistically — it will
// silently bail if conditions aren't ready.
// ────────────────────────────────────────────────────────────────
export async function maybeRequestReview(): Promise<boolean> {
    try {
        // ── Gate: Platform support ──────────────────────────────
        const available = await StoreReview.isAvailableAsync();
        if (!available) return false;

        // ── Gate: Minimum install age ───────────────────────────
        const firstOpenRaw = await AsyncStorage.getItem(KEYS.FIRST_OPEN);
        if (!firstOpenRaw) return false;
        const firstOpen = new Date(firstOpenRaw);
        const daysSinceInstall = (Date.now() - firstOpen.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) return false;

        // ── Gate: Minimum open count ────────────────────────────
        const openCountRaw = await AsyncStorage.getItem(KEYS.OPEN_COUNT);
        const openCount = openCountRaw ? parseInt(openCountRaw, 10) : 0;
        if (openCount < MIN_OPEN_COUNT) return false;

        // ── Gate: Lifetime prompt cap ───────────────────────────
        const promptCountRaw = await AsyncStorage.getItem(KEYS.PROMPT_COUNT);
        const promptCount = promptCountRaw ? parseInt(promptCountRaw, 10) : 0;
        if (promptCount >= MAX_LIFETIME_PROMPTS) return false;

        // ── Gate: Cooldown since last prompt ────────────────────
        const lastPromptRaw = await AsyncStorage.getItem(KEYS.LAST_PROMPT);
        if (lastPromptRaw) {
            const lastPrompt = new Date(lastPromptRaw);
            const daysSincePrompt = (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSincePrompt < MIN_DAYS_BETWEEN_PROMPTS) return false;
        }

        // ── Gate: Minimum tracked applications ──────────────────
        const { count, error } = await supabase
            .from('applications')
            .select('id', { count: 'exact', head: true });
        if (error || (count ?? 0) < MIN_APPLICATION_COUNT) return false;

        // ── All conditions met — request review ─────────────────
        await StoreReview.requestReview();

        // Record the prompt
        await AsyncStorage.setItem(KEYS.PROMPT_COUNT, String(promptCount + 1));
        await AsyncStorage.setItem(KEYS.LAST_PROMPT, new Date().toISOString());

        console.log('[AppReview] Review prompt shown', {
            openCount,
            promptNumber: promptCount + 1,
            daysSinceInstall: Math.round(daysSinceInstall),
            applicationCount: count,
        });

        return true;
    } catch (err) {
        console.warn('[AppReview] Failed to request review:', err);
        return false;
    }
}

// ────────────────────────────────────────────────────────────────
// Debug Helpers (for development / testing)
// ────────────────────────────────────────────────────────────────

/** Reset all review-related storage (useful during development). */
export async function resetReviewState(): Promise<void> {
    await Promise.all(
        Object.values(KEYS).map((key) => AsyncStorage.removeItem(key)),
    );
    console.log('[AppReview] Review state reset');
}

/** Get current review state for debugging. */
export async function getReviewState() {
    const [firstOpen, openCount, promptCount, lastPrompt] = await Promise.all([
        AsyncStorage.getItem(KEYS.FIRST_OPEN),
        AsyncStorage.getItem(KEYS.OPEN_COUNT),
        AsyncStorage.getItem(KEYS.PROMPT_COUNT),
        AsyncStorage.getItem(KEYS.LAST_PROMPT),
    ]);
    return {
        firstOpen,
        openCount: openCount ? parseInt(openCount, 10) : 0,
        promptCount: promptCount ? parseInt(promptCount, 10) : 0,
        lastPrompt,
    };
}
