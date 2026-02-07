import React from 'react';
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Palette } from '../../theme/palette';
import { SyncStatus, SyncPhase } from '../../lib/AppContext';

interface SyncStatusBannerProps {
    syncStatus: SyncStatus;
    onCancel?: () => void;
    onRetry?: () => void;
}

const PHASE_MESSAGES: Record<SyncPhase, string> = {
    idle: '',
    connecting: 'Connecting to Gmail...',
    fetching: 'Fetching emails...',
    processing: 'Processing applications...',
    enriching: 'Enriching data with AI...',
    complete: 'Sync complete!',
    error: 'Sync failed',
};

const PHASE_ICONS: Record<SyncPhase, keyof typeof Ionicons.glyphMap> = {
    idle: 'sync-outline',
    connecting: 'cloud-outline',
    fetching: 'mail-outline',
    processing: 'document-text-outline',
    enriching: 'sparkles-outline',
    complete: 'checkmark-circle',
    error: 'alert-circle',
};

export default function SyncStatusBanner({
    syncStatus,
    onCancel,
    onRetry,
}: SyncStatusBannerProps) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

    const insets = useSafeAreaInsets();

    if (!syncStatus.isActive && syncStatus.phase === 'idle') {
        return null;
    }

    const isError = syncStatus.phase === 'error';
    const isComplete = syncStatus.phase === 'complete';
    const message = syncStatus.message || PHASE_MESSAGES[syncStatus.phase];
    const icon = PHASE_ICONS[syncStatus.phase];

    return (
        <View
            style={[
                styles.container,
                isError && styles.containerError,
                isComplete && styles.containerSuccess,
                { paddingTop: insets.top > 0 ? insets.top : 8 },
            ]}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    {syncStatus.isActive && !isError && !isComplete ? (
                        <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                        <Ionicons
                            name={icon}
                            size={20}
                            color={
                                isError
                                    ? '#FF6B6B'
                                    : isComplete
                                        ? palette.success
                                        : palette.primary
                            }
                        />
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={[styles.message, isError && styles.errorText]}>
                        {message}
                    </Text>
                    {syncStatus.progress !== undefined && syncStatus.isActive && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${Math.min(100, syncStatus.progress)}%` },
                                    ]}
                                />
                            </View>
                            {syncStatus.processedCount !== undefined && (
                                <Text style={styles.progressText}>
                                    {syncStatus.processedCount}
                                    {syncStatus.totalCount ? ` / ${syncStatus.totalCount}` : ''} processed
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.actions}>
                    {isError && onRetry && (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRetry}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh" size={16} color={palette.text} />
                            <Text style={styles.buttonText}>Retry</Text>
                        </TouchableOpacity>
                    )}
                    {syncStatus.isActive && onCancel && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onCancel}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={18} color={palette.muted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

const createStyles = (palette: Palette) => StyleSheet.create({
    container: {
        backgroundColor: 'rgba(20, 26, 40, 0.95)',
        borderBottomWidth: 1,
        borderColor: 'rgba(74, 140, 255, 0.2)',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    containerError: {
        backgroundColor: 'rgba(40, 20, 20, 0.95)',
        borderColor: 'rgba(255, 107, 107, 0.3)',
    },
    containerSuccess: {
        backgroundColor: 'rgba(20, 40, 35, 0.95)',
        borderColor: 'rgba(90, 239, 213, 0.3)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 8,
    },
    message: {
        color: palette.text,
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        color: '#FF6B6B',
    },
    progressContainer: {
        marginTop: 6,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: palette.primary,
        borderRadius: 2,
    },
    progressText: {
        color: palette.muted,
        fontSize: 11,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    buttonText: {
        color: palette.text,
        fontSize: 13,
        fontWeight: '600',
    },
    cancelButton: {
        padding: 4,
    },
});
