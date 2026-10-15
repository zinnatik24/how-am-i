import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Emotion, SupportedLanguage } from '../types';
import { getEmotionColor } from '../data/emotionsData';
import { triggerHaptic } from '../utils/haptics';

interface MoodPlaneBubbleProps {
  emotion: Emotion;
  isSelected?: boolean;
  isCenterFocused?: boolean;
  language: SupportedLanguage;
  size: number;
  x: number;
  y: number;
  onPress: (emotion: Emotion) => void;
}

export const MoodPlaneBubble: React.FC<MoodPlaneBubbleProps> = ({
  emotion,
  isSelected = false,
  isCenterFocused = false,
  language,
  size,
  x,
  y,
  onPress,
}) => {
  const emotionName = language === 'ru' ? emotion.ru.name : emotion.en.name;
  const bubbleColor = getEmotionColor(emotion.quadrant, emotion.intensity);

  const handlePress = () => {
    triggerHaptic('light');
    onPress(emotion);
  };

  // Font sizing based on bubble diameter and word length
  const fontSize =
    size >= 100
      ? emotionName.length > 13 ? 12 : 14
      : size >= 90
      ? emotionName.length > 13 ? 10.5 : 12.5
      : emotionName.length > 13 ? 9.5 : 11;

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={handlePress}
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: 22,
          left: x - size / 2,
          top: y - size / 2,
          backgroundColor: bubbleColor,
          transform: [{ scale: isCenterFocused ? 1.14 : isSelected ? 1.08 : 1 }],
          zIndex: isCenterFocused ? 35 : isSelected ? 20 : 1,
        },
        isSelected && styles.selectedBubble,
        isCenterFocused && [
          styles.centerNeonBubble,
          {
            shadowColor: bubbleColor,
            borderColor: '#FFFFFF',
          },
          Platform.OS === 'web' && ({
            boxShadow: `0 0 24px ${bubbleColor}, 0 0 45px ${bubbleColor}bb, 0 0 70px ${bubbleColor}55`,
          } as any),
        ],
      ]}
    >
      <View style={styles.textContainer}>
        <Text
          numberOfLines={3}
          style={[
            styles.emotionText,
            {
              fontSize,
              lineHeight: fontSize * 1.18,
            },
          ]}
        >
          {emotionName}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  selectedBubble: {
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  centerNeonBubble: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 16,
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  emotionText: {
    color: '#000000',
    fontWeight: '600',
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      web: { fontFamily: 'Georgia, serif' },
    }),
    letterSpacing: -0.2,
  },
});
