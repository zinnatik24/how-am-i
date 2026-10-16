import React, { useRef, useEffect } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Quadrant } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface QuadrantCircleProps {
  quadrant: Quadrant;
  onPress: () => void;
}

export const QuadrantCircle: React.FC<QuadrantCircleProps> = ({ quadrant, onPress }) => {
  const { language } = useLanguage();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Soft, organic breathing pulse
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.045,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handlePress = () => {
    triggerHaptic('medium');
    onPress();
  };

  const line1 =
    quadrant.energy === 'high'
      ? language === 'ru'
        ? 'Высокая энергия'
        : 'High Energy'
      : language === 'ru'
      ? 'Низкая энергия'
      : 'Low Energy';

  const line2 =
    quadrant.pleasantness === 'pleasant'
      ? language === 'ru'
        ? 'Приятно'
        : 'Pleasant'
      : language === 'ru'
      ? 'Неприятно'
      : 'Unpleasant';

  return (
    <Animated.View style={[styles.animWrapper, { transform: [{ scale: pulseAnim }] }]}>
      {/* Outer translucent organic glow halo */}
      <View
        style={[
          styles.glowHalo,
          {
            backgroundColor: quadrant.color_hex,
            opacity: 0.35,
          },
        ]}
      />

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        style={[
          styles.circle,
          {
            backgroundColor: quadrant.color_hex,
            shadowColor: quadrant.color_hex,
          },
        ]}
      >
        <View style={styles.contentWrap}>
          <Text style={styles.serifLine1}>{line1}</Text>
          <Text style={styles.serifLine2}>{line2}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowHalo: {
    position: 'absolute',
    width: '110%',
    height: '110%',
    borderRadius: 9999,
  },
  circle: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  serifLine1: {
    color: '#0A0D12',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  serifLine2: {
    color: '#0A0D12',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginTop: 2,
  },
});

