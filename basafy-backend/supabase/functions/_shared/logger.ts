/**
 * Centralized logging module for edge functions
 * Provides structured logging with context for debugging production issues
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
    functionName: string;
    userId?: string;
    requestId?: string;
    [key: string]: unknown;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    duration?: number;
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format a log entry as JSON string
 */
function formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
}

/**
 * Create a logger instance for a specific function
 */
export function createLogger(functionName: string) {
    let requestId: string | undefined;
    let userId: string | undefined;
    let startTime: number | undefined;
    const additionalContext: Record<string, unknown> = {};

    const buildContext = (): LogContext => ({
        functionName,
        ...(requestId && { requestId }),
        ...(userId && { userId }),
        ...additionalContext,
    });

    const log = (level: LogLevel, message: string, extra?: Record<string, unknown>) => {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: { ...buildContext(), ...extra },
            ...(startTime && { duration: Date.now() - startTime }),
        };

        const formatted = formatLogEntry(entry);

        switch (level) {
            case 'debug':
                console.debug(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'error':
                console.error(formatted);
                break;
        }

        return entry;
    };

    return {
        /**
         * Set the request ID for this logger instance
         */
        setRequestId(id: string) {
            requestId = id;
            return this;
        },

        /**
         * Set the user ID for this logger instance
         */
        setUserId(id: string) {
            userId = id;
            return this;
        },

        /**
         * Add additional context that will be included in all logs
         */
        addContext(key: string, value: unknown) {
            additionalContext[key] = value;
            return this;
        },

        /**
         * Start timing for duration tracking
         */
        startTimer() {
            startTime = Date.now();
            return this;
        },

        /**
         * Get elapsed time since startTimer was called
         */
        getElapsed(): number | undefined {
            return startTime ? Date.now() - startTime : undefined;
        },

        /**
         * Log debug message (for development/verbose logging)
         */
        debug(message: string, extra?: Record<string, unknown>) {
            return log('debug', message, extra);
        },

        /**
         * Log info message (normal operations)
         */
        info(message: string, extra?: Record<string, unknown>) {
            return log('info', message, extra);
        },

        /**
         * Log warning message (potential issues)
         */
        warn(message: string, extra?: Record<string, unknown>) {
            return log('warn', message, extra);
        },

        /**
         * Log error message with optional Error object
         */
        error(message: string, error?: Error | unknown, extra?: Record<string, unknown>) {
            const entry: LogEntry = {
                timestamp: new Date().toISOString(),
                level: 'error',
                message,
                context: { ...buildContext(), ...extra },
                ...(startTime && { duration: Date.now() - startTime }),
            };

            if (error instanceof Error) {
                entry.error = {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                };
            } else if (error !== undefined) {
                entry.error = {
                    name: 'UnknownError',
                    message: String(error),
                };
            }

            console.error(formatLogEntry(entry));
            return entry;
        },

        /**
         * Log the start of a request
         */
        logRequestStart(method: string, extra?: Record<string, unknown>) {
            this.startTimer();
            return this.info(`${method} request started`, extra);
        },

        /**
         * Log successful request completion
         */
        logRequestSuccess(message = 'Request completed successfully', extra?: Record<string, unknown>) {
            return this.info(message, { ...extra, duration: this.getElapsed() });
        },

        /**
         * Log request failure
         */
        logRequestError(message: string, error?: Error | unknown, extra?: Record<string, unknown>) {
            return this.error(message, error, { ...extra, duration: this.getElapsed() });
        },
    };
}

/**
 * Extract user ID from JWT token (basic extraction without full validation)
 */
export function extractUserIdFromToken(authHeader: string | null): string | undefined {
    if (!authHeader) return undefined;

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return undefined;

    try {
        // JWT is base64url encoded, split and decode payload
        const parts = token.split('.');
        if (parts.length !== 3) return undefined;

        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.sub;
    } catch {
        return undefined;
    }
}

/**
 * Create a standardized error response with logging
 */
export function createErrorResponse(
    logger: ReturnType<typeof createLogger>,
    message: string,
    status: number,
    error?: Error | unknown,
    extra?: Record<string, unknown>
): Response {
    logger.logRequestError(message, error, { status, ...extra });

    return new Response(
        JSON.stringify({
            error: message,
            requestId: (logger as unknown as { requestId?: string }).requestId,
        }),
        {
            status,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

export type Logger = ReturnType<typeof createLogger>;
