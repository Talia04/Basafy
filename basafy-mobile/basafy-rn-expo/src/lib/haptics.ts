/**
 * Haptic Feedback Utility
 *
 * Centralised wrapper around expo-haptics so every screen uses
 * a consistent, branded feel.  All functions are fire-and-forget
 * and silently swallow errors on unsupported devices / simulators.
 */
import * as Haptics from 'expo-haptics';

/* ── Impact (physical tap / button press) ───────────────────── */

/** Light tap – tab switch, minor toggle, chip selection. */
export function lightImpact() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
}

/** Medium tap – primary button press, card press, swipe action. */
export function mediumImpact() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
}

/** Heavy tap – destructive action, long-press, significant event. */
export function heavyImpact() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
}

/* ── Notification (system feedback after an action) ─────────── */

/** Positive outcome – task completed, sync success, save. */
export function successNotification() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
}

/** Negative outcome – error, validation failure, sync fail. */
export function errorNotification() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
}

/** Neutral alert – warning banner, info toast. */
export function warningNotification() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
}

/* ── Selection (continuous scrolling / picker feedback) ──────── */

/** Tiny tick – picker scroll, segmented-control change. */
export function selectionChanged() {
    Haptics.selectionAsync().catch(() => { });
}
