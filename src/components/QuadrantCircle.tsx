import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Quadrant } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface QuadrantCircleProps {
  quadrant: Quadrant;
  onPress: () => void;
}

export const QuadrantCircle: React.FC<QuadrantCircleProps> = ({ quadrant, onPress }) => {
  const { language, t } = useLanguage();

  const handlePress = () => {
    triggerHaptic('medium');
    onPress();
  };

  const energyLabel = quadrant.energy === 'high' ? t('energy.high') : t('energy.low');
  const pleasantLabel =
    quadrant.pleasantness === 'pleasant' ? t('pleasantness.pleasant') : t('pleasantness.unpleasant');

  const examplesKey = `quadrant.${quadrant.id}_examples` as any;
  const examples = t(examplesKey);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
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
        {/* Energy badge */}
        <View style={styles.pill}>
          <Text style={styles.pillText}>{energyLabel}</Text>
        </View>

        {/* Pleasantness main title */}
        <Text style={styles.pleasantText}>{pleasantLabel}</Text>

        {/* Feelings examples snippet */}
        <Text style={styles.examplesText} numberOfLines={2}>
          {examples}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  circle: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pleasantText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  examplesText: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
    paddingHorizontal: 4,
  },
});
