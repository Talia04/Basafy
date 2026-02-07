/**
 * Background Sync Settings Component
 * Allows users to enable/disable and configure background sync
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Palette } from '../../theme/palette';
import { lightImpact } from '../../lib/haptics';
import {
    getBackgroundSyncConfig,
    getBackgroundFetchStatus,
    registerBackgroundSync,
    unregisterBackgroundSync,
    isBackgroundSyncRegistered,
    type BackgroundSyncConfig,
} from '../../lib/backgroundSync';

interface BackgroundSyncSettingsProps {
    compact?: boolean;
}

export function BackgroundSyncSettings({ compact = false }: BackgroundSyncSettingsProps) {
    const { palette } = useTheme();
    const styles = createStyles(palette);
    const [config, setConfig] = useState<BackgroundSyncConfig | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isAvailable, setIsAvailable] = useState(true);
    const [statusName, setStatusName] = useState('');
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);

    const loadConfig = useCallback(async () => {
        try {
            const [cfg, registered, status] = await Promise.all([
                getBackgroundSyncConfig(),
                isBackgroundSyncRegistered(),
                getBackgroundFetchStatus(),
            ]);
            setConfig(cfg);
            setIsRegistered(registered);
            setIsAvailable(status.available);
            setStatusName(status.statusName);
        } catch (error) {
            console.warn('[BackgroundSyncSettings] Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    const handleToggle = useCallback(async (enabled: boolean) => {
        setToggling(true);
        try {
            if (enabled) {
                await registerBackgroundSync(config?.intervalMinutes ?? 30);
            } else {
                await unregisterBackgroundSync();
            }
            await loadConfig();
        } catch (error) {
            console.warn('[BackgroundSyncSettings] Toggle failed:', error);
        } finally {
            setToggling(false);
        }
    }, [config?.intervalMinutes, loadConfig]);

    const formatLastSync = (isoString: string | null): string => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return 'Never';

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    const getStatusIcon = () => {
        if (!config) return null;
        switch (config.lastSyncResult) {
            case 'success':
                return <Ionicons name="checkmark-circle" size={16} color="#22C55E" />;
            case 'failed':
                return <Ionicons name="alert-circle" size={16} color="#EF4444" />;
            case 'no-data':
                return <Ionicons name="remove-circle" size={16} color={palette.muted} />;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, compact && styles.containerCompact]}>
                <ActivityIndicator size="small" color={palette.primary} />
            </View>
        );
    }

    if (!isAvailable) {
        return (
            <View style={[styles.container, compact && styles.containerCompact]}>
                <View style={styles.row}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="sync-outline" size={20} color={palette.muted} />
                    </View>
                    <View style={styles.content}>
                        <Text style={styles.title}>Background Sync</Text>
                        <Text style={styles.subtitle}>
                            {statusName === 'Denied'
                                ? 'Permission denied. Enable in Settings.'
                                : 'Not available on this device.'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            <View style={styles.row}>
                <View style={styles.iconContainer}>
                    <Ionicons
                        name="sync-outline"
                        size={20}
                        color={isRegistered ? palette.primary : palette.muted}
                    />
                </View>
                <View style={styles.content}>
                    <Text style={styles.title}>Background Sync</Text>
                    <Text style={styles.subtitle}>
                        {isRegistered
                            ? `Syncs every ${config?.intervalMinutes ?? 30} minutes`
                            : 'Sync Gmail in the background'}
                    </Text>
                </View>
                {toggling ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                    <Switch
                        value={isRegistered}
                        onValueChange={(v) => { lightImpact(); handleToggle(v); }}
                        trackColor={{ false: palette.muted + '40', true: palette.primary + '60' }}
                        thumbColor={isRegistered ? palette.primary : '#f4f3f4'}
                        accessibilityRole="switch"
                        accessibilityLabel="Background sync"
                        accessibilityState={{ checked: isRegistered }}
                    />
                )}
            </View>

            {isRegistered && config && (
                <View style={styles.statusRow}>
                    <View style={styles.statusItem}>
                        {getStatusIcon()}
                        <Text style={styles.statusText}>
                            Last sync: {formatLastSync(config.lastSyncAt)}
                        </Text>
                    </View>
                    {config.lastSyncResult === 'failed' && config.lastError && (
                        <Text style={styles.errorText} numberOfLines={1}>
                            {config.lastError}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

const createStyles = (palette: Palette) => StyleSheet.create({
    container: {
        backgroundColor: palette.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    containerCompact: {
        padding: 12,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: palette.muted + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: palette.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
        color: palette.muted,
    },
    statusRow: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.muted + '30',
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        color: palette.muted,
    },
    errorText: {
        fontSize: 11,
        color: '#EF4444',
        marginTop: 4,
    },
});

export default BackgroundSyncSettings;
