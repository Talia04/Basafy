// Input validation for notifications-push webhook
// @ts-ignore
import { z } from 'https://esm.sh/zod@3.22.4';

// ============================================================================
// Webhook Payload Schema
// ============================================================================

const NotificationRecordSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string().max(500),
    body: z.string().max(2000).nullable(),
    type: z.string().max(100),
    subtype: z.string().max(100).nullable(),
    entity_type: z.string().max(100).nullable(),
    entity_id: z.string().uuid().nullable(),
    channel: z.enum(['push', 'in_app', 'both', 'email']).nullable(),
    scheduled_for: z.string().datetime().nullable(),
    delivered_at: z.string().datetime().nullable(),
}).passthrough(); // Allow additional fields from DB

export const WebhookPayloadSchema = z.object({
    type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
    table: z.string(),
    schema: z.literal('public'),
    record: NotificationRecordSchema,
    old_record: NotificationRecordSchema.nullable(),
});

export type ValidatedWebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// ============================================================================
// Validation Function
// ============================================================================

export function validateWebhookPayload(
    rawPayload: unknown
): { success: true; data: ValidatedWebhookPayload } | { success: false; error: string } {
    const result = WebhookPayloadSchema.safeParse(rawPayload);

    if (!result.success) {
        const errors = result.error.issues.map((issue) => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
        });
        return {
            success: false,
            error: `Invalid webhook payload: ${errors.join('; ')}`,
        };
    }

    return { success: true, data: result.data };
}

// ============================================================================
// User Settings Schema
// ============================================================================

export const UserNotificationSettingsSchema = z.object({
    user_id: z.string().uuid(),
    push_enabled: z.boolean().default(false),
    updates_enabled: z.boolean().default(true),
    reminders_enabled: z.boolean().default(true),
    event_reminder_24h: z.boolean().default(true),
    event_reminder_2h: z.boolean().default(true),
    event_reminder_15m: z.boolean().default(false),
    task_due_enabled: z.boolean().default(true),
    task_overdue_enabled: z.boolean().default(false),
});

export type ValidatedUserSettings = z.infer<typeof UserNotificationSettingsSchema>;

export function normalizeSettings(raw: unknown): ValidatedUserSettings | null {
    if (!raw) return null;
    const result = UserNotificationSettingsSchema.safeParse(raw);
    return result.success ? result.data : null;
}
