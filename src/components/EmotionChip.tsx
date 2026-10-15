import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Emotion } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface EmotionChipProps {
  emotion: Emotion;
  colorHex: string;
  isSelected: boolean;
  onPress: () => void;
}

export const EmotionChip: React.FC<EmotionChipProps> = ({
  emotion,
  colorHex,
  isSelected,
  onPress,
}) => {
  const { language } = useLanguage();
  const emotionData = emotion[language] || emotion.en;

  const handlePress = () => {
    triggerHaptic('light');
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={[
        styles.chip,
        isSelected
          ? { backgroundColor: colorHex, borderColor: colorHex }
          : { backgroundColor: '#1E252E', borderColor: '#2E3846' },
      ]}
    >
      <Text
        style={[
          styles.text,
          isSelected ? styles.selectedText : styles.unselectedText,
        ]}
      >
        {emotionData.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  unselectedText: {
    color: '#E2E8F0',
  },
  intensityDots: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
