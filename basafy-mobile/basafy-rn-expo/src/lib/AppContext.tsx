import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ToastConfig, ToastType } from '../components/common/Toast';

// ============================================================================
// Sync Status Types
// ============================================================================

export type SyncPhase =
    | 'idle'
    | 'connecting'
    | 'fetching'
    | 'processing'
    | 'enriching'
    | 'complete'
    | 'error';

export interface SyncStatus {
    isActive: boolean;
    phase: SyncPhase;
    progress?: number; // 0-100
    message?: string;
    processedCount?: number;
    totalCount?: number;
    error?: string;
}

// ============================================================================
// Context Type
// ============================================================================

interface AppContextValue {
    // Sync Status
    syncStatus: SyncStatus;
    setSyncStatus: (status: Partial<SyncStatus>) => void;
    startSync: (message?: string) => void;
    updateSyncProgress: (phase: SyncPhase, message?: string, progress?: number) => void;
    completeSync: (message?: string) => void;
    failSync: (error: string) => void;
    resetSync: () => void;

    // Toasts
    toasts: ToastConfig[];
    showToast: (message: string, type?: ToastType, options?: {
        duration?: number;
        action?: { label: string; onPress: () => void };
    }) => void;
    dismissToast: (id: string) => void;
    showSuccessToast: (message: string) => void;
    showErrorToast: (message: string, retryAction?: () => void) => void;
    showInfoToast: (message: string) => void;
}

const defaultSyncStatus: SyncStatus = {
    isActive: false,
    phase: 'idle',
};

const AppContext = createContext<AppContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [syncStatus, setSyncStatusState] = useState<SyncStatus>(defaultSyncStatus);
    const [toasts, setToasts] = useState<ToastConfig[]>([]);

    // ── Sync Status Methods ─────────────────────────────────────────────────
    const setSyncStatus = useCallback((status: Partial<SyncStatus>) => {
        setSyncStatusState((prev) => ({ ...prev, ...status }));
    }, []);

    const startSync = useCallback((message?: string) => {
        setSyncStatusState({
            isActive: true,
            phase: 'connecting',
            message: message || 'Starting sync...',
            progress: 0,
        });
    }, []);

    const updateSyncProgress = useCallback((
        phase: SyncPhase,
        message?: string,
        progress?: number
    ) => {
        setSyncStatusState((prev) => ({
            ...prev,
            isActive: true,
            phase,
            message,
            progress: progress ?? prev.progress,
        }));
    }, []);

    const completeSync = useCallback((message?: string) => {
        setSyncStatusState({
            isActive: false,
            phase: 'complete',
            message: message || 'Sync complete!',
            progress: 100,
        });
        // Auto-reset after a delay
        setTimeout(() => {
            setSyncStatusState(defaultSyncStatus);
        }, 2000);
    }, []);

    const failSync = useCallback((error: string) => {
        setSyncStatusState({
            isActive: false,
            phase: 'error',
            error,
            message: error,
        });
    }, []);

    const resetSync = useCallback(() => {
        setSyncStatusState(defaultSyncStatus);
    }, []);

    // ── Toast Methods ───────────────────────────────────────────────────────
    const showToast = useCallback((
        message: string,
        type: ToastType = 'info',
        options?: {
            duration?: number;
            action?: { label: string; onPress: () => void };
        }
    ) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const toast: ToastConfig = {
            id,
            message,
            type,
            duration: options?.duration,
            action: options?.action,
        };
        setToasts((prev) => [...prev, toast]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showSuccessToast = useCallback((message: string) => {
        showToast(message, 'success');
    }, [showToast]);

    const showErrorToast = useCallback((message: string, retryAction?: () => void) => {
        showToast(message, 'error', retryAction ? {
            duration: 6000,
            action: { label: 'Retry', onPress: retryAction },
        } : undefined);
    }, [showToast]);

    const showInfoToast = useCallback((message: string) => {
        showToast(message, 'info');
    }, [showToast]);

    // ── Memoized Value ──────────────────────────────────────────────────────
    const value = useMemo<AppContextValue>(() => ({
        syncStatus,
        setSyncStatus,
        startSync,
        updateSyncProgress,
        completeSync,
        failSync,
        resetSync,
        toasts,
        showToast,
        dismissToast,
        showSuccessToast,
        showErrorToast,
        showInfoToast,
    }), [
        syncStatus,
        setSyncStatus,
        startSync,
        updateSyncProgress,
        completeSync,
        failSync,
        resetSync,
        toasts,
        showToast,
        dismissToast,
        showSuccessToast,
        showErrorToast,
        showInfoToast,
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}

// Convenience hooks
export function useSyncStatus() {
    const { syncStatus, startSync, updateSyncProgress, completeSync, failSync, resetSync } = useApp();
    return { syncStatus, startSync, updateSyncProgress, completeSync, failSync, resetSync };
}

export function useToast() {
    const { toasts, showToast, dismissToast, showSuccessToast, showErrorToast, showInfoToast } = useApp();
    return { toasts, showToast, dismissToast, showSuccessToast, showErrorToast, showInfoToast };
}
