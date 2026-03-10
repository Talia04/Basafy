import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  onFinish?: () => void;
};

export default function AnimatedSplash({ onFinish }: Props) {
  const bScale = useRef(new Animated.Value(1.4)).current;
  const restOpacity = useRef(new Animated.Value(0)).current;
  const restTranslate = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(bScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(restOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(restTranslate, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setTimeout(() => onFinish?.(), 3000);
    });
  }, [bScale, restOpacity, restTranslate, onFinish]);

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={['#0A0E1A', '#121B34']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.logoRow} accessible accessibilityLabel="Basafy">
        <Animated.Text style={[styles.logoB, { transform: [{ scale: bScale }] }]}>B</Animated.Text>
        <Animated.Text
          style={[
            styles.logoRest,
            { opacity: restOpacity, transform: [{ translateX: restTranslate }] },
          ]}
        >
          asafy
        </Animated.Text>
      </View>
      <Text style={styles.tagline}>Your job search, organized.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 24,
    zIndex: 999,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  logoB: {
    fontSize: 96,
    fontWeight: '800',
    color: '#5AEFD5',
    letterSpacing: -1,
  },
  logoRest: {
    fontSize: 64,
    fontWeight: '800',
    color: '#E6EDFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    marginTop: 12,
    color: 'rgba(230,237,255,0.65)',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
