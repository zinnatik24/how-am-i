import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export interface QuadrantIconProps {
  quadrantId?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const QuadrantIcon: React.FC<QuadrantIconProps> = ({
  quadrantId,
  size = 16,
  color,
  style,
}) => {
  const qId = (quadrantId || '').toLowerCase();

  // 1. RED QUADRANT: Red 10-pointed star / thorn ("красная 10-угольная звезда / колючка")
  if (qId.includes('high_unpleasant') || qId.includes('red') || qId.includes('krasn')) {
    const iconColor = color || '#EF4444';
    return (
      <View style={style}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M 12.00,1.20 L 13.61,7.15 L 18.47,3.30 L 16.21,9.04 L 22.36,8.75 L 17.20,12.00 L 22.36,15.25 L 16.21,14.96 L 18.47,20.70 L 13.61,16.85 L 12.00,22.80 L 10.39,16.85 L 5.53,20.70 L 7.79,14.96 L 1.64,15.25 L 6.80,12.00 L 1.64,8.75 L 7.79,9.04 L 5.53,3.30 L 10.39,7.15 Z"
            fill={iconColor}
            stroke={iconColor}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }

  // 2. GREEN QUADRANT: Green cloud heart ("зеленое облачное сердце")
  if (qId.includes('low_pleasant') || qId.includes('green') || qId.includes('zelen')) {
    const iconColor = color || '#10B981';
    return (
      <View style={style}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 21.2 C11 20.2 4.2 14.8 2.5 11.2 C1.1 8.2 2.2 4.8 5.4 4.1 C7.8 3.6 10.2 4.7 12 6.8 C13.8 4.7 16.2 3.6 18.6 4.1 C21.8 4.8 22.9 8.2 21.5 11.2 C19.8 14.8 13 20.2 12 21.2 Z"
            fill={iconColor}
          />
          <Circle cx="6.5" cy="7.5" r="3.2" fill={iconColor} />
          <Circle cx="10" cy="5.8" r="2.8" fill={iconColor} />
          <Circle cx="14" cy="5.8" r="2.8" fill={iconColor} />
          <Circle cx="17.5" cy="7.5" r="3.2" fill={iconColor} />
          <Circle cx="19.2" cy="11.2" r="2.8" fill={iconColor} />
          <Circle cx="4.8" cy="11.2" r="2.8" fill={iconColor} />
        </Svg>
      </View>
    );
  }

  // 3. YELLOW QUADRANT: Yellow cloud charge/lightning ("облачный желтый заряд / молния")
  if (qId.includes('high_pleasant') || qId.includes('yellow') || qId.includes('zhelt')) {
    const iconColor = color || '#F59E0B';
    return (
      <View style={style}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M13.8 1.8 C14.6 1.8 15.2 2.5 15.0 3.3 L13.8 8.2 H18.8 C19.6 8.2 20.1 9.0 19.8 9.7 L11.2 22.2 C10.6 23.1 9.4 22.5 9.6 21.5 L11.0 15.2 H5.8 C5.0 15.2 4.5 14.3 4.9 13.6 L12.4 2.2 C12.7 1.9 13.2 1.8 13.8 1.8 Z"
            fill={iconColor}
            stroke={iconColor}
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }

  // 4. BLUE QUADRANT: Blue cloud ring with center hole ("закрашенное синим облачное кольцо с дыркой")
  const iconColor = color || '#3B82F6';
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2.5 C13.5 2.5 14.8 3.3 15.5 4.5 C16.6 4.1 17.8 4.3 18.7 5.0 C19.6 5.7 20.1 6.8 20.0 7.9 C21.1 8.7 21.7 10.0 21.6 11.4 C21.5 12.8 20.7 14.0 19.5 14.6 C19.7 15.8 19.2 17.0 18.3 17.8 C17.3 18.6 16.0 18.8 14.9 18.3 C14.1 19.3 12.9 20.0 11.5 20.0 C10.1 20.0 8.9 19.3 8.1 18.3 C7.0 18.8 5.7 18.6 4.7 17.8 C3.8 17.0 3.3 15.8 3.5 14.6 C2.3 14.0 1.5 12.8 1.4 11.4 C1.3 10.0 1.9 8.7 3.0 7.9 C2.9 6.8 3.4 5.7 4.3 5.0 C5.2 4.3 6.4 4.1 7.5 4.5 C8.2 3.3 9.5 2.5 11.0 2.5 Z M12 8 C9.8 8 8 9.8 8 12 C8 14.2 9.8 16 12 16 C14.2 16 16 14.2 16 12 C16 9.8 14.2 8 12 8 Z"
          fill={iconColor}
        />
      </Svg>
    </View>
  );
};
