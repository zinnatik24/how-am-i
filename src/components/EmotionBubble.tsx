import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Emotion } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface EmotionBubbleProps {
  emotion: Emotion;
  colorHex: string;
  isSelected: boolean;
  onPress: () => void;
}

export const EmotionBubble: React.FC<EmotionBubbleProps> = ({
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

  // Vary background opacity/shade subtly based on intensity
  const bgOpacity =
    emotion.intensity === 1 ? 'rgba(255, 255, 255, 0.12)' :
    emotion.intensity === 2 ? 'rgba(255, 255, 255, 0.22)' :
    'rgba(255, 255, 255, 0.35)';

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={handlePress}
      style={[
        styles.bubble,
        {
          backgroundColor: isSelected ? colorHex : '#1A212B',
          borderColor: isSelected ? '#FFFFFF' : '#2A3644',
          shadowColor: isSelected ? colorHex : '#000',
        },
        isSelected && styles.bubbleSelected,
      ]}
    >
      {/* Background color glow tint */}
      {!isSelected && (
        <View
          style={[
            styles.tintOverlay,
            { backgroundColor: colorHex, opacity: emotion.intensity === 1 ? 0.2 : emotion.intensity === 2 ? 0.35 : 0.5 },
          ]}
        />
      )}

      {/* Emotion Name */}
      <Text
        style={[
          styles.name,
          isSelected ? styles.nameSelected : styles.nameUnselected,
        ]}
        numberOfLines={2}
      >
        {emotionData.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bubble: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 2,
    margin: 6,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  bubbleSelected: {
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  tintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  nameSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  nameUnselected: {
    color: '#E2E8F0',
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
