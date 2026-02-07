import React, { useRef } from 'react';
import {
    Animated,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type SwipeAction = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    backgroundColor: string;
    onPress: () => void;
};

type Props = {
    children: React.ReactNode;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
    /** Width of each action button */
    actionWidth?: number;
    /** Whether swipe is enabled */
    enabled?: boolean;
};

const SWIPE_THRESHOLD = 0.3;
const VELOCITY_THRESHOLD = 0.5;

export default function SwipeableRow({
    children,
    leftActions = [],
    rightActions = [],
    actionWidth = 72,
    enabled = true,
}: Props) {
    const translateX = useRef(new Animated.Value(0)).current;
    const lastOffset = useRef(0);

    const leftWidth = leftActions.length * actionWidth;
    const rightWidth = rightActions.length * actionWidth;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                if (!enabled) return false;
                // Only capture horizontal swipes
                return (
                    Math.abs(gestureState.dx) > 10 &&
                    Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 1.5)
                );
            },
            onPanResponderGrant: () => {
                translateX.setOffset(lastOffset.current);
                translateX.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                let dx = gestureState.dx;
                // Clamp within bounds with rubber-band effect
                const total = lastOffset.current + dx;
                if (total > leftWidth) {
                    dx = leftWidth + (total - leftWidth) * 0.3 - lastOffset.current;
                } else if (total < -rightWidth) {
                    dx = -rightWidth + (total + rightWidth) * 0.3 - lastOffset.current;
                }
                translateX.setValue(dx);
            },
            onPanResponderRelease: (_, gestureState) => {
                translateX.flattenOffset();
                const currentValue = lastOffset.current + gestureState.dx;
                const velocity = gestureState.vx;

                let toValue = 0;

                // Opening left actions (swipe right)
                if (
                    leftActions.length > 0 &&
                    (currentValue > leftWidth * SWIPE_THRESHOLD ||
                        velocity > VELOCITY_THRESHOLD)
                ) {
                    toValue = leftWidth;
                }
                // Opening right actions (swipe left)
                else if (
                    rightActions.length > 0 &&
                    (currentValue < -rightWidth * SWIPE_THRESHOLD ||
                        velocity < -VELOCITY_THRESHOLD)
                ) {
                    toValue = -rightWidth;
                }

                lastOffset.current = toValue;
                Animated.spring(translateX, {
                    toValue,
                    friction: 9,
                    tension: 50,
                    useNativeDriver: true,
                }).start();
            },
        }),
    ).current;

    const close = () => {
        lastOffset.current = 0;
        Animated.spring(translateX, {
            toValue: 0,
            friction: 9,
            tension: 50,
            useNativeDriver: true,
        }).start();
    };

    const handleAction = (action: SwipeAction) => {
        close();
        // Small delay so close animation starts before action callback
        setTimeout(() => action.onPress(), 200);
    };

    // Interpolate opacity for actions
    const leftOpacity = translateX.interpolate({
        inputRange: [0, leftWidth * 0.5, leftWidth],
        outputRange: [0, 0.5, 1],
        extrapolate: 'clamp',
    });

    const rightOpacity = translateX.interpolate({
        inputRange: [-rightWidth, -rightWidth * 0.5, 0],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.container}>
            {/* Left actions (revealed when swiping right) */}
            {leftActions.length > 0 && (
                <Animated.View
                    style={[
                        styles.actionsLeft,
                        { opacity: leftOpacity, width: leftWidth },
                    ]}
                >
                    {leftActions.map((action, index) => (
                        <TouchableOpacity
                            key={`left-${index}`}
                            style={[
                                styles.actionButton,
                                { backgroundColor: action.backgroundColor, width: actionWidth },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => handleAction(action)}
                        >
                            <Ionicons name={action.icon} size={20} color={action.color} />
                            <Text style={[styles.actionLabel, { color: action.color }]}>
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </Animated.View>
            )}

            {/* Right actions (revealed when swiping left) */}
            {rightActions.length > 0 && (
                <Animated.View
                    style={[
                        styles.actionsRight,
                        { opacity: rightOpacity, width: rightWidth },
                    ]}
                >
                    {rightActions.map((action, index) => (
                        <TouchableOpacity
                            key={`right-${index}`}
                            style={[
                                styles.actionButton,
                                { backgroundColor: action.backgroundColor, width: actionWidth },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => handleAction(action)}
                        >
                            <Ionicons name={action.icon} size={20} color={action.color} />
                            <Text style={[styles.actionLabel, { color: action.color }]}>
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </Animated.View>
            )}

            {/* Sliding content */}
            <Animated.View
                style={[styles.content, { transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                {children}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
    },
    content: {
        zIndex: 1,
    },
    actionsLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        overflow: 'hidden',
    },
    actionsRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
});
