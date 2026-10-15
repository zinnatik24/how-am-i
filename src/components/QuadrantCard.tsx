import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Quadrant } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface QuadrantCardProps {
  quadrant: Quadrant;
  isSelected?: boolean;
  onPress: () => void;
  compact?: boolean;
}

export const QuadrantCard: React.FC<QuadrantCardProps> = ({
  quadrant,
  isSelected,
  onPress,
  compact = false,
}) => {
  const { language, t } = useLanguage();

  const handlePress = () => {
    triggerHaptic('light');
    onPress();
  };

  const name = quadrant.translations[language] || quadrant.translations.en;
  const energyLabel = quadrant.energy === 'high' ? t('energy.high') : t('energy.low');
  const pleasantnessLabel =
    quadrant.pleasantness === 'pleasant' ? t('pleasantness.pleasant') : t('pleasantness.unpleasant');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.card,
        { backgroundColor: quadrant.color_hex },
        isSelected && styles.selectedBorder,
        compact ? styles.compactCard : styles.fullCard,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{energyLabel}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{pleasantnessLabel}</Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Text style={[styles.title, compact && styles.compactTitle]}>{name}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  fullCard: {
    minHeight: 140,
  },
  compactCard: {
    minHeight: 100,
    padding: 12,
  },
  selectedBorder: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.02 }],
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  bottomSection: {
    marginTop: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  compactTitle: {
    fontSize: 15,
    lineHeight: 18,
  },
});
