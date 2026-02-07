import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Palette } from '../../theme/palette';
import { successNotification, errorNotification, warningNotification } from '../../lib/haptics';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastProps {
    toast: ToastConfig;
    onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
    success: 'checkmark-circle',
    error: 'alert-circle',
    info: 'information-circle',
    warning: 'warning',
};

const getColors = (palette: Palette): Record<ToastType, { bg: string; border: string; icon: string }> => ({
    success: {
        bg: 'rgba(90, 239, 213, 0.12)',
        border: 'rgba(90, 239, 213, 0.3)',
        icon: palette.success,
    },
    error: {
        bg: 'rgba(255, 107, 107, 0.12)',
        border: 'rgba(255, 107, 107, 0.3)',
        icon: '#FF6B6B',
    },
    info: {
        bg: 'rgba(74, 140, 255, 0.12)',
        border: 'rgba(74, 140, 255, 0.3)',
        icon: palette.primary,
    },
    warning: {
        bg: 'rgba(255, 193, 7, 0.12)',
        border: 'rgba(255, 193, 7, 0.3)',
        icon: '#FFC107',
    },
});

function Toast({ toast, onDismiss }: ToastProps) {
    const { palette } = useTheme();
    const styles = createStyles(palette);
    const COLORS = getColors(palette);
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        // Haptic feedback based on toast type
        if (toast.type === 'success') successNotification();
        else if (toast.type === 'error') errorNotification();
        else warningNotification();

        // Animate in
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto dismiss
        const duration = toast.duration ?? 4000;
        const timeout = setTimeout(() => {
            dismissToast();
        }, duration);

        return () => clearTimeout(timeout);
    }, []);

    const dismissToast = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss(toast.id);
        });
    };

    const colors = COLORS[toast.type];
    const icon = ICONS[toast.type];

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    transform: [{ translateY }],
                    opacity,
                    marginTop: insets.top + 8,
                },
            ]}
            accessibilityRole="alert"
            accessibilityLabel={`${toast.type}: ${toast.message}`}
        >
            <View style={styles.content}>
                <Ionicons name={icon} size={20} color={colors.icon} />
                <Text style={styles.message} numberOfLines={2}>
                    {toast.message}
                </Text>
            </View>
            <View style={styles.actions}>
                {toast.action && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                            toast.action?.onPress();
                            dismissToast();
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={toast.action.label}
                    >
                        <Text style={[styles.actionText, { color: colors.icon }]}>
                            {toast.action.label}
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={dismissToast}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss notification"
                >
                    <Ionicons name="close" size={18} color={palette.muted} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

interface ToastContainerProps {
    toasts: ToastConfig[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    const { palette } = useTheme();
    const styles = createStyles(palette);
    if (toasts.length === 0) return null;

    return (
        <View style={styles.toastContainer} pointerEvents="box-none">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </View>
    );
}

const createStyles = (palette: Palette) => StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        marginBottom: 8,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    message: {
        flex: 1,
        color: palette.text,
        fontSize: 14,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    actionButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    dismissButton: {
        padding: 4,
    },
});

export default Toast;
