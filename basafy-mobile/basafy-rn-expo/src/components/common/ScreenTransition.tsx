import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = {
    /** A key that triggers the transition when it changes */
    screenKey: string;
    /** Duration of the fade-in in ms (default 180) */
    duration?: number;
    children: React.ReactNode;
};

/**
 * Wraps children with a gentle crossfade transition that plays
 * every time `screenKey` changes.
 *
 * Unlike a hard cut-to-zero, this fades from 0.4 → 1 so the
 * background never fully disappears (avoids a "flash" when
 * individual screens also have their own loading animations).
 */
export default function ScreenTransition({
    screenKey,
    duration = 180,
    children,
}: Props) {
    const opacity = useRef(new Animated.Value(1)).current;
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip animation on first mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Gentle fade — never fully transparent to avoid flash
        opacity.setValue(0.4);

        Animated.timing(opacity, {
            toValue: 1,
            duration,
            useNativeDriver: true,
        }).start();
    }, [screenKey]);

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
