import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Props = {
    /** A key that triggers the transition when it changes */
    screenKey: string;
    /** Duration of the fade-in in ms (default 220) */
    duration?: number;
    children: React.ReactNode;
};

/**
 * Wraps children with a fade + subtle upward slide transition
 * that plays every time `screenKey` changes.
 */
export default function ScreenTransition({
    screenKey,
    duration = 220,
    children,
}: Props) {
    const opacity = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip animation on first mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Reset to invisible + slightly offset
        opacity.setValue(0);
        translateY.setValue(8);

        // Animate in
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                useNativeDriver: true,
            }),
        ]).start();
    }, [screenKey]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity,
                    transform: [{ translateY }],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
