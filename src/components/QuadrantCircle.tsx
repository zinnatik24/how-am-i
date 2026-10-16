import React, { useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Quadrant } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface QuadrantCircleProps {
  quadrant: Quadrant;
  onPress: () => void;
}

export const QuadrantCircle: React.FC<QuadrantCircleProps> = ({ quadrant, onPress }) => {
  const { language } = useLanguage();
  const isRu = language === 'ru';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    triggerHaptic('medium');
    onPress();
  };

  const energyLabel =
    quadrant.energy === 'high'
      ? isRu ? 'ВЫСОКАЯ ЭНЕРГИЯ' : 'HIGH ENERGY'
      : isRu ? 'НИЗКАЯ ЭНЕРГИЯ' : 'LOW ENERGY';

  const pleasantLabel =
    quadrant.pleasantness === 'pleasant'
      ? isRu ? 'Приятно' : 'Pleasant'
      : isRu ? 'Неприятно' : 'Unpleasant';

  // Specific micro-hints for instant recognition
  let hintLabel = '';
  if (quadrant.id === 'high_unpleasant') {
    hintLabel = isRu ? 'Тревога • Злость • Стресс' : 'Anxious • Angry • Stressed';
  } else if (quadrant.id === 'high_pleasant') {
    hintLabel = isRu ? 'Радость • Энергия • Драйв' : 'Joyful • Energized • Inspired';
  } else if (quadrant.id === 'low_unpleasant') {
    hintLabel = isRu ? 'Грусть • Усталость • Апатия' : 'Sad • Tired • Burnout';
  } else {
    hintLabel = isRu ? 'Покой • Баланс • Тепло' : 'Calm • Peaceful • Balanced';
  }

  // Refined palette with rich pastel depth
  let bgColor = quadrant.color_hex;
  if (quadrant.id === 'high_unpleasant') bgColor = '#FF5252';
  if (quadrant.id === 'high_pleasant') bgColor = '#FBBF24';
  if (quadrant.id === 'low_unpleasant') bgColor = '#3B82F6';
  if (quadrant.id === 'low_pleasant') bgColor = '#10B981';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[styles.tile, { backgroundColor: bgColor }]}
      >
        {/* Subtle decorative inner corner indicator */}
        <View style={styles.topRow}>
          <Text style={styles.energyText}>{energyLabel}</Text>
          <View style={styles.microTag}>
            <View style={styles.microDot} />
          </View>
        </View>

        {/* Core sentiment in warm editorial serif */}
        <View style={styles.centerBlock}>
          <Text style={styles.pleasantTitle}>{pleasantLabel}</Text>
        </View>

        {/* Emotion keywords hint */}
        <View style={styles.bottomRow}>
          <Text style={styles.hintText}>{hintLabel}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 140,
    maxWidth: 190,
    aspectRatio: 0.95,
  },
  tile: {
    flex: 1,
    borderRadius: 26,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  energyText: {
    color: 'rgba(10, 13, 18, 0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  microTag: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  microDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0A0D12',
    opacity: 0.8,
  },
  centerBlock: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  pleasantTitle: {
    color: '#0A0D12',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  bottomRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    paddingTop: 8,
  },
  hintText: {
    color: 'rgba(10, 13, 18, 0.65)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
