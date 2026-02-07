import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../../theme/palette';

// ── Shimmer animation wrapper ──────────────────────────────────

type ShimmerProps = {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: ViewStyle;
};

export function Shimmer({ width, height, borderRadius = 8, style }: ShimmerProps) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [shimmerAnim]);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
    });

    return (
        <View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                },
                style,
            ]}
        >
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateX }] },
                ]}
            >
                <LinearGradient
                    colors={[
                        'rgba(255,255,255,0)',
                        'rgba(255,255,255,0.06)',
                        'rgba(255,255,255,0)',
                    ]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
}

// ── Application card skeleton ──────────────────────────────────

export function ApplicationCardSkeleton() {
    return (
        <View style={skeletonStyles.appCard}>
            <View style={skeletonStyles.appRow}>
                <Shimmer width={36} height={36} borderRadius={12} />
                <View style={skeletonStyles.appContent}>
                    <Shimmer width="70%" height={14} />
                    <Shimmer width="50%" height={12} />
                    <View style={skeletonStyles.appMeta}>
                        <Shimmer width={90} height={12} />
                        <Shimmer width={52} height={18} borderRadius={10} />
                    </View>
                </View>
            </View>
        </View>
    );
}

export function ApplicationsListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <View style={skeletonStyles.list}>
            {Array.from({ length: count }).map((_, i) => (
                <ApplicationCardSkeleton key={`app-sk-${i}`} />
            ))}
        </View>
    );
}

// ── Notification card skeleton ─────────────────────────────────

export function NotificationCardSkeleton() {
    return (
        <View style={skeletonStyles.notifCard}>
            <View style={skeletonStyles.appRow}>
                <Shimmer width={36} height={36} borderRadius={12} />
                <View style={skeletonStyles.appContent}>
                    <View style={skeletonStyles.notifHeader}>
                        <Shimmer width="60%" height={14} />
                        <Shimmer width={28} height={10} />
                    </View>
                    <Shimmer width="85%" height={12} />
                </View>
            </View>
        </View>
    );
}

export function NotificationsListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <View style={skeletonStyles.list}>
            <Shimmer width={60} height={12} style={{ marginBottom: 4 }} />
            {Array.from({ length: count }).map((_, i) => (
                <NotificationCardSkeleton key={`notif-sk-${i}`} />
            ))}
        </View>
    );
}

// ── Pipeline column skeleton ───────────────────────────────────

function PipelineCardSkeleton() {
    return (
        <View style={skeletonStyles.pipelineCard}>
            <View style={skeletonStyles.appRow}>
                <Shimmer width={42} height={42} borderRadius={21} />
                <View style={skeletonStyles.appContent}>
                    <Shimmer width="65%" height={14} />
                    <Shimmer width="45%" height={12} />
                    <View style={skeletonStyles.appMeta}>
                        <Shimmer width={60} height={18} borderRadius={10} />
                        <Shimmer width={48} height={18} borderRadius={10} />
                    </View>
                </View>
            </View>
        </View>
    );
}

export function PipelineColumnSkeleton() {
    return (
        <View style={skeletonStyles.pipelineColumn}>
            <View style={skeletonStyles.pipelineHeader}>
                <View style={skeletonStyles.appRow}>
                    <Shimmer width={28} height={28} borderRadius={10} />
                    <Shimmer width={80} height={14} />
                </View>
                <Shimmer width={26} height={26} borderRadius={13} />
            </View>
            {Array.from({ length: 3 }).map((_, i) => (
                <PipelineCardSkeleton key={`pipe-sk-${i}`} />
            ))}
        </View>
    );
}

export function PipelineSkeleton() {
    return (
        <View style={skeletonStyles.pipelineRow}>
            {Array.from({ length: 3 }).map((_, i) => (
                <PipelineColumnSkeleton key={`col-sk-${i}`} />
            ))}
        </View>
    );
}

// ── Insight stat card skeleton ─────────────────────────────────

export function InsightStatSkeleton() {
    return (
        <View style={skeletonStyles.insightCard}>
            <Shimmer width={30} height={30} borderRadius={12} />
            <Shimmer width="55%" height={12} />
            <Shimmer width="40%" height={18} />
        </View>
    );
}

export function InsightsOverviewSkeleton() {
    return (
        <View style={skeletonStyles.insightsGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
                <InsightStatSkeleton key={`insight-sk-${i}`} />
            ))}
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────

const skeletonStyles = StyleSheet.create({
    list: {
        gap: 12,
        paddingTop: 8,
    },
    appCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    appRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    appContent: {
        flex: 1,
        gap: 8,
    },
    appMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    notifCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    notifHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pipelineColumn: {
        width: 350,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 12,
    },
    pipelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pipelineCard: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    pipelineRow: {
        flexDirection: 'row',
        gap: 14,
        paddingRight: 18,
    },
    insightCard: {
        width: '47%',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 8,
    },
    insightsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
});
